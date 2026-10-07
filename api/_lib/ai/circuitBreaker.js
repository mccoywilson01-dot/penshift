import crypto from 'crypto';
import { Redis } from '@upstash/redis';

let redisClient = null;

function getRedis() {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    redisClient = new Redis({ url, token });
    return redisClient;
  }
  return null;
}

const KEY_POOLS = {
  gemini: {
    keys: [],
    failures: [],
    lastFail: [],
    retryAfter: [],
    cooldown: 60000,
  },
  groq: {
    keys: [],
    failures: [],
    lastFail: [],
    retryAfter: [],
    cooldown: 60000,
  },
};

let poolsInitialized = false;

export function initPools() {
  if (poolsInitialized) return;

  const g1 = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
  const g2 = process.env.GEMINI_API_KEY_2;
  const gr1 = process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY;
  const gr2 = process.env.GROQ_API_KEY_2;

  KEY_POOLS.gemini.keys = [];
  KEY_POOLS.groq.keys = [];

  if (g1) KEY_POOLS.gemini.keys.push(g1);
  if (g2) KEY_POOLS.gemini.keys.push(g2);
  if (gr1) KEY_POOLS.groq.keys.push(gr1);
  if (gr2) KEY_POOLS.groq.keys.push(gr2);

  KEY_POOLS.gemini.keys = [...new Set(KEY_POOLS.gemini.keys)];
  KEY_POOLS.groq.keys = [...new Set(KEY_POOLS.groq.keys)];

  const gLen = KEY_POOLS.gemini.keys.length;
  KEY_POOLS.gemini.failures = new Array(gLen).fill(0);
  KEY_POOLS.gemini.lastFail = new Array(gLen).fill(0);
  KEY_POOLS.gemini.retryAfter = new Array(gLen).fill(0);

  const grLen = KEY_POOLS.groq.keys.length;
  KEY_POOLS.groq.failures = new Array(grLen).fill(0);
  KEY_POOLS.groq.lastFail = new Array(grLen).fill(0);
  KEY_POOLS.groq.retryAfter = new Array(grLen).fill(0);

  poolsInitialized = true;
}

/**
 * Gets next operational key for a provider.
 */
export async function getNextKey(provider) {
  initPools();
  const pool = KEY_POOLS[provider];
  if (!pool || pool.keys.length === 0) return null;

  const now = Date.now();
  const startIndex = Math.floor(Math.random() * pool.keys.length);

  for (let attempt = 0; attempt < pool.keys.length; attempt++) {
    const idx = (startIndex + attempt) % pool.keys.length;
    let waitTime = 0;

    // Check local memory failures
    if (pool.failures[idx] >= 3) {
      const elapsed = now - pool.lastFail[idx];
      const requiredCooldown = pool.retryAfter[idx] || pool.cooldown;
      if (elapsed < requiredCooldown) {
        waitTime = requiredCooldown - elapsed;
      } else {
        // Cooldown passed, decay failures
        pool.failures[idx] = 0;
      }
    }

    // Check Redis state for cross-worker synchronization
    const redis = getRedis();
    if (waitTime === 0 && redis && pool.keys[idx]) {
      try {
        const keyHash = crypto.createHash('sha256').update(pool.keys[idx]).digest('hex').substring(0, 16);
        const inCooldown = await redis.get(`cooldown:${provider}:${keyHash}`);
        if (inCooldown) {
          waitTime = pool.cooldown;
        }
      } catch (e) {
        // Fallback to local state if Redis lookup fails
        waitTime = 0;
      }
    }

    if (waitTime === 0) {
      return { key: pool.keys[idx], index: idx };
    }
  }

  return null;
}

/**
 * Marks a key as failed, applying backoff cooldown locally and in Redis.
 */
export async function markKeyFailed(provider, index, isRateLimit = false, retryAfterMs = null) {
  initPools();
  const pool = KEY_POOLS[provider];
  if (!pool || !pool.keys[index]) return;

  pool.failures[index] += isRateLimit ? 3 : 1;
  pool.lastFail[index] = Date.now();
  const cooldownDuration = retryAfterMs || pool.cooldown;
  pool.retryAfter[index] = cooldownDuration;

  const redis = getRedis();
  if (redis && isRateLimit && pool.keys[index]) {
    try {
      const keyHash = crypto.createHash('sha256').update(pool.keys[index]).digest('hex').substring(0, 16);
      await redis.set(`cooldown:${provider}:${keyHash}`, '1', { px: cooldownDuration });
    } catch (e) {
      console.warn(`[circuitBreaker] Redis sync set failure for key cooldown: ${e.message}`);
    }
  }
}

/**
 * Decrements failure counter upon successful response.
 */
export function markKeySuccess(provider, index) {
  initPools();
  const pool = KEY_POOLS[provider];
  if (pool && pool.failures[index] > 0) {
    pool.failures[index] = Math.max(0, pool.failures[index] - 1);
  }
}

/**
 * Returns operational health status for all keys in provider.
 */
export function getProviderHealth(provider) {
  initPools();
  const pool = KEY_POOLS[provider];
  if (!pool || pool.keys.length === 0) {
    return { available: false, totalKeys: 0, healthyKeys: 0 };
  }
  const healthyKeys = pool.failures.filter((f) => f < 3).length;
  return {
    available: healthyKeys > 0,
    totalKeys: pool.keys.length,
    healthyKeys,
  };
}
