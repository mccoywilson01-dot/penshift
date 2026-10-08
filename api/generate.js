import crypto from 'crypto';
import { RedisUnavailableError } from './_lib/redisConfig.js';
import {
  getClientIp,
  checkRateLimit,
  resolveGuestSession,
  admitGeneration,
  getIdempotencyRecord,
  getGuestTombstone,
  reserveIdempotencyKey,
  completeIdempotencyKey,
  hashKey,
  hashRequest,
} from './_lib/rateLimiter.js';
import {
  verifyBearerToken,
  findGenerationByUserAndIdempotencyKey,
  findGenerationById,
  persistGenerationRow,
} from './_lib/supabase.js';
import { matchProviderAndModel } from './_lib/ai/capabilityMatcher.js';
import { GroqProvider } from './_lib/ai/providers/GroqProvider.js';
import { GeminiProvider } from './_lib/ai/providers/GeminiProvider.js';
import {
  cancelJob,
  isTerminalStatus,
  formatSSE,
  formatSSEDone,
} from './_lib/ai/generationLifecycle.js';
import {
  getSafeJobChunks,
  getJobState,
  setJobState,
  dispatchGenerationToQStash,
} from './_lib/ai/asyncExecutor.js';
import {
  countWords,
  clean,
  cleanOutput,
  buildBlogPrompt,
  buildAffiliatePrompt,
  performTavilyResearch,
} from './_lib/ai/promptBuilders.js';
import { safeFetchText } from './_lib/ssrf.js';
import { buildSourceEnvelope } from './_lib/ai/humanizer/semanticLedger.js';
import { buildStyleProfile } from './_lib/ai/humanizer/styleProfile.js';
import { buildStructuredHumanizerBrief } from './_lib/ai/humanizer/humanizePrompt.js';
import { evaluateQualityGateAsync } from './_lib/ai/humanizer/validators.js';
import { buildActionableCritique, buildRefinementPrompt } from './_lib/ai/humanizer/refinementEngine.js';
import { buildSemanticDiffArtifact } from './_lib/ai/humanizer/semanticDiff.js';
import { classifySemanticRisk } from './_lib/ai/humanizer/riskClassifier.js';
import { buildTerminologyMap } from './_lib/ai/humanizer/terminologyMap.js';

export const maxDuration = 120;
export const TRANSPORT_HANDOFF_TIMEOUT_MS = 42000;

/**
 * Checks whether the incoming request and outgoing response are still active and writable.
 * Guards against writing to sockets destroyed or ended by clients or edge proxies.
 */
export function isSocketWritable(req, res) {
  if (!res) return false;
  if (res.destroyed || res.writableEnded) return false;
  if (res.socket && (res.socket.destroyed || !res.socket.writable)) return false;
  return true;
}

const groq = new GroqProvider();
const gemini = new GeminiProvider();

function getProvider(providerName) {
  return providerName === 'groq' ? groq : gemini;
}

// ═══════════════════════════════════ CORS & AUTHENTICATION ═══════════════════════════════════

async function handleCorsAndAuth(req, res) {
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://penshift.onrender.com,https://penshift.com').split(',').map((s) => s.trim());
  const isDev = process.env.PENSHIFT_DEV_MODE === 'true' && (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  const isAllowedOrigin = origin && allowed.includes(origin);

  let verifiedUser = null;
  const authHeader = req.headers.authorization;
  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    verifiedUser = await verifyBearerToken(authHeader);
    if (verifiedUser) {
      req.user = verifiedUser;
    }
  }

  if (isDev) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', allowed[0]);
  } else {
    res.setHeader('Access-Control-Allow-Origin', allowed[0]);
    return res.status(403).json({ error: 'Origin not allowed.' });
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return null;
}

// ═══════════════════════════════════ GATEWAY HANDLER ═══════════════════════════════════

