import { getRedis, isProductionMode, RedisUnavailableError } from '../redisConfig.js';

const inMemoryStages = new Map();
const inMemoryLocks = new Map();

function getStageKey(generationId, stageName, guestId = null) {
  if (guestId) {
    return `stage:done:guest:${guestId}:${generationId}:${stageName}`;
  }
  return `stage:done:${generationId}:${stageName}`;
}

function getLockKey(generationId, stageName, guestId = null) {
  if (guestId) {
    return `stage:lock:guest:${guestId}:${generationId}:${stageName}`;
  }
  return `stage:lock:${generationId}:${stageName}`;
}

/**
 * Retrieves a previously completed stage result if one exists.
 * Returns null if the stage has not been checkpointed.
 */
export async function getStageResult(generationId, stageName, options = {}) {
  const { guestId = null } = options;
  const key = getStageKey(generationId, stageName, guestId);
  const redis = getRedis();

  if (redis) {
    try {
      const data = await redis.get(key);
      if (data) {
        return typeof data === 'string' ? JSON.parse(data) : data;
      }
      return null;
    } catch (err) {
      if (isProductionMode()) {
        throw new RedisUnavailableError(`Redis getStageResult error for ${key} in production: ${err?.message}`);
      }
      console.warn(`[stageCheckpoint] Redis getStageResult error for ${key}:`, err?.message);
    }
  } else if (isProductionMode()) {
    throw new RedisUnavailableError('Redis is required for distributed stage checkpoints in production mode');
  }

  // Memory fallback (dev/test mode only)
  if (isProductionMode()) return null;
  const mem = inMemoryStages.get(key);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.data;
  }
  return null;
}

/**
 * Claims execution ownership for a given stage using a distributed lock.
 * Returns true if the lease was acquired, or false if another worker holds the lock.
 */
export async function claimStageExecution(generationId, stageName, workerId, leaseSeconds = 60, options = {}) {
  const { guestId = null } = options;
  const key = getLockKey(generationId, stageName, guestId);
  const redis = getRedis();

  if (redis) {
    try {
      // SET key workerId NX EX leaseSeconds
      const res = await redis.set(key, workerId || 'worker', {
        nx: true,
        ex: leaseSeconds,
      });
      return res === 'OK' || res === true;
    } catch (err) {
      if (isProductionMode()) {
        throw new RedisUnavailableError(`Redis claimStageExecution error for ${key} in production: ${err?.message}`);
      }
      console.warn(`[stageCheckpoint] Redis claimStageExecution error for ${key}:`, err?.message);
    }
  } else if (isProductionMode()) {
    throw new RedisUnavailableError('Redis is required for distributed stage locking in production mode');
  }

  // In-memory fallback (dev/test mode only)
  if (isProductionMode()) {
    throw new RedisUnavailableError('Process-local Map fallback for stage locking is prohibited in production mode');
  }

  const now = Date.now();
  const existing = inMemoryLocks.get(key);
  if (existing && existing.expiresAt > now) {
    return false;
  }
  inMemoryLocks.set(key, { workerId, expiresAt: now + leaseSeconds * 1000 });
  return true;
}

/**
 * Persists the result of a completed stage checkpoint.
 */
export async function persistStageResult(generationId, stageName, output, options = {}) {
  const { guestId = null, ttlSeconds = 86400 } = options;
  const key = getStageKey(generationId, stageName, guestId);
  const redis = getRedis();
  const serialized = JSON.stringify(output);

  if (redis) {
    try {
      await redis.set(key, serialized, { ex: ttlSeconds });
      return true;
    } catch (err) {
      if (isProductionMode()) {
        throw new RedisUnavailableError(`Redis persistStageResult error for ${key} in production: ${err?.message}`);
      }
      console.warn(`[stageCheckpoint] Redis persistStageResult error for ${key}:`, err?.message);
    }
  } else if (isProductionMode()) {
    throw new RedisUnavailableError('Redis is required for persisting stage results in production mode');
  }

  // In-memory store fallback (dev/test mode only)
  if (isProductionMode()) return true;

  inMemoryStages.set(key, {
    data: output,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  return true;
}

/**
 * Releases the stage execution lock after completion or failure.
 * Guarantees atomic ownership verification: never deletes another worker's lock
 * after lease expiration.
 */
export async function releaseStageExecution(generationId, stageName, workerId = null, options = {}) {
  let resolvedWorkerId = workerId;
  let resolvedOptions = options;
  if (typeof workerId === 'object' && workerId !== null && (!options || Object.keys(options).length === 0)) {
    resolvedOptions = workerId;
    resolvedWorkerId = resolvedOptions.workerId || null;
  } else if (resolvedOptions?.workerId) {
    resolvedWorkerId = resolvedOptions.workerId;
  }

  const { guestId = null } = resolvedOptions || {};
  const key = getLockKey(generationId, stageName, guestId);
  const redis = getRedis();

  if (redis) {
    try {
      if (resolvedWorkerId) {
        // Atomic compare-and-delete via Redis Lua script:
        // Delete ONLY if the current value matches the caller's workerId.
        const LUA_RELEASE_LOCK = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        const res = await redis.eval(LUA_RELEASE_LOCK, [key], [String(resolvedWorkerId)]);
        return res === 1;
      } else {
        await redis.del(key);
        return true;
      }
    } catch (err) {
      if (isProductionMode()) {
        throw new RedisUnavailableError(`Redis releaseStageExecution error for ${key} in production: ${err?.message}`);
      }
      console.warn(`[stageCheckpoint] Redis releaseStageExecution error for ${key}:`, err?.message);
    }
  } else if (isProductionMode()) {
    throw new RedisUnavailableError('Redis is required for releasing stage locks in production mode');
  }

  // In-memory store fallback (dev/test mode only)
  if (isProductionMode()) return true;

  const mem = inMemoryLocks.get(key);
  if (mem) {
    if (!resolvedWorkerId || mem.workerId === resolvedWorkerId) {
      inMemoryLocks.delete(key);
      return true;
    }
    // Worker ownership changed or expired; do not delete another worker's lock
    return false;
  }
  return true;
}

/**
 * Reset memory state (useful in test runners)
 */
export function _resetCheckpointMemory() {
  inMemoryStages.clear();
  inMemoryLocks.clear();
}
