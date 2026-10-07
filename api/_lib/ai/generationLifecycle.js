import { getRedis, isProductionMode, RedisUnavailableError } from '../redisConfig.js';

const memoryJobCancel = new Set();

export const GENERATION_STATUS = {
  QUEUED: 'QUEUED',
  DISPATCHING: 'DISPATCHING',
  RUNNING: 'RUNNING',
  STREAMING: 'STREAMING',
  VALIDATING: 'VALIDATING',
  FINALIZING: 'FINALIZING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
};

export const TERMINAL_STATUSES = new Set([
  GENERATION_STATUS.COMPLETED,
  GENERATION_STATUS.FAILED,
  GENERATION_STATUS.CANCELLED,
]);

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Formats a server-sent event line for standard SSE streaming.
 */
export function formatSSE(data) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Formats the standard [DONE] stream termination event.
 */
export function formatSSEDone() {
  return 'data: [DONE]\n\n';
}

/**
 * Stores progress or status update in Redis for live stream reconnection / status polling.
 */
export function getJobKey(generationId) {
  return `job:${generationId}`;
}

export function getJobCancelKey(generationId) {
  return `job:cancel:${generationId}`;
}

export function getJobLockKey(generationId) {
  return `job:lock:${generationId}`;
}

/**
 * Checks if a cancellation was requested for this generation.
 */
export async function isJobCancelled(generationId) {
  const redis = getRedis();

  if (isProductionMode()) {
    if (!redis) {
      throw new RedisUnavailableError('Redis is required for checking job cancellation in production mode');
    }
    try {
      const val = await redis.get(getJobCancelKey(generationId));
      return Boolean(val);
    } catch (err) {
      throw new RedisUnavailableError(`Redis isJobCancelled failed in production: ${err.message}`);
    }
  }

  if (!redis) return memoryJobCancel.has(generationId);
  try {
    const val = await redis.get(getJobCancelKey(generationId));
    return Boolean(val);
  } catch (err) {
    return memoryJobCancel.has(generationId);
  }
}

/**
 * Sets cancellation flag for a generation.
 */
export async function cancelJob(generationId, ttlSeconds = 3600) {
  const redis = getRedis();

  if (isProductionMode()) {
    if (!redis) {
      throw new RedisUnavailableError('Redis is required for job cancellation in production mode');
    }
    try {
      await redis.set(getJobCancelKey(generationId), '1', { ex: ttlSeconds });
      return true;
    } catch (err) {
      throw new RedisUnavailableError(`Redis cancelJob failed in production: ${err.message}`);
    }
  }

  memoryJobCancel.add(generationId);
  if (!redis) return true;
  try {
    await redis.set(getJobCancelKey(generationId), '1', { ex: ttlSeconds });
    return true;
  } catch (err) {
    console.warn(`[generationLifecycle] Failed to cancelJob ${generationId}:`, err.message);
    return false;
  }
}

