import { BaseProvider } from './BaseProvider.js';
import { getNextKey, markKeyFailed, markKeySuccess } from '../circuitBreaker.js';
import { getModel } from '../modelRegistry.js';
import { SCORING_SYSTEM_PROMPT, buildScoringUserPrompt, validateScoringResult } from '../scoringValidator.js';

function extractJSON(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    // Attempt markdown block regex
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (__) {
        // continue
      }
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.substring(start, end + 1));
      } catch (___) {
        return null;
      }
    }
    return null;
  }
}

export class GroqProvider extends BaseProvider {
  constructor() {
    super('groq');
  }

  async generate(options = {}) {
    const {
      prompt,
      systemPrompt = 'You are a professional AI content specialist. Follow all instructions exactly. Never add preamble or commentary.',
      model: requestedModel = 'openai/gpt-oss-120b',
      temperature = 0.72,
      maxTokens = 4096,
      signal = null,
    } = options;

    const keyObj = await getNextKey('groq');
    if (!keyObj) {
      throw new Error('Groq_NoKeyAvailable: All Groq API keys are currently in cooldown or unconfigured.');
    }

    const reg = getModel(requestedModel);
    const effectiveModel = reg ? reg.providerModelId : (requestedModel || 'openai/gpt-oss-120b');
    // Fallback model list if requested model returns 404
    const modelCandidates = [
      effectiveModel,
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b',
    ].filter((v, i, a) => a.indexOf(v) === i);

    const sysText = (typeof prompt === 'object' && prompt?.system)
      ? prompt.system
      : (options.systemPrompt || systemPrompt || 'You are a professional AI content specialist. Follow all instructions exactly. Never add preamble or commentary.');
    const userContent = typeof prompt === 'string'
      ? prompt
      : (prompt?.user || JSON.stringify(prompt));

    for (const model of modelCandidates) {
      try {
        const payload = {
          model,
          messages: [
            { role: 'system', content: sysText },
            { role: 'user', content: userContent },
          ],
          temperature,
          max_tokens: maxTokens,
        };

        if (model.includes('qwen')) {
          payload.reasoning_format = 'hidden';
        }

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${keyObj.key}`,
          },
          body: JSON.stringify(payload),
          signal,
        });

        if (!res.ok) {
          if (res.status === 404) {
            continue; // Try next fallback candidate
          }
          const retryAfter = res.headers.get('retry-after');
          const isRateLimit = res.status === 429;
          const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
          await markKeyFailed('groq', keyObj.index, isRateLimit, retryMs);
          const errText = await res.text().catch(() => '');
          throw new Error(`Groq/${model} HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content || '';
        markKeySuccess('groq', keyObj.index);

        return {
          text: content,
          actualModel: model,
          usage: data?.usage || {},
        };
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        if (model === modelCandidates[modelCandidates.length - 1]) {
          throw err;
        }
      }
    }

    throw new Error('Groq: All model candidates failed.');
  }

  async score(options = {}) {
    const { text, signal = null } = options;
    const keyObj = await getNextKey('groq');
    if (!keyObj) {
      throw new Error('Groq_NoKeyAvailable: All Groq API keys are currently in cooldown.');
    }

    const userPrompt = buildScoringUserPrompt(text);
    const models = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'];

    for (const model of models) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${keyObj.key}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: SCORING_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 512,
            response_format: { type: 'json_object' },
          }),
          signal,
        });

        if (!res.ok) {
          if (res.status === 404) continue;
          const retryAfter = res.headers.get('retry-after');
          await markKeyFailed('groq', keyObj.index, res.status === 429, retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000);
          continue;
        }

        const data = await res.json();
        const rawContent = data?.choices?.[0]?.message?.content || '';
        const parsed = extractJSON(rawContent);
        const validation = validateScoringResult(parsed);

        if (validation.valid) {
          markKeySuccess('groq', keyObj.index);
          const r = validation.result;
          return {
            score: r.humanScore,
            aiScore: r.aiScore,
            humanScore: r.humanScore,
            breakdown: r.breakdown,
            signals: r.signals,
            reasoning: r.reasoning,
            actualModel: model,
          };
        } else {
          console.warn(`[GroqProvider/score] Validation failed for model ${model}: ${validation.reason}`);
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
      }
    }

    throw new Error('Groq: Scoring failed across all candidate models.');
  }

  async healthCheck() {
    const start = Date.now();
    try {
      const keyObj = await getNextKey('groq');
      if (!keyObj) {
        return { healthy: false, latencyMs: 0, error: 'No available API keys' };
      }
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${keyObj.key}` },
      });
      return {
        healthy: res.ok,
        latencyMs: Date.now() - start,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: err.message };
    }
  }
}
