import { Receiver } from '@upstash/qstash';
import crypto from 'crypto';
import {
  getStageResult,
  claimStageExecution,
  persistStageResult,
  releaseStageExecution,
} from '../../_lib/ai/stageCheckpoint.js';
import { matchProviderAndModel } from '../../_lib/ai/capabilityMatcher.js';
import { GroqProvider } from '../../_lib/ai/providers/GroqProvider.js';
import { GeminiProvider } from '../../_lib/ai/providers/GeminiProvider.js';
import {
  isJobCancelled,
  isTerminalStatus,
  getJobLockKey,
} from '../../_lib/ai/generationLifecycle.js';
import { pushJobChunk, setJobState, CANONICAL_WORKER_URL } from '../../_lib/ai/asyncExecutor.js';
import { persistGenerationRow, findGenerationById } from '../../_lib/supabase.js';
import { completeIdempotencyKey, hashKey } from '../../_lib/rateLimiter.js';
import {
  clean,
  cleanOutput,
  buildBlogPrompt,
  buildAffiliatePrompt,
  performTavilyResearch,
  countWords,
} from '../../_lib/ai/promptBuilders.js';
import { safeFetchText } from '../../_lib/ssrf.js';
import { buildSourceEnvelope, buildFactLock } from '../../_lib/ai/humanizer/semanticLedger.js';
import { buildStyleProfile } from '../../_lib/ai/humanizer/styleProfile.js';
import { buildStructuredHumanizerBrief } from '../../_lib/ai/humanizer/humanizePrompt.js';
import { evaluateQualityGateAsync } from '../../_lib/ai/humanizer/validators.js';
import { buildActionableCritique, buildRefinementPrompt } from '../../_lib/ai/humanizer/refinementEngine.js';
import { buildSemanticDiffArtifact } from '../../_lib/ai/humanizer/semanticDiff.js';
import { classifySemanticRisk } from '../../_lib/ai/humanizer/riskClassifier.js';
import { buildTerminologyMap } from '../../_lib/ai/humanizer/terminologyMap.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

import { getRedis, isProductionMode, RedisUnavailableError } from '../../_lib/redisConfig.js';

const groq = new GroqProvider();
const gemini = new GeminiProvider();

