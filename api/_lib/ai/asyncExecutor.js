import { getRedis, isProductionMode, RedisUnavailableError } from '../redisConfig.js';

export const CANONICAL_WORKER_URL = process.env.PENSHIFT_QSTASH_WORKER_URL || 'https://penshift.com/api/_internal/worker/generation';

/**
 * Dispatches an asynchronous generation task to Upstash QStash.
 * Strictly adheres to QStash contract:
 * - 200 OK + messageId: Successful fresh publish
 * - 202 Accepted + messageId + deduplicated: true: Successful deduplicated publish within 10-min window
 */
export async function dispatchGenerationToQStash(generationPayload) {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    return {
      success: false,
      error: 'QSTASH_TOKEN_NOT_CONFIGURED',
      message: 'QStash token is missing from environment. Async queue unavailable.',
    };
  }

  const { generationId } = generationPayload;
  if (!generationId) {
    throw new Error('generationId is required for QStash dispatch');
  }

  const targetUrl = CANONICAL_WORKER_URL;
  const qstashBase = (process.env.QSTASH_URL || 'https://qstash.upstash.io').replace(/\/+$/, '');
  const qstashEndpoint = `${qstashBase}/v2/publish/${targetUrl}`;

  try {
    const res = await fetch(qstashEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Upstash-Deduplication-Id': generationId,
        'Upstash-Retries': '2',
        'Upstash-Timeout': '290s',
      },
      body: JSON.stringify(generationPayload),
    });

    const rawText = await res.text().catch(() => '');
    let data = {};
    try {
      data = JSON.parse(rawText);
    } catch (_) {}

    if ((res.status === 200 || res.status === 201) && data?.messageId) {
      return {
        success: true,
        status: res.status,
        messageId: data.messageId,
        deduplicated: false,
      };
    }

    if (res.status === 202 && data?.messageId) {
      return {
        success: true,
        status: 202,
        messageId: data.messageId,
        deduplicated: Boolean(data.deduplicated),
      };
    }

    return {
      success: false,
      status: res.status,
      error: `QStash publish returned unexpected HTTP ${res.status}: ${rawText}`,
    };
  } catch (err) {
    return {
      success: false,
      error: `QStash network error: ${err.message}`,
    };
  }
}

const memoryJobState = new Map();
const memoryJobChunks = new Map();

/**
 * Publishes progress token/event to the generation's progress list in Redis.
 */
export async function pushJobChunk(generationId, chunk, ttlSeconds = 3600) {
  const redis = getRedis();

  if (isProductionMode()) {
    if (!redis) {
      throw new RedisUnavailableError('Redis is required for streaming job chunks in production mode');
    }
    try {
      const key = `job:stream:${generationId}`;
      await redis.rpush(key, JSON.stringify(chunk));
      await redis.expire(key, ttlSeconds);
      return;
    } catch (err) {
      throw new RedisUnavailableError(`Failed to push chunk for ${generationId} in production: ${err.message}`);
    }
  }

  // Memory fallback (dev/test mode only)
  if (!memoryJobChunks.has(generationId)) {
    memoryJobChunks.set(generationId, []);
  }
  memoryJobChunks.get(generationId).push(chunk);

  if (redis) {
    try {
      const key = `job:stream:${generationId}`;
      await redis.rpush(key, JSON.stringify(chunk));
      await redis.expire(key, ttlSeconds);
    } catch (err) {
      console.warn(`[asyncExecutor] Failed to push chunk for ${generationId}:`, err.message);
    }
  }
}

/**
 * Reads stream chunks starting from index for an active generation.
 */