export default async function handler(req, res) {
  try {
    const corsError = await handleCorsAndAuth(req, res);
    if (corsError) return corsError;

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Resolve Principal Identity
  let principalId;
  let userId = null;
  let guestId = null;

  if (req.user?.id) {
    userId = req.user.id;
    principalId = `user:${userId}`;
  } else {
    const guestSession = await resolveGuestSession(req, res);
    if (guestSession.error) {
      return res.status(429).json({ error: guestSession.error, message: guestSession.message });
    }
    guestId = guestSession.guestId;
    principalId = `guest:${guestId}`;
  }

  const queryJobId = req.query?.jobId || req.query?.status;

  // ── ACTION: RECONNECTION & STATUS POLLING (GET) ──────────────────────────
  if (req.method === 'GET' && queryJobId) {
    const generationId = String(queryJobId);

    // Authorization Verification:
    let isOwner = false;
    let jobData = null;

    if (userId) {
      const state = await getJobState(generationId);
      if (state && (state.userId === userId || state.user_id === userId)) {
        isOwner = true;
        jobData = state;
      }
      if (!isOwner) {
        jobData = await findGenerationById(generationId);
        if (jobData && jobData.user_id === userId) {
          isOwner = true;
        }
      }
    } else if (guestId) {
      const state = await getJobState(generationId);
      if (state && state.guestId === guestId) {
        isOwner = true;
        jobData = state;
      }
    }

    if (!isOwner) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Generation job not found.' });
    }

    // Stream reconnection
    if (req.headers.accept?.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      let chunkIndex = 0;
      const initialChunks = await getSafeJobChunks(generationId, 0, false);
      for (const chunk of initialChunks) {
        chunkIndex++;
        if (chunk) res.write(formatSSE(chunk));
      }

      const currentState = (await getJobState(generationId)) || jobData;

      if (currentState?.status === 'COMPLETED') {
        res.write(formatSSE({ text: currentState.output_text, scores: currentState.scores, isTerminal: true, status: 'COMPLETED' }));
        res.write(formatSSEDone());
        return res.end();
      }

      if (isTerminalStatus(currentState?.status)) {
        if (currentState?.status === 'FAILED') {
          res.write(formatSSE({ error: currentState.error || 'Generation failed', isTerminal: true, status: 'FAILED' }));
        } else if (currentState?.status === 'CANCELLED') {
          res.write(formatSSE({ status: 'CANCELLED', error: 'Generation was cancelled', isTerminal: true }));
        }
        res.write(formatSSEDone());
        return res.end();
      }

      // DO NOT res.end() when non-terminal! Observer remains attached until terminal status or transport timeout.
      const observerStartTime = Date.now();
      const transportTimeoutMs = Number(req._transportTimeoutMs) || TRANSPORT_HANDOFF_TIMEOUT_MS;
      let isDone = false;

      while (Date.now() - observerStartTime < transportTimeoutMs) {
        if (!isSocketWritable(req, res)) break;

        const newChunks = await getSafeJobChunks(generationId, chunkIndex, false);
        if (newChunks && newChunks.length > 0) {
          for (const chunk of newChunks) {
            chunkIndex++;
            if (isSocketWritable(req, res) && chunk) {
              res.write(formatSSE(chunk));
            }
          }
        }

        const latestState = await getJobState(generationId);
        if (latestState?.status === 'COMPLETED') {
          if (isSocketWritable(req, res)) {
            res.write(formatSSE({ text: latestState.output_text, scores: latestState.scores, isTerminal: true, status: 'COMPLETED' }));
            res.write(formatSSEDone());
            res.end();
          }
          isDone = true;
          return;
        } else if (latestState?.status === 'FAILED') {
          if (isSocketWritable(req, res)) {
            res.write(formatSSE({ error: latestState.error || 'Generation failed', isTerminal: true, status: 'FAILED' }));
            res.write(formatSSEDone());
            res.end();
          }
          isDone = true;
          return;
        } else if (latestState?.status === 'CANCELLED') {
          if (isSocketWritable(req, res)) {
            res.write(formatSSE({ status: 'CANCELLED', error: 'Generation was cancelled', isTerminal: true }));
            res.write(formatSSEDone());
            res.end();
          }
          isDone = true;
          return;
        }

        await new Promise((r) => setTimeout(r, 600));
      }

      if (!isDone) {
        if (isSocketWritable(req, res)) {
          res.write(formatSSE({
            event: 'handoff',
            status: 'OBSERVING',
            generationId,
            jobId: generationId,
            statusUrl: `/api/generate?jobId=${generationId}`,
            handoff: true,
          }));
          res.write(formatSSEDone());
          return res.end();
        }
        return;
      }
    }

    return res.status(200).json({
      generationId,
      status: jobData?.status || 'RUNNING',
      output: jobData?.output_text || null,
      scores: jobData?.scores || {},
    });
  }

  // ── ACTION: CANCELLATION (POST ?action=cancel) ──────────────────────────
  if (req.method === 'POST' && req.query?.action === 'cancel') {
    const generationId = String(req.query?.jobId || '');
    if (!generationId) {
      return res.status(400).json({ error: 'MISSING_JOB_ID' });
    }

    let isOwner = false;
    if (userId) {
      const row = await findGenerationById(generationId);
      if (row && row.user_id === userId) isOwner = true;
    } else if (guestId) {
      const state = await getJobState(generationId);
      if (state && state.guestId === guestId) isOwner = true;
    }

    if (!isOwner) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Generation job not found.' });
    }

    await cancelJob(generationId);
    return res.status(200).json({ success: true, generationId, status: 'CANCELLED' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── ACTION: GENERATION EXECUTION ────────────────────────────────────────
  const idempotencyKey = req.headers['idempotency-key'] || req.body?.idempotencyKey;
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
    return res.status(400).json({
      error: 'MISSING_IDEMPOTENCY_KEY',
      message: 'Idempotency-Key header is required for generation requests.',
    });
  }

  const {
    prompt: rawPrompt,
    apiProvider = 'auto',
    mode = 'standard',
    task = 'humanize',
    userMemory = '',
    schemaMarkup,
    prosCons,
    affiliateLink,
    readabilityTarget,
    context: rawContext,
    vocab: directVocab,
    sentenceLength: directSentenceLength,
    useDebate,
    articleType,
    keywords,
    targetKeyword,
    secondaryKeywords,
    subTopics,
    audience,
    tone,
    writingStyle,
    location,
    geoTarget,
    faq,
    tableOfContents,
    callToAction,
    autoImagePrompts,
    toneUrl,
    length,
    productName,
    detectedType,
    uniqueAngle,
    targetPrice,
    competitors,
    ctaLabel,
    ctaIntensity,
    trustBadges,
    urgency,
    moneyBackGuarantee,
    starRatings,
    includeIngredients,
    includePricing,
  } = req.body || {};

  // Parse optional nested context (e.g. from Humanizer, Blog, or Affiliate)
  let parsedContext = {};
  if (typeof rawContext === 'string') {
    try {
      parsedContext = JSON.parse(rawContext);
    } catch (_) {}
  } else if (typeof rawContext === 'object' && rawContext !== null) {
    parsedContext = rawContext;
  }

  const vocab = directVocab || parsedContext.vocab || 'natural';
  const sentenceLength = directSentenceLength || parsedContext.sentenceLength || 'varied';

  const blogParams = {
    articleType: articleType || parsedContext.articleType || 'standard',
    keywords: keywords || parsedContext.seo?.keywords,
    targetKeyword: targetKeyword || parsedContext.seo?.targetKeyword,
    secondaryKeywords: secondaryKeywords || parsedContext.seo?.secondaryKeywords,
    subTopics: subTopics || parsedContext.content?.subTopics,
    audience: audience || parsedContext.content?.audience || 'General readers',
    tone: tone || parsedContext.content?.tone || 'informative',
    writingStyle: writingStyle || parsedContext.content?.writingStyle || 'engaging',
    readabilityTarget: readabilityTarget || parsedContext.content?.readabilityTarget || 'General Public',
    length: length || parsedContext.content?.length || '1200 words',
    location: location || parsedContext.demographics?.location,
    geoTarget: Boolean(geoTarget ?? parsedContext.demographics?.geoTarget),
    faq: Boolean(faq ?? parsedContext.features?.faq),
    tableOfContents: Boolean(tableOfContents ?? parsedContext.features?.tableOfContents),
    callToAction: Boolean(callToAction ?? parsedContext.features?.callToAction),
    autoImagePrompts: Boolean(autoImagePrompts ?? parsedContext.features?.autoImagePrompts),
    schemaMarkup: Boolean(schemaMarkup ?? parsedContext.features?.schemaMarkup ?? true),
    toneUrl: toneUrl || parsedContext.referenceToneUrl,
  };

  const affiliateParams = {
    productName: productName || parsedContext.productName || rawPrompt,
    type: detectedType || req.body?.type || parsedContext.type || 'general',
    niche: req.body?.niche || parsedContext.niche,
    keywords: keywords || parsedContext.keywords,
    uniqueAngle: uniqueAngle || parsedContext.uniqueAngle,
    targetPrice: targetPrice || parsedContext.targetPrice,
    competitors: competitors || parsedContext.competitors || [],
    ctaLabel: ctaLabel || parsedContext.cta?.label || 'Check Current Price',
    ctaIntensity: ctaIntensity || parsedContext.cta?.intensity || 'balanced',
    affiliateLink: affiliateLink || parsedContext.cta?.targetLink,
    location: location || parsedContext.demographics?.location,
    audience: audience || parsedContext.demographics?.audience || 'Target buyers',
    tone: tone || parsedContext.content?.tone || 'persuasive',
    length: length || parsedContext.content?.length || '1200 words',
    trustBadges: Boolean(trustBadges ?? parsedContext.content?.trustBadges),
    urgency: Boolean(urgency ?? parsedContext.content?.urgency),
    moneyBackGuarantee: Boolean(moneyBackGuarantee ?? parsedContext.content?.moneyBackGuarantee),
    starRatings: Boolean(starRatings ?? parsedContext.content?.starRatings),
    includeIngredients: Boolean(includeIngredients ?? parsedContext.content?.includeIngredients),
    includePricing: Boolean(includePricing ?? parsedContext.content?.includePricing),
    schemaMarkup: Boolean(schemaMarkup ?? parsedContext.content?.schemaMarkup ?? true),
    prosCons: Boolean(prosCons ?? parsedContext.content?.prosConsMatrix ?? true),
  };

  const fullMetadata = {
    userMemory,
    vocab,
    sentenceLength,
    useDebate: Boolean(useDebate),
    ...(task === 'blog' ? blogParams : {}),
    ...(task === 'affiliate' ? affiliateParams : {}),
  };

  const inputText = clean(rawPrompt);
  if (!inputText) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const keyHash = hashKey(idempotencyKey);
  const requestHash = hashRequest({ task, mode, inputText, apiProvider });

  // ── CONTRACT: IDEMPOTENT SCORING (/score) ──────────────────────────────────
  if (task === 'score') {
    // 1. Check if active idempotency record already exists for this score request
    const existingScoreRecord = await getIdempotencyRecord(principalId, keyHash);
    if (existingScoreRecord) {
      if (existingScoreRecord.requestHash !== requestHash) {
        return res.status(409).json({
          error: 'IDEMPOTENCY_KEY_REUSE',
          message: 'This idempotency key was previously used with different parameters.',
        });
      }
      if (existingScoreRecord.scoreResult) {
        return res.status(200).json({
          ...existingScoreRecord.scoreResult,
          replayed: true,
        });
      }
    }

    // 2. Enforce scoring rate limit only for fresh, un-cached scoring calculations
    const scoreRateLimitKey = userId ? `user_${userId}` : `ip_${getClientIp(req)}`;
    const scoreLimit = userId ? 60 : 15;
    const rlScore = await checkRateLimit('rl_user_scoring', scoreRateLimitKey, scoreLimit, 60);
    if (!rlScore.allowed) {
      return res.status(429).json({ error: rlScore.error });
    }

    // 3. Execute scoring with fallback provider resiliency
    const route = matchProviderAndModel({ task: 'score', inputText, requestedProvider: apiProvider });
    let scoreResult;
    try {
      scoreResult = await getProvider(route.actual_provider).score({ text: inputText });
    } catch (primaryErr) {
      console.warn(`[score] Primary provider ${route.actual_provider} failed: ${primaryErr.message}. Attempting fallback provider ${route.fallback_provider}...`);
      try {
        scoreResult = await getProvider(route.fallback_provider).score({ text: inputText });
      } catch (fallbackErr) {
        console.error(`[score] Both providers failed: primary=${primaryErr.message}, fallback=${fallbackErr.message}`);
        return res.status(503).json({
          error: 'SCORING_SERVICE_UNAVAILABLE',
          message: 'AI detection scoring is temporarily unavailable. Please try again shortly.',
        });
      }
    }

    // 4. Save completed score into idempotency record (TTL 120s) so retries do not duplicate work or charges
    const canonicalScoreResponse = {
      score: {
        score: scoreResult.humanScore,
        humanScore: scoreResult.humanScore,
        aiScore: scoreResult.aiScore,
        breakdown: scoreResult.breakdown || {},
        signals: scoreResult.signals || {},
        reasoning: scoreResult.reasoning || [],
        actualModel: scoreResult.actualModel,
      },
      humanScore: scoreResult.humanScore,
      aiScore: scoreResult.aiScore,
      breakdown: scoreResult.breakdown || {},
      signals: scoreResult.signals || {},
      reasoning: scoreResult.reasoning || [],
      actualModel: scoreResult.actualModel,
    };

    await completeIdempotencyKey(
      principalId,
      keyHash,
      {
        task: 'score',
        requestHash,
        scoreResult: canonicalScoreResponse,
        status: 'COMPLETED',
      },
      { guestId }
    );

    return res.status(200).json(canonicalScoreResponse);
  }

  // 1. Check Redis Active Idempotency Record
  const activeRecord = await getIdempotencyRecord(principalId, keyHash);
  if (activeRecord) {
    if (activeRecord.requestHash !== requestHash) {
      return res.status(409).json({
        error: 'IDEMPOTENCY_KEY_REUSE',
        message: 'This idempotency key was previously used with different parameters.',
      });
    }

    if (activeRecord.status === 'COMPLETED') {
      if (req.headers.accept?.includes('application/json') && !req.headers.accept?.includes('text/event-stream')) {
        return res.status(200).json({
          generationId: activeRecord.generationId,
          output: activeRecord.output_text,
          text: activeRecord.output_text,
          scores: activeRecord.scores,
          replayed: true,
          status: 'COMPLETED',
        });
      }

      // Replay completed result directly via SSE with zero credits and zero LLM calls
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      if (activeRecord.scores?.inputScore) {
        res.write(formatSSE({ inputScore: activeRecord.scores.inputScore }));
      }
      res.write(formatSSE({ text: activeRecord.output_text, scores: activeRecord.scores, replayed: true }));
      res.write(formatSSEDone());
      return res.end();
    }

    if (activeRecord.status === 'IN_PROGRESS' || activeRecord.status === 'RUNNING') {
      if (req.headers.accept?.includes('application/json') && !req.headers.accept?.includes('text/event-stream')) {
        return res.status(202).json({
          statusUrl: `/api/generate?jobId=${activeRecord.generationId}`,
          generationId: activeRecord.generationId,
          idempotent: true,
          status: activeRecord.status,
        });
      }

      // Attach observer to active generation with server-side candidate isolation
      const chunks = await getSafeJobChunks(activeRecord.generationId, 0, false);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      for (const chunk of chunks) {
        if (chunk) res.write(formatSSE(chunk));
      }
      return res.end();
    }
  }

  // 2. Check Tombstone / Durable Fallback
  if (!activeRecord) {
    if (guestId) {
      const isTombstoned = await getGuestTombstone(guestId, keyHash);
      if (isTombstoned) {
        return res.status(400).json({
          error: 'IDEMPOTENCY_KEY_EXPIRED',
          message: 'This idempotency key has expired. Please generate a new key.',
        });
      }
    } else if (userId) {
      const dbRow = await findGenerationByUserAndIdempotencyKey(userId, idempotencyKey);
      if (dbRow) {
        if (isTerminalStatus(dbRow.status)) {
          if (req.headers.accept?.includes('application/json') && !req.headers.accept?.includes('text/event-stream')) {
            return res.status(200).json({
              generationId: dbRow.id,
              output: dbRow.output_text,
              text: dbRow.output_text,
              scores: dbRow.scores,
              status: dbRow.status,
              replayed: true,
            });
          }

          // Replay terminal result from database
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('X-Accel-Buffering', 'no');

          if (dbRow.status === 'COMPLETED') {
            res.write(formatSSE({ text: dbRow.output_text, scores: dbRow.scores, replayed: true }));
          } else {
            res.write(formatSSE({ status: dbRow.status, replayed: true, error: `Generation is in terminal state: ${dbRow.status}` }));
          }
          res.write(formatSSEDone());
          return res.end();
        }

        // Non-terminal: Reconstruct active idempotency mapping in Redis and attach observer
        await reserveIdempotencyKey(principalId, keyHash, dbRow.id, requestHash, 120);

        if (req.headers.accept?.includes('application/json') && !req.headers.accept?.includes('text/event-stream')) {
          return res.status(202).json({
            statusUrl: `/api/generate?jobId=${dbRow.id}`,
            generationId: dbRow.id,
            idempotent: true,
            status: dbRow.status,
          });
        }

        // Attach observer to existing generation without debiting new credit
        const chunks = await getSafeJobChunks(dbRow.id, 0, false);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        for (const chunk of chunks) {
          if (chunk) res.write(formatSSE(chunk));
        }
        res.write(formatSSEDone());
        return res.end();
      }
    }
  }

  // 3. Atomically Admit Generation Quota
  const generationId = crypto.randomUUID();
  const admission = await admitGeneration({
    principalId,
    generationId,
    maxCredits: userId ? 30 : 5,
    windowSeconds: 60,
  });

  if (!admission.admitted) {
    return res.status(429).json({ error: admission.error });
  }

  // 4. Reserve Idempotency Key
  await reserveIdempotencyKey(principalId, keyHash, generationId, requestHash, 120);

  const historyType = task === 'humanize' ? 'penshift_history_humanizer' : (task === 'score' ? 'penshift_history_score' : 'penshift_history');

  // If authenticated user: create initial durable record in Supabase
  if (userId) {
    await persistGenerationRow({
      id: generationId,
      user_id: userId,
      idempotency_key: idempotencyKey,
      type: historyType,
      task,
      requested_mode: mode,
      requested_provider: apiProvider,
      input_text: inputText,
      input_word_count: countWords(inputText),
      metadata: fullMetadata,
      status: 'RUNNING',
    });
  }

  // ── ACTION: QSTASH ASYNC QUEUE DISPATCH (PRODUCTION FLOW) ────────────────
  const isProduction = process.env.NODE_ENV === 'production' || process.env.PENSHIFT_DEV_MODE !== 'true';

  if (isProduction && !process.env.QSTASH_TOKEN) {
    return res.status(503).json({
      error: 'ASYNC_QUEUE_UNAVAILABLE',
      message: 'Production async processing queue (QStash) is not configured.',
    });
  }

  // Set SSE Headers if streaming is requested
  const wantsSSE = !req.headers.accept?.includes('application/json') || req.headers.accept?.includes('text/event-stream');
  if (wantsSSE) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
  }

  if (process.env.QSTASH_TOKEN) {
    await setJobState(generationId, {
      status: 'QUEUED',
      generationId,
      guestId,
      userId,
      createdAt: Date.now(),
    }).catch(() => {});

    if (wantsSSE) {
      res.write(formatSSE({ status: 'QUEUED', generationId, event: 'status' }));
    }

    const dispatchResult = await dispatchGenerationToQStash({
      generationId,
      principalId,
      userId,
      guestId,
      idempotencyKey,
      task,
      mode,
      inputText,
      requestedProvider: apiProvider,
      metadata: fullMetadata,
    });

    if (!dispatchResult.success) {
      if (isProduction) {
        console.error(`[generate] QStash dispatch error in production: ${dispatchResult.error}`);
        if (!wantsSSE) {
          return res.status(503).json({
            error: 'QUEUE_DISPATCH_FAILED',
            message: 'Failed to enqueue generation task to worker queue.',
          });
        }
        res.write(formatSSE({ error: 'Failed to enqueue generation task to worker queue.' }));
        res.write(formatSSEDone());
        return res.end();
      }
      console.warn(`[generate] QStash dispatch error in dev mode: ${dispatchResult.error}. Proceeding with direct generation pipeline.`);
    } else {
      // If client asked for JSON (e.g. status URL probe), return 202 Accepted immediately
      if (!wantsSSE) {
        return res.status(202).json({
          statusUrl: `/api/generate?jobId=${generationId}`,
          generationId,
          status: 'QUEUED',
        });
      }

      res.write(formatSSE({ status: 'DISPATCHING', generationId, event: 'status', statusUrl: `/api/generate?jobId=${generationId}` }));

      let chunkIndex = 0;
      const startTime = Date.now();
      const maxWaitMs = Number(req._transportTimeoutMs) || TRANSPORT_HANDOFF_TIMEOUT_MS;
      let isDone = false;

      while (Date.now() - startTime < maxWaitMs) {
        if (!isSocketWritable(req, res)) break;

        const chunks = await getSafeJobChunks(generationId, chunkIndex, false);
        if (chunks && chunks.length > 0) {
          for (const chunk of chunks) {
            chunkIndex++;
            if (!isSocketWritable(req, res)) break;
            if (chunk.event === 'done') {
              res.write(formatSSE({ text: chunk.data?.text, scores: chunk.data?.scores, metadata: chunk.data?.metadata, isTerminal: true, status: 'COMPLETED' }));
              isDone = true;
              break;
            } else if (chunk.event === 'input_score') {
              res.write(formatSSE({ inputScore: chunk.data?.humanScore, scores: { inputScore: chunk.data?.humanScore } }));
            } else if (chunk.event === 'draft') {
              res.write(formatSSE({ status: 'Refining and polishing syntax...', event: 'status' }));
            } else if (chunk.event === 'output_score') {
              res.write(formatSSE({ outputScore: chunk.data?.humanScore, scores: chunk.data }));
            } else {
              res.write(formatSSE(chunk));
            }
          }
        }

        if (isDone) break;

        const state = await getJobState(generationId);
        if (state?.status === 'COMPLETED') {
          if (isSocketWritable(req, res)) {
            res.write(formatSSE({ text: state.output_text, scores: state.scores, isTerminal: true, status: 'COMPLETED' }));
          }
          isDone = true;
          break;
        } else if (state?.status === 'FAILED') {
          if (isSocketWritable(req, res)) {
            res.write(formatSSE({ error: state.error || 'Worker generation failed', isTerminal: true, status: 'FAILED' }));
          }
          isDone = true;
          break;
        } else if (state?.status === 'CANCELLED') {
          if (isSocketWritable(req, res)) {
            res.write(formatSSE({ status: 'CANCELLED', error: 'Generation was cancelled', isTerminal: true }));
          }
          isDone = true;
          break;
        }

        await new Promise((r) => setTimeout(r, 600));
      }

      if (!isDone) {
        if (isSocketWritable(req, res)) {
          res.write(formatSSE({
            event: 'handoff',
            status: 'OBSERVING',
            generationId,
            jobId: generationId,
            statusUrl: `/api/generate?jobId=${generationId}`,
            handoff: true,
          }));
          res.write(formatSSEDone());
          return res.end();
        }
        return;
      }
      if (isSocketWritable(req, res)) {
        res.write(formatSSEDone());
        return res.end();
      }
      return;
    }
  }

  // ── ACTION: DIRECT GENERATION PIPELINE (LOCAL DEV & RESILIENT FALLBACK) ────
  const route = matchProviderAndModel({
    task,
    mode,
    inputText,
    requestedProvider: apiProvider,
  });

  const activeProvider = getProvider(route.actual_provider);
  const fallbackProvider = getProvider(route.fallback_provider);

  try {
    // ── STAGE 1: Server-Side Pre-Scoring ──
    res.write(formatSSE({ status: 'Analyzing AI stylometry...', event: 'status' }));
    let inputScore = null;
    try {
      inputScore = await activeProvider.score({ text: inputText });
    } catch (_) {
      try {
        inputScore = await fallbackProvider.score({ text: inputText });
      } catch (__) {
        inputScore = { score: null, humanScore: null, aiScore: null, unavailable: true };
      }
    }

    if (inputScore?.humanScore != null) {
      res.write(formatSSE({ inputScore: inputScore.humanScore, scores: { inputScore: inputScore.humanScore } }));
    }

    let cleanedText = '';
    let finalQualityMetrics = {};
    let finalDiffArtifact = null;

    if (task === 'humanize') {
      // ═══════════════ GOD-LEVEL HUMANIZER SEMANTIC PIPELINE ═══════════════
      res.write(formatSSE({ status: 'ANALYZING', generationId, message: 'Analyzing semantic invariants & constructing fact lock...', event: 'status' }));
      await setJobState(generationId, { status: 'RUNNING', generationId, guestId, userId }).catch(() => {});
      const sourceEnvelope = buildSourceEnvelope(inputText, fullMetadata);
      const riskProfile = classifySemanticRisk(sourceEnvelope);
      const terminologyMap = buildTerminologyMap(inputText);
      const styleProfile = buildStyleProfile(inputText, fullMetadata);

      res.write(formatSSE({ status: 'DRAFTING', message: 'Synthesizing authentic human cadence with proposition preservation...', event: 'status' }));
      const promptPayload = buildStructuredHumanizerBrief(sourceEnvelope, styleProfile, riskProfile, {
        mode,
        vocab,
        sentenceLength,
        userMemory,
      });

      let genResult;
      try {
        genResult = await activeProvider.generate({
          prompt: promptPayload,
          model: route.actual_model,
          temperature: mode === 'aggressive' ? 0.82 : (mode === 'formal' ? 0.65 : 0.72),
        });
      } catch (err) {
        console.warn('[generate] Primary provider failed in direct draft, attempting fallback:', err.message);
        genResult = await fallbackProvider.generate({
          prompt: promptPayload,
          model: route.fallback_model,
          temperature: 0.7,
        });
      }

      const draftText = cleanOutput(genResult.text);

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

      // Server-side buffering: Candidate tokens are NOT streamed as authoritative text until semantic release gate passes
      res.write(formatSSE({ status: 'VERIFYING', message: 'Conducting proposition-level semantic audit...', event: 'status' }));
      const auditResult = await evaluateQualityGateAsync(sourceEnvelope, draftText, styleProfile, auditOptions);

      let candidateText = draftText;
      if (!auditResult.accepted) {
        res.write(formatSSE({ status: 'REFINING', message: 'Repairing candidate against source truth invariants...', event: 'status' }));
        const critique = buildActionableCritique(auditResult.violations);
        const refinePrompt = buildRefinementPrompt(sourceEnvelope, draftText, critique, { mode });
        try {
          const refineGen = await activeProvider.generate({
            prompt: refinePrompt,
            model: route.actual_model,
            temperature: 0.65,
          });
          candidateText = cleanOutput(refineGen.text);
        } catch (_) {
          try {
            const fallbackRefine = await fallbackProvider.generate({
              prompt: refinePrompt,
              model: route.fallback_model,
              temperature: 0.65,
            });
            candidateText = cleanOutput(fallbackRefine.text);
          } catch (__) {
            candidateText = draftText;
          }
        }
      }

      res.write(formatSSE({ status: 'FINAL_AUDIT', message: 'Executing final document-level audit...', event: 'status' }));
      const finalAudit = await evaluateQualityGateAsync(sourceEnvelope, candidateText, styleProfile, auditOptions);
      finalDiffArtifact = buildSemanticDiffArtifact(sourceEnvelope, candidateText, finalAudit);

      if (!finalAudit || finalAudit.accepted !== true || finalAudit.verdict !== 'PASS') {
        const violationTypes = (finalAudit?.violations || []).map((v) => v.type).slice(0, 5).join(', ');
        res.write(formatSSE({
          error: `FAILED_VALIDATION: Candidate failed semantic release gate [${violationTypes || 'CRITICAL_INVARIANT_VIOLATION'}]`,
          isTerminal: true,
          status: 'FAILED',
        }));
        res.write(formatSSEDone());
        return res.end();
      }

      cleanedText = candidateText;
      finalQualityMetrics = finalAudit.metrics || {};
    } else {
      // ═══════════════ BLOG & AFFILIATE PIPELINES ═══════════════
      res.write(formatSSE({ status: 'Synthesizing authentic human cadence...', event: 'status' }));

      let promptPayload;
      if (task === 'blog') {
        let researchContext = '';
        res.write(formatSSE({ status: 'Conducting live web research...', event: 'status' }));
        try {
          const searchResult = await performTavilyResearch(inputText);
          if (searchResult.ok && searchResult.results?.length > 0) {
            researchContext = searchResult.results.map((r, i) => `[Source ${i + 1}: ${r.title}](${r.url})\n${r.content}`).join('\n\n');
            res.write(formatSSE({ status: 'Incorporated real-time research sources...', event: 'status' }));
          }
        } catch (err) {
          console.warn('[blog] Tavily search skipped or failed:', err.message);
        }

        let toneSample = '';
        if (blogParams.toneUrl) {
          try {
            const rawSample = await safeFetchText(blogParams.toneUrl, { maxBytes: 50000, timeoutMs: 4000 });
            if (rawSample) toneSample = clean(rawSample).slice(0, 1000);
          } catch (e) {
            console.warn('[blog] Tone URL fetch skipped:', e.message);
          }
        }

        promptPayload = buildBlogPrompt(inputText, mode, {
          ...blogParams,
          researchContext,
          toneSample,
        });
      } else if (task === 'affiliate') {
        promptPayload = buildAffiliatePrompt(inputText, mode, affiliateParams);
      }

      const genResult = await activeProvider.generate({
        prompt: promptPayload,
        model: route.actual_model,
        temperature: mode === 'aggressive' ? 0.85 : (mode === 'formal' ? 0.65 : 0.72),
      });

      cleanedText = cleanOutput(genResult.text);
    }

    // Stream authoritative released tokens to client
    const tokenChunks = cleanedText.match(/.{1,40}/gs) || [cleanedText];
    for (const chunk of tokenChunks) {
      res.write(formatSSE({ text: chunk }));
    }

    // ── STAGE 3: Server-Side Post-Scoring (Zero Synthetic Swallowing) ──
    res.write(formatSSE({ status: 'Validating final human score...', event: 'status' }));
    let outputScore = null;
    try {
      outputScore = await activeProvider.score({ text: cleanedText });
    } catch (_) {
      try {
        outputScore = await fallbackProvider.score({ text: cleanedText });
      } catch (__) {
        outputScore = { score: null, humanScore: null, aiScore: null, unavailable: true };
      }
    }

    const finalScores = {
      inputScore: inputScore?.humanScore ?? null,
      outputScore: outputScore?.humanScore ?? null,
      aiScore: outputScore?.aiScore ?? null,
      unavailable: Boolean(outputScore?.unavailable),
      ...(Object.keys(finalQualityMetrics).length > 0 ? { qualityMetrics: finalQualityMetrics } : {}),
      ...(finalDiffArtifact ? { semanticStatus: finalDiffArtifact.semanticStatus, semanticConfidence: finalDiffArtifact.confidence } : {}),
    };

    res.write(formatSSE({
      generationId,
      outputScore: outputScore?.humanScore ?? null,
      scores: finalScores,
      metadata: {
        provider: route.actual_provider,
        model: route.actual_model,
      },
    }));

    // ── STAGE 4: Finalize Idempotency & Database Persistence ──
    await setJobState(generationId, {
      generationId,
      status: 'COMPLETED',
      output_text: cleanedText,
      scores: finalScores,
      provider: route.actual_provider,
      model: route.actual_model,
      guestId,
      userId,
    }).catch(() => {});
    await completeIdempotencyKey(
      principalId,
      keyHash,
      {
        generationId,
        requestHash,
        output_text: cleanedText,
        scores: finalScores,
        metadata: fullMetadata,
        actual_provider: route.actual_provider,
        actual_model: route.actual_model,
      },
      { guestId }
    );

    if (userId) {
      await persistGenerationRow({
        id: generationId,
        user_id: userId,
        idempotency_key: idempotencyKey,
        type: historyType,
        output_text: cleanedText,
        output_word_count: countWords(cleanedText),
        actual_provider: route.actual_provider,
        actual_model: route.actual_model,
        scores: finalScores,
        metadata: fullMetadata,
        status: 'COMPLETED',
      });
    }

    res.write(formatSSEDone());
    return res.end();
  } catch (err) {
    console.error(`[generate] Generation pipeline failed:`, err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'GENERATION_FAILED', message: err.message });
    }
    if (isSocketWritable(req, res)) {
      res.write(formatSSE({ error: err.message || 'Generation failed midway.' }));
      res.write(formatSSEDone());
      return res.end();
    }
    return;
  }
} catch (err) {
  if (err instanceof RedisUnavailableError || err.name === 'RedisUnavailableError' || err.code === 'REDIS_UNAVAILABLE') {
    console.error(`[generate] Service Unavailable (Redis):`, err.message);
    if (res.headersSent) {
      if (isSocketWritable(req, res)) {
        res.write(formatSSE({ error: 'Service Unavailable: Redis infrastructure failure', code: 'REDIS_UNAVAILABLE' }));
        res.write(formatSSEDone());
        return res.end();
      }
      return;
    }
    return res.status(503).json({
      error: 'REDIS_UNAVAILABLE',
      message: 'Distributed infrastructure service unavailable. Please retry shortly.',
    });
  }
  console.error(`[generate] Top-level handler failure:`, err);
  if (!res.headersSent) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
  if (isSocketWritable(req, res)) {
    res.write(formatSSE({ error: err.message || 'Operation failed.' }));
    res.write(formatSSEDone());
    return res.end();
  }
  return;
}
}