function getProvider(providerName) {
  return providerName === 'groq' ? groq : gemini;
}

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const signature = req.headers['upstash-signature'];
  if (!signature) {
    return res.status(401).json({ error: 'MISSING_SIGNATURE' });
  }

  const rawBody = await getRawBody(req);
  const upstashRegion = req.headers['upstash-region'];

  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
  });

  let isValid = await receiver.verify({
    signature,
    body: rawBody.toString('utf-8'),
    url: CANONICAL_WORKER_URL,
    upstashRegion,
  }).catch(() => false);

  if (!isValid && CANONICAL_WORKER_URL.includes('/api/internal/worker/generation')) {
    const altUrl = CANONICAL_WORKER_URL.replace('/api/internal/worker/generation', '/api/_internal/worker/generation');
    isValid = await receiver.verify({
      signature,
      body: rawBody.toString('utf-8'),
      url: altUrl,
      upstashRegion,
    }).catch(() => false);
  }

  if (!isValid && CANONICAL_WORKER_URL.includes('/api/_internal/worker/generation')) {
    const altUrl = CANONICAL_WORKER_URL.replace('/api/_internal/worker/generation', '/api/internal/worker/generation');
    isValid = await receiver.verify({
      signature,
      body: rawBody.toString('utf-8'),
      url: altUrl,
      upstashRegion,
    }).catch(() => false);
  }

  if (!isValid) {
    const host = req.headers.host || 'penshift.onrender.com';
    isValid = await receiver.verify({
      signature,
      body: rawBody.toString('utf-8'),
      url: `https://${host}${req.url}`,
      upstashRegion,
    }).catch(() => false);
  }

  if (!isValid) {
    return res.status(401).json({ error: 'INVALID_QSTASH_SIGNATURE' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf-8'));
  } catch (err) {
    return res.status(400).json({ error: 'INVALID_JSON_BODY' });
  }

  const {
    generationId,
    principalId,
    userId = null,
    guestId = null,
    idempotencyKey,
    task = 'humanize',
    mode = 'standard',
    inputText = '',
    requestedProvider = 'auto',
    metadata = {},
  } = payload;

  if (!generationId) {
    return res.status(400).json({ error: 'MISSING_GENERATION_ID' });
  }

  const redis = getRedis();

  // 1. Authoritative check: If generation is already COMPLETED, FAILED, or CANCELLED, exit immediately
  if (userId) {
    const existing = await findGenerationById(generationId);
    if (existing && isTerminalStatus(existing.status)) {
      return res.status(200).json({ status: existing.status, replayed: true });
    }
  }

  if (await isJobCancelled(generationId)) {
    return res.status(200).json({ status: 'CANCELLED', replayed: true });
  }

  // 2. Acquire worker execution lock (lease 360s)
  const workerId = crypto.randomUUID();
  const lockKey = getJobLockKey(generationId);
  let hasLock = false;

  if (redis) {
    try {
      const lockRes = await redis.set(lockKey, workerId, { nx: true, ex: 360 });
      hasLock = lockRes === 'OK' || lockRes === true;
    } catch (err) {
      if (isProductionMode()) {
        throw new RedisUnavailableError(`Redis worker lock failed in production: ${err.message}`);
      }
      console.warn(`[worker] Lock check error:`, err.message);
    }
  } else {
    if (isProductionMode()) {
      throw new RedisUnavailableError('Redis is required for worker locks in production mode');
    }
    hasLock = true;
  }

  if (!hasLock) {
    // Another worker is actively executing this job; exit gracefully without duplication
    return res.status(200).json({ status: 'IN_PROGRESS', duplicateWorker: true });
  }

  // 3. Re-verify authoritative status after lock acquisition
  if (userId) {
    const postLockCheck = await findGenerationById(generationId);
    if (postLockCheck && isTerminalStatus(postLockCheck.status)) {
      return res.status(200).json({ status: postLockCheck.status, replayed: true });
    }
  }

  if (await isJobCancelled(generationId)) {
    return res.status(200).json({ status: 'CANCELLED', replayed: true });
  }

  try {
    await setJobState(generationId, { status: 'RUNNING', startedAt: Date.now(), guestId, userId });

    const route = matchProviderAndModel({
      task,
      mode,
      inputText,
      requestedProvider,
    });

    const activeProvider = getProvider(route.actual_provider);
    const fallbackProvider = getProvider(route.fallback_provider);

    // ── STAGE 1: INPUT_SCORE ──────────────────────────────────────────
    let inputScore = await getStageResult(generationId, 'INPUT_SCORE', { guestId });
    if (!inputScore) {
      const claimed = await claimStageExecution(generationId, 'INPUT_SCORE', workerId, 60, { guestId });
      if (claimed) {
        try {
          inputScore = await activeProvider.score({ text: inputText });
        } catch (_) {
          try {
            inputScore = await fallbackProvider.score({ text: inputText });
          } catch (__) {
            inputScore = { score: null, humanScore: null, aiScore: null, unavailable: true };
          }
        }
        await persistStageResult(generationId, 'INPUT_SCORE', inputScore, { guestId });
        await releaseStageExecution(generationId, 'INPUT_SCORE', workerId, { guestId });
      }
    }
    await pushJobChunk(generationId, { event: 'input_score', data: inputScore });

    let finalOutputText = '';
    let finalQualityMetrics = {};
    let finalDiffArtifact = null;

    if (task === 'humanize') {
      // ═══════════════ GOD-LEVEL HUMANIZER SEMANTIC PIPELINE ═══════════════
      
      // ── STAGE 2: SOURCE_ANALYSIS ──
      let sourceAnalysis = await getStageResult(generationId, 'SOURCE_ANALYSIS', { guestId });
      if (!sourceAnalysis) {
        const claimed = await claimStageExecution(generationId, 'SOURCE_ANALYSIS', workerId, 60, { guestId });
        if (claimed) {
          const sourceEnvelope = buildSourceEnvelope(inputText, metadata);
          const riskProfile = classifySemanticRisk(sourceEnvelope);
          const terminologyMap = buildTerminologyMap(inputText);
          sourceAnalysis = { sourceEnvelope, riskProfile, terminologyMap };
          await persistStageResult(generationId, 'SOURCE_ANALYSIS', sourceAnalysis, { guestId });
          await releaseStageExecution(generationId, 'SOURCE_ANALYSIS', workerId, { guestId });
        } else {
          sourceAnalysis = await getStageResult(generationId, 'SOURCE_ANALYSIS', { guestId });
        }
      }
      const sourceEnvelope = sourceAnalysis?.sourceEnvelope || buildSourceEnvelope(inputText, metadata);
      const riskProfile = sourceAnalysis?.riskProfile || classifySemanticRisk(sourceEnvelope);
      const terminologyMap = sourceAnalysis?.terminologyMap || buildTerminologyMap(inputText);

      // Independent Verifier: Use distinct provider and model from generator to avoid correlated hallucinations
      const verifierProviderName = route.actual_provider === 'groq' ? 'gemini' : 'groq';
      const verifierProvider = getProvider(verifierProviderName);
      const verifierModel = verifierProviderName === 'gemini' ? 'gemini-3.1-flash-lite' : 'openai/gpt-oss-20b';
      const auditOptions = {
        terminologyMap,
        verifierProvider,
        verifierProviderName,
        verifierModel,
        riskScore: riskProfile?.score ? riskProfile.score / 100 : 0.0,
        isHighRisk: riskProfile?.level === 'high',
      };

      // ── STAGE 3: FACT_LOCK (Durable Invariant Artifact) ──
      let factLock = await getStageResult(generationId, 'FACT_LOCK', { guestId });
      if (!factLock) {
        const claimed = await claimStageExecution(generationId, 'FACT_LOCK', workerId, 60, { guestId });
        if (claimed) {
          factLock = buildFactLock(sourceEnvelope);
          await persistStageResult(generationId, 'FACT_LOCK', factLock, { guestId });
          await releaseStageExecution(generationId, 'FACT_LOCK', workerId, { guestId });
        } else {
          factLock = await getStageResult(generationId, 'FACT_LOCK', { guestId });
        }
      }

      // ── STAGE 4: STYLE_PROFILE (Independent Stylometrics) ──
      let styleProfile = await getStageResult(generationId, 'STYLE_PROFILE', { guestId });
      if (!styleProfile) {
        const claimed = await claimStageExecution(generationId, 'STYLE_PROFILE', workerId, 60, { guestId });
        if (claimed) {
          styleProfile = buildStyleProfile(inputText, metadata);
          await persistStageResult(generationId, 'STYLE_PROFILE', styleProfile, { guestId });
          await releaseStageExecution(generationId, 'STYLE_PROFILE', workerId, { guestId });
        } else {
          styleProfile = await getStageResult(generationId, 'STYLE_PROFILE', { guestId });
        }
      }

      // ── STAGE 5: DRAFT (Controlled Generation Brief) ──
      let draftResult = await getStageResult(generationId, 'DRAFT', { guestId });
      if (!draftResult) {
        const claimed = await claimStageExecution(generationId, 'DRAFT', workerId, 120, { guestId });
        if (claimed) {
          const promptPayload = buildStructuredHumanizerBrief(sourceEnvelope, styleProfile, riskProfile, {
            mode,
            vocab: metadata.vocab,
            sentenceLength: metadata.sentenceLength,
            userMemory: metadata.userMemory,
          });

          let genRes;
          try {
            genRes = await activeProvider.generate({
              prompt: promptPayload,
              model: route.actual_model,
              temperature: mode === 'aggressive' ? 0.82 : (mode === 'formal' ? 0.65 : 0.72),
            });
          } catch (genErr) {
            console.warn(`[worker] Primary provider draft failed: ${genErr.message}. Trying fallback provider...`);
            genRes = await fallbackProvider.generate({
              prompt: promptPayload,
              model: route.fallback_model,
              temperature: 0.7,
            });
          }

          const cleanedDraft = cleanOutput(genRes.text);
          draftResult = { text: cleanedDraft, model: genRes.actualModel };
          await persistStageResult(generationId, 'DRAFT', draftResult, { guestId });
          await releaseStageExecution(generationId, 'DRAFT', workerId, { guestId });
        } else {
          draftResult = await getStageResult(generationId, 'DRAFT', { guestId });
        }
      }
      // Server-side streaming isolation: candidate draft text is NEVER pushed to client stream
      await pushJobChunk(generationId, { event: 'draft', data: { model: draftResult.model, status: 'DRAFT_SYNTHESIZED' } });

      // ── STAGE 6: SEMANTIC_AUDIT ──
      let auditResult = await getStageResult(generationId, 'SEMANTIC_AUDIT', { guestId });
      if (!auditResult) {
        const claimed = await claimStageExecution(generationId, 'SEMANTIC_AUDIT', workerId, 60, { guestId });
        if (claimed) {
          auditResult = await evaluateQualityGateAsync(sourceEnvelope, draftResult.text, styleProfile, auditOptions);
          await persistStageResult(generationId, 'SEMANTIC_AUDIT', auditResult, { guestId });
          await releaseStageExecution(generationId, 'SEMANTIC_AUDIT', workerId, { guestId });
        } else {
          auditResult = await getStageResult(generationId, 'SEMANTIC_AUDIT', { guestId });
        }
      }

      // ── STAGE 7: CRITIQUE (Actionable Feedback Artifact) ──
      let critiqueResult = await getStageResult(generationId, 'CRITIQUE', { guestId });
      if (!critiqueResult) {
        const claimed = await claimStageExecution(generationId, 'CRITIQUE', workerId, 60, { guestId });
        if (claimed) {
          critiqueResult = buildActionableCritique(auditResult?.violations || []);
          await persistStageResult(generationId, 'CRITIQUE', critiqueResult, { guestId });
          await releaseStageExecution(generationId, 'CRITIQUE', workerId, { guestId });
        } else {
          critiqueResult = await getStageResult(generationId, 'CRITIQUE', { guestId });
        }
      }

      // ── STAGE 8: REFINE (Source-Grounded Targeted Repair) ──
      let refineResult = await getStageResult(generationId, 'REFINE', { guestId });
      if (!refineResult) {
        const claimed = await claimStageExecution(generationId, 'REFINE', workerId, 90, { guestId });
        if (claimed) {
          if (auditResult?.accepted) {
            refineResult = { text: draftResult.text, repaired: false };
          } else {
            // Attempt targeted refinement from authoritative source
            const refinePrompt = buildRefinementPrompt(sourceEnvelope, draftResult.text, critiqueResult, { mode });
            try {
              const refineGen = await activeProvider.generate({
                prompt: refinePrompt,
                model: route.actual_model,
                temperature: 0.65,
              });
              refineResult = { text: cleanOutput(refineGen.text), repaired: true };
            } catch (_) {
              try {
                const fallbackRefine = await fallbackProvider.generate({
                  prompt: refinePrompt,
                  model: route.fallback_model,
                  temperature: 0.65,
                });
                refineResult = { text: cleanOutput(fallbackRefine.text), repaired: true };
              } catch (__) {
                refineResult = { text: draftResult.text, repaired: false };
              }
            }
          }
          await persistStageResult(generationId, 'REFINE', refineResult, { guestId });
          await releaseStageExecution(generationId, 'REFINE', workerId, { guestId });
        } else {
          refineResult = await getStageResult(generationId, 'REFINE', { guestId });
        }
      }

      // ── STAGE 9: FINAL_SEMANTIC_AUDIT ──
      let finalAuditResult = await getStageResult(generationId, 'FINAL_SEMANTIC_AUDIT', { guestId });
      let auditAttempts = (await getStageResult(generationId, 'AUDIT_ATTEMPTS', { guestId }))?.count || 0;

      if (!finalAuditResult || (!finalAuditResult.finalEval?.accepted && !finalAuditResult.terminalFailed && auditAttempts < 2)) {
        const claimed = await claimStageExecution(generationId, 'FINAL_SEMANTIC_AUDIT', workerId, 60, { guestId });
        if (claimed) {
          const finalEval = await evaluateQualityGateAsync(sourceEnvelope, refineResult.text, styleProfile, auditOptions);
          const diffArtifact = buildSemanticDiffArtifact(sourceEnvelope, refineResult.text, finalEval);

          if (!finalEval.accepted) {
            auditAttempts += 1;
            await persistStageResult(generationId, 'AUDIT_ATTEMPTS', { count: auditAttempts }, { guestId });
            finalAuditResult = { finalEval, diffArtifact, terminalFailed: false };
            await persistStageResult(generationId, 'FINAL_SEMANTIC_AUDIT', finalAuditResult, { guestId });
            await releaseStageExecution(generationId, 'FINAL_SEMANTIC_AUDIT', workerId, { guestId });
          } else {
            finalAuditResult = { finalEval, diffArtifact, terminalFailed: false };
            await persistStageResult(generationId, 'FINAL_SEMANTIC_AUDIT', finalAuditResult, { guestId });
            await releaseStageExecution(generationId, 'FINAL_SEMANTIC_AUDIT', workerId, { guestId });
          }
        } else {
          finalAuditResult = await getStageResult(generationId, 'FINAL_SEMANTIC_AUDIT', { guestId });
        }
      }

      // Quality Gate Telemetry & Audit
      if (!finalAuditResult?.finalEval || finalAuditResult.finalEval.accepted !== true || finalAuditResult.finalEval.verdict !== 'PASS') {
        const violationTypes = (finalAuditResult?.finalEval?.violations || [])
          .map((v) => v.type)
          .slice(0, 5)
          .join(', ');
        console.warn(`[worker] Semantic quality audit note for ${generationId}: [${violationTypes || 'NON_CRITICAL_VARIATION'}]`);
      }

      finalOutputText = refineResult?.text || draftResult?.text || inputText;
      finalQualityMetrics = finalAuditResult?.finalEval?.metrics || {};
      finalDiffArtifact = finalAuditResult?.diffArtifact || null;
    } else {
      // ═══════════════ BLOG & AFFILIATE PIPELINES ═══════════════
      let factLock = await getStageResult(generationId, 'FACT_LOCK', { guestId });
      if (!factLock) {
        const claimed = await claimStageExecution(generationId, 'FACT_LOCK', workerId, 60, { guestId });
        if (claimed) {
          factLock = { locked: true, timestamp: Date.now() };
          await persistStageResult(generationId, 'FACT_LOCK', factLock, { guestId });
          await releaseStageExecution(generationId, 'FACT_LOCK', workerId, { guestId });
        }
      }

      let draftResult = await getStageResult(generationId, 'DRAFT', { guestId });
      if (!draftResult) {
        const claimed = await claimStageExecution(generationId, 'DRAFT', workerId, 120, { guestId });
        if (claimed) {
          let promptPayload;
          if (task === 'blog') {
            let researchContext = '';
            try {
              const resSearch = await performTavilyResearch(inputText);
              if (resSearch.ok && resSearch.results.length > 0) {
                researchContext = resSearch.results.map((r, i) => `[Source ${i + 1}: ${r.title}](${r.url})\n${r.content}`).join('\n\n');
              }
            } catch (_) {}

            let toneSample = '';
            if (metadata?.toneUrl) {
              try {
                const rawSample = await safeFetchText(metadata.toneUrl, { maxBytes: 50000, timeoutMs: 4000 });
                if (rawSample) toneSample = clean(rawSample).slice(0, 1000);
              } catch (_) {}
            }

            promptPayload = buildBlogPrompt(inputText, mode, {
              ...metadata,
              researchContext,
              toneSample,
            });
          } else {
            promptPayload = buildAffiliatePrompt(inputText, mode, metadata);
          }

          const genRes = await activeProvider.generate({
            prompt: promptPayload,
            model: route.actual_model,
            temperature: mode === 'aggressive' ? 0.85 : (mode === 'formal' ? 0.65 : 0.72),
          });
          draftResult = { text: genRes.text, model: genRes.actualModel };
          await persistStageResult(generationId, 'DRAFT', draftResult, { guestId });
          await releaseStageExecution(generationId, 'DRAFT', workerId, { guestId });
        }
      }
      await pushJobChunk(generationId, { event: 'draft', data: { model: draftResult.model, status: 'DRAFT_SYNTHESIZED' } });

      let critiqueResult = await getStageResult(generationId, 'CRITIQUE', { guestId });
      if (!critiqueResult) {
        const claimed = await claimStageExecution(generationId, 'CRITIQUE', workerId, 60, { guestId });
        if (claimed) {
          critiqueResult = { passed: true, score: null, critiqueEvaluated: false };
          await persistStageResult(generationId, 'CRITIQUE', critiqueResult, { guestId });
          await releaseStageExecution(generationId, 'CRITIQUE', workerId, { guestId });
        }
      }

      let refineResult = await getStageResult(generationId, 'REFINE', { guestId });
      if (!refineResult) {
        const claimed = await claimStageExecution(generationId, 'REFINE', workerId, 60, { guestId });
        if (claimed) {
          const cleaned = cleanOutput(draftResult.text);
          refineResult = { text: cleaned };
          await persistStageResult(generationId, 'REFINE', refineResult, { guestId });
          await releaseStageExecution(generationId, 'REFINE', workerId, { guestId });
        }
      }

      finalOutputText = refineResult.text;
    }

    // ── STAGE 10: OUTPUT_SCORE ─────────────────────────────────────────
    let outputScore = await getStageResult(generationId, 'OUTPUT_SCORE', { guestId });
    if (!outputScore) {
      const claimed = await claimStageExecution(generationId, 'OUTPUT_SCORE', workerId, 60, { guestId });
      if (claimed) {
        try {
          outputScore = await activeProvider.score({ text: finalOutputText });
        } catch (_) {
          try {
            outputScore = await fallbackProvider.score({ text: finalOutputText });
          } catch (__) {
            outputScore = { score: null, humanScore: null, aiScore: null, unavailable: true };
          }
        }
        await persistStageResult(generationId, 'OUTPUT_SCORE', outputScore, { guestId });
        await releaseStageExecution(generationId, 'OUTPUT_SCORE', workerId, { guestId });
      }
    }
    await pushJobChunk(generationId, { event: 'output_score', data: outputScore });
    const finalScores = {
      inputScore: inputScore?.humanScore ?? null,
      outputScore: outputScore?.humanScore ?? null,
      aiScore: outputScore?.aiScore ?? null,
      unavailable: Boolean(outputScore?.unavailable),
      ...(Object.keys(finalQualityMetrics).length > 0 ? { qualityMetrics: finalQualityMetrics } : {}),
      ...(finalDiffArtifact ? { semanticStatus: finalDiffArtifact.semanticStatus, semanticConfidence: finalDiffArtifact.confidence } : {}),
    };

    const historyType = task === 'humanize' ? 'penshift_history_humanizer' : (task === 'score' ? 'penshift_history_score' : 'penshift_history');

    // ── TERMINAL PERSISTENCE ──────────────────────────────────────────
    if (userId) {
      await persistGenerationRow({
        id: generationId,
        user_id: userId,
        idempotency_key: idempotencyKey,
        type: historyType,
        task,
        requested_mode: mode,
        requested_provider: requestedProvider,
        actual_provider: route.actual_provider,
        actual_model: route.actual_model,
        input_text: inputText,
        output_text: finalOutputText,
        input_word_count: countWords(inputText),
        output_word_count: countWords(finalOutputText),
        scores: finalScores,
        metadata,
        status: 'COMPLETED',
      });
    }

    if (idempotencyKey && principalId) {
      const keyHash = hashKey(idempotencyKey);
      await completeIdempotencyKey(
        principalId,
        keyHash,
        {
          generationId,
          output_text: finalOutputText,
          scores: finalScores,
          actual_provider: route.actual_provider,
          actual_model: route.actual_model,
        },
        { guestId }
      );
    }

    await setJobState(generationId, {
      status: 'COMPLETED',
      completedAt: Date.now(),
      output_text: finalOutputText,
      scores: finalScores,
      actual_provider: route.actual_provider,
      actual_model: route.actual_model,
      guestId,
      userId,
    });

    await pushJobChunk(generationId, {
      event: 'done',
      data: {
        text: finalOutputText,
        scores: finalScores,
        metadata: {
          provider: route.actual_provider,
          model: route.actual_model,
        },
      },
    });

    return res.status(200).json({ success: true, generationId, status: 'COMPLETED' });
  } catch (err) {
    console.error(`[worker] Generation error for ${generationId}:`, err);
    if (err instanceof RedisUnavailableError || err.name === 'RedisUnavailableError' || err.code === 'REDIS_UNAVAILABLE') {
      return res.status(503).json({ error: 'REDIS_UNAVAILABLE', message: err.message });
    }
    await setJobState(generationId, { status: 'FAILED', error: err.message, guestId, userId }).catch(() => {});
    return res.status(500).json({ error: 'GENERATION_FAILED', message: err.message });
  } finally {
    if (redis) {
      try {
        const LUA_RELEASE_LOCK = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        await redis.eval(LUA_RELEASE_LOCK, [lockKey], [workerId]);
      } catch (_) {}
    }
  }
}
