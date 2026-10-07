import { Redis } from '@upstash/redis';

let redisClient = null;
let mockRedisClient = null;

export function _setMockRedis(mock) {
  mockRedisClient = mock;
}

/**
 * Returns singleton Upstash Redis client if configured, otherwise null.
 */
export function getRedis() {
  if (mockRedisClient !== null) return mockRedisClient;
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    redisClient = new Redis({ url, token });
    return redisClient;
  }
  return null;
}

/**
 * Explicit observable error for Redis failures in production mode.
 */
export class RedisUnavailableError extends Error {
  constructor(message = 'Redis is unavailable for distributed operations in production mode') {
    super(message);
    this.name = 'RedisUnavailableError';
    this.status = 503;
    this.code = 'REDIS_UNAVAILABLE';
  }
}

/**
 * Authoritative production mode predicate.
 * In production mode, process-local in-memory fallbacks are strictly prohibited
 * for distributed invariants.
 */
export function isProductionMode() {
  // If explicitly flagged as dev mode or test mode, permit in-memory fallback
  if (process.env.PENSHIFT_DEV_MODE === 'true' || process.env.NODE_ENV === 'test') {
    return false;
  }
  // If explicitly flagged as non-dev or running in production environment
  if (process.env.NODE_ENV === 'production' || process.env.PENSHIFT_DEV_MODE === 'false') {
    return true;
  }
  // Default to development for local runs where neither variable is set
  return false;
}