export async function getJobChunks(generationId, startIndex = 0) {
  const redis = getRedis();

  if (isProductionMode()) {
    if (!redis) {
      throw new RedisUnavailableError('Redis is required for reading job chunks in production mode');
    }
    try {
      const key = `job:stream:${generationId}`;
      const rawList = await redis.lrange(key, startIndex, -1);
      if (Array.isArray(rawList) && rawList.length > 0) {
        return rawList.map((item) => (typeof item === 'string' ? JSON.parse(item) : item));
      }
      return [];
    } catch (err) {
      throw new RedisUnavailableError(`Failed to read chunks for ${generationId} in production: ${err.message}`);
    }
  }

  if (redis) {
    try {
      const key = `job:stream:${generationId}`;
      const rawList = await redis.lrange(key, startIndex, -1);
      if (Array.isArray(rawList) && rawList.length > 0) {
        return rawList.map((item) => (typeof item === 'string' ? JSON.parse(item) : item));
      }
    } catch (err) {
      console.warn(`[asyncExecutor] Failed to read chunks for ${generationId}:`, err.message);
    }
  }

  // Memory fallback (dev/test mode only)
  const memChunks = memoryJobChunks.get(generationId) || [];
  return memChunks.slice(startIndex);
}

/**
 * Sanitizes a single stream chunk for client replay.
 * Ensures unvalidated candidate text is never transmitted before authoritative release.
 */
export function sanitizeJobChunkForReplay(chunk, isAuthoritativelyReleased = false) {
  if (!chunk || typeof chunk !== 'object') return null;

  // If generation is not authoritatively released, strip all candidate/draft text
  if (!isAuthoritativelyReleased) {
    if (chunk.event === 'draft') {
      return { status: chunk.data?.status || 'Refining and polishing syntax...', event: 'status', stage: 'DRAFT' };
    }
    if (chunk.event === 'done') {
      // Suppress unvalidated done events completely before authoritative pass
      return null;
    }
    if (chunk.candidateText || chunk.stage === 'DRAFT') {
      const sanitized = { ...chunk };
      delete sanitized.candidateText;
      return sanitized;
    }
    return chunk;
  }

  // If authoritatively released: allow completed events
  return chunk;
}

/**
 * Safely reads stream chunks starting from index with server-side candidate text isolation.
 */
export async function getSafeJobChunks(generationId, startIndex = 0, isAuthoritativelyReleased = false) {
  const rawChunks = await getJobChunks(generationId, startIndex);
  if (!Array.isArray(rawChunks) || rawChunks.length === 0) return [];
  return rawChunks
    .map((c) => sanitizeJobChunkForReplay(c, isAuthoritativelyReleased))
    .filter(Boolean);
}

/**
 * Sets current generation job state in Redis.
 */
export async function setJobState(generationId, state, ttlSeconds = 86400) {
  const redis = getRedis();

  if (isProductionMode()) {
    if (!redis) {
      throw new RedisUnavailableError('Redis is required for setting job state in production mode');
    }
    try {
      const key = `job:state:${generationId}`;
      await redis.set(key, JSON.stringify(state), { ex: ttlSeconds });
      return;
    } catch (err) {
      throw new RedisUnavailableError(`Failed to set job state for ${generationId} in production: ${err.message}`);
    }
  }

  // Memory fallback (dev/test mode only)
  memoryJobState.set(generationId, { ...state, updatedAt: Date.now() });

  if (redis) {
    try {
      const key = `job:state:${generationId}`;
      await redis.set(key, JSON.stringify(state), { ex: ttlSeconds });
    } catch (err) {
      console.warn(`[asyncExecutor] Failed to set job state for ${generationId}:`, err.message);
    }
  }
}

/**
 * Gets current generation job state from Redis.
 */
export async function getJobState(generationId) {
  const redis = getRedis();

  if (isProductionMode()) {
    if (!redis) {
      throw new RedisUnavailableError('Redis is required for reading job state in production mode');
    }
    try {
      const key = `job:state:${generationId}`;
      const data = await redis.get(key);
      if (data) {
        return typeof data === 'string' ? JSON.parse(data) : data;
      }
      return null;
    } catch (err) {
      throw new RedisUnavailableError(`Failed to get job state for ${generationId} in production: ${err.message}`);
    }
  }

  if (redis) {
    try {
      const key = `job:state:${generationId}`;
      const data = await redis.get(key);
      if (data) {
        return typeof data === 'string' ? JSON.parse(data) : data;
      }
    } catch (err) {
      console.warn(`[asyncExecutor] Failed to get job state for ${generationId}:`, err.message);
    }
  }

  // Memory fallback (dev/test mode only)
  return memoryJobState.get(generationId) || null;
}
