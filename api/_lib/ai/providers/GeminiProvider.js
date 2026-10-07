import { BaseProvider } from './BaseProvider.js';
import { getNextKey, markKeyFailed, markKeySuccess } from '../circuitBreaker.js';
import { getModel } from '../modelRegistry.js';
import { SCORING_SYSTEM_PROMPT, buildScoringUserPrompt, validateScoringResult } from '../scoringValidator.js';

function extractJSON(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (__) {}
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.substring(start, end + 1));
      } catch (___) {}
    }
    return null;
  }
}

export class GeminiProvider extends BaseProvider {
  constructor() {
    super('gemini');
  }

  async generate(options = {}) {
    const {
      prompt,
      systemPrompt,
      model: requestedModel = 'gemini-3.8-flash',
      temperature = 0.75,
      maxTokens = 4096,
      signal = null,
    } = options;

    const keyObj = await getNextKey('gemini');
    if (!keyObj) {
      throw new Error('Gemini_NoKeyAvailable: All Gemini API keys are currently in cooldown or unconfigured.');
    }

    const reg = getModel(requestedModel);
    const effectiveModel = reg ? reg.providerModelId : (requestedModel || 'gemini-3.5-flash');
    const modelCandidates = [
      effectiveModel,
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
    ].filter((v, i, a) => a.indexOf(v) === i);

    for (const model of modelCandidates) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const userText = typeof prompt === 'string' ? prompt : (prompt.user || JSON.stringify(prompt));
        const sysText = systemPrompt || (typeof prompt === 'object' && prompt.system ? prompt.system : null);

        const bodyPayload = {
          contents: [{ parts: [{ text: userText }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        };

        if (sysText) {
          bodyPayload.systemInstruction = { parts: [{ text: sysText }] };
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': keyObj.key,
          },
          body: JSON.stringify(bodyPayload),
          signal,
        });

        if (!res.ok) {
          if (res.status === 404) {
            continue; // Next fallback model
          }
          const retryAfter = res.headers.get('retry-after');
          const isRateLimit = res.status === 429;
          const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
          await markKeyFailed('gemini', keyObj.index, isRateLimit, retryMs);
          const errText = await res.text().catch(() => '');
          throw new Error(`Gemini/${model} HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        markKeySuccess('gemini', keyObj.index);

        return {
          text,
          actualModel: model,
          usage: data?.usageMetadata || {},
        };
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        if (model === modelCandidates[modelCandidates.length - 1]) {
          throw err;
        }
      }
    }

    throw new Error('Gemini: All model candidates failed.');
  }

  async score(options = {}) {
    const { text, signal = null } = options;
    const keyObj = await getNextKey('gemini');
    if (!keyObj) {
      throw new Error('Gemini_NoKeyAvailable: All Gemini API keys are currently in cooldown.');
    }

    const userPrompt = buildScoringUserPrompt(text);
    const models = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'];

    for (const model of models) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': keyObj.key,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SCORING_SYSTEM_PROMPT }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 512,
              responseMimeType: 'application/json',
            },
          }),
          signal,
        });

        if (!res.ok) {
          if (res.status === 404) continue;
          const retryAfter = res.headers.get('retry-after');
          await markKeyFailed('gemini', keyObj.index, res.status === 429, retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000);
          continue;
        }

        const data = await res.json();
        const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = extractJSON(rawContent);
        const validation = validateScoringResult(parsed);

        if (validation.valid) {
          markKeySuccess('gemini', keyObj.index);
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
          console.warn(`[GeminiProvider/score] Validation failed for model ${model}: ${validation.reason}`);
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
      }
    }

    throw new Error('Gemini: Scoring failed across all candidate models.');
  }

  async healthCheck() {
    const start = Date.now();
    try {
      const keyObj = await getNextKey('gemini');
      if (!keyObj) {
        return { healthy: false, latencyMs: 0, error: 'No available API keys' };
      }
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyObj.key}`);
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
