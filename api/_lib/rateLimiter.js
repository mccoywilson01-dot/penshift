import crypto from 'crypto';
import { getRedis, isProductionMode, RedisUnavailableError } from './redisConfig.js';

export { getRedis, isProductionMode, RedisUnavailableError };

const fallbackCache = new Map();
const FALLBACK_CACHE_MAX = 2000;

// In-memory idempotency fallback stores
const memoryIdempotency = new Map();
const memoryTombstones = new Map();

/**
 * Safely extracts client IP prioritizing trusted edge headers.
 */
export function getClientIp(req) {
  if (!req || !req.headers) return '127.0.0.1';

  // 1. Edge header fallback (retained for backward compatibility and test suites)
  const edgeIp = req.headers['x-vercel-forwarded-for'] || req.headers['cf-connecting-ip'];
  if (edgeIp && typeof edgeIp === 'string') {
    const ip = edgeIp.split(',')[0].trim().replace(/[^a-fA-F0-9:.]/g, '');
    if (ip) return ip;
  }

  // 2. Render or Dev mode reverse proxy extraction
  if (process.env.PENSHIFT_DEV_MODE === 'true' || process.env.RENDER === 'true') {
    const realIp = req.headers['x-real-ip'];
    if (realIp && typeof realIp === 'string') {
      const ip = realIp.trim().replace(/[^a-fA-F0-9:.]/g, '');
      if (ip) return ip;
    }

    const xff = req.headers['x-forwarded-for'];
    if (xff && typeof xff === 'string') {
      const rawFirst = xff.split(',')[0].trim().replace(/[^a-fA-F0-9:.]/g, '');
      if (rawFirst) return rawFirst;
    }
  }

  // 3. Direct socket connection fallback
  const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
  const cleanSocket = String(socketIp).replace(/^::ffff:/, '').trim().replace(/[^a-fA-F0-9:.]/g, '');
  return cleanSocket || '127.0.0.1';
}

// ═══════════════════════════════════ GUEST COOKIE MANAGEMENT ═══════════════════════════════════

function getCookieSecret() {
  return process.env.GUEST_COOKIE_SECRET || process.env.UPSTASH_REDIS_REST_TOKEN || 'penshift-guest-secret-token-key-2026';
}

export function signCookieValue(guestId) {
  const hmac = crypto.createHmac('sha256', getCookieSecret()).update(guestId).digest('hex').slice(0, 32);
  return `${guestId}.${hmac}`;
}

export function verifyCookieValue(cookieVal) {
  if (!cookieVal || typeof cookieVal !== 'string') return null;
  const parts = cookieVal.split('.');
  if (parts.length !== 2) return null;
  const [guestId, hmac] = parts;
  const expected = crypto.createHmac('sha256', getCookieSecret()).update(guestId).digest('hex').slice(0, 32);
  if (crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) {
    return guestId;
  }
  return null;
}

/**
 * Parses cookies from request header.
 */
function parseCookies(req) {
  const header = req.headers?.cookie || '';
  const cookies = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx !== -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      cookies[k] = decodeURIComponent(v);
    }
  });
  return cookies;
}

/**
 * Resolves guest session from signed cookie, enforcing secondary coarse IP rate limiting
 * on new session issuance (max 15 issuances / hour per IP).
 */
export async function resolveGuestSession(req, res) {
  const cookies = parseCookies(req);
  const rawCookie = cookies['__Host-penshift-guest'] || cookies['penshift-guest'];
  const verifiedGuestId = verifyCookieValue(rawCookie);

  if (verifiedGuestId) {
    return { guestId: verifiedGuestId, isNew: false };
  }

  // Secondary abuse control: max 15 session issuances per hour per client IP
  const clientIp = getClientIp(req);
  const ipCheck = await checkRateLimit('rl_guest_cookie_issuance', clientIp, 15, 3600);
  if (!ipCheck.allowed) {
    return {
      guestId: null,
      error: 'TOO_MANY_GUEST_SESSIONS',
      message: 'Too many guest sessions initiated from this network. Please sign in or try again later.',
    };
  }

  // Issue new guest ID
  const newGuestId = crypto.randomUUID();
  const signedValue = signCookieValue(newGuestId);
  const isSecure = req.headers?.['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  const cookieName = isSecure ? '__Host-penshift-guest' : 'penshift-guest';
  const secureFlag = isSecure ? 'Secure; ' : '';
  const cookieHeader = `${cookieName}=${signedValue}; Path=/; HttpOnly; ${secureFlag}SameSite=Lax; Max-Age=2592000`;

  if (res && typeof res.setHeader === 'function' && !res.headersSent) {
    res.setHeader('Set-Cookie', cookieHeader);
  }

  return { guestId: newGuestId, isNew: true, cookieHeader };
}

// ═══════════════════════════════════ SLIDING WINDOW RATE LIMITER ═══════════════════════════════════

function checkInMemoryRateLimit(rateLimitKey, maxRequests, windowSeconds) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const cutoff = now - windowMs;

  if (fallbackCache.size > FALLBACK_CACHE_MAX) {
    let deletedCount = 0;
    for (const [k, timestamps] of fallbackCache.entries()) {
      if (!Array.isArray(timestamps) || timestamps.length === 0 || timestamps[timestamps.length - 1] < cutoff) {
        fallbackCache.delete(k);
        deletedCount++;
      }
      if (deletedCount > 200) break;
    }
  }

  let timestamps = fallbackCache.get(rateLimitKey);
  if (!Array.isArray(timestamps)) {
    timestamps = [];
  } else {
    timestamps = timestamps.filter((t) => t > cutoff);
  }

  const isDev = process.env.PENSHIFT_DEV_MODE === 'true';
  const fallbackMax = isDev ? maxRequests : Math.max(maxRequests, 10);

  if (timestamps.length >= fallbackMax) {
    fallbackCache.set(rateLimitKey, timestamps);
    return {
      allowed: false,
      count: timestamps.length,
      remaining: 0,
      error: `Rate limit exceeded. Please wait before trying again.`,
    };
  }

  timestamps.push(now);
  fallbackCache.set(rateLimitKey, timestamps);

  return {
    allowed: true,
    count: timestamps.length,
    remaining: Math.max(0, fallbackMax - timestamps.length),
  };
}

export async function checkRateLimit(keyPrefix, identifier, maxRequests = 25, windowSeconds = 60) {
  const redis = getRedis();
  const rateLimitKey = `${keyPrefix}_${identifier}`;

  if (!redis) {
    if (isProductionMode()) {
      throw new RedisUnavailableError(`Redis is required for distributed rate limiting (${keyPrefix}) in production mode`);
    }
    return checkInMemoryRateLimit(rateLimitKey, maxRequests, windowSeconds);
  }

  try {
    const nowMs = Date.now();
    const windowMs = windowSeconds * 1000;
    const reqId = `${nowMs}-${Math.random().toString(36).slice(2, 10)}`;

    const luaScript = `
      local key = KEYS[1]
      local window_ms = tonumber(ARGV[1])
      local max_reqs = tonumber(ARGV[2])
      local now_ms = tonumber(ARGV[3])
      local req_id = ARGV[4]

      local key_type = redis.call("TYPE", key)
      if key_type["ok"] ~= "none" and key_type["ok"] ~= "zset" then
        redis.call("DEL", key)
      end

      redis.call("ZREMRANGEBYSCORE", key, "-inf", now_ms - window_ms)
      local current = redis.call("ZCARD", key)

      if current >= max_reqs then
        return -1
      end

      redis.call("ZADD", key, now_ms, req_id)
      redis.call("PEXPIRE", key, window_ms)
      return current + 1
    `;

    const result = Number(await redis.eval(luaScript, [rateLimitKey], [windowMs, maxRequests, nowMs, reqId]));

    if (result < 0) {
      return {
        allowed: false,
        count: maxRequests,
        remaining: 0,
        error: `Rate limit exceeded (${maxRequests} req/${windowSeconds}s). Please wait before trying again.`,
      };
    }

    return {
      allowed: true,
      count: result,
      remaining: Math.max(0, maxRequests - result),
    };
  } catch (err) {
    if (isProductionMode()) {
      throw new RedisUnavailableError(`Redis check failed for rate limiter ${keyPrefix} in production: ${err.message}`);
    }
    console.warn(`[RateLimiter] Redis check failed for ${keyPrefix} (${err.message}). Falling back to memory.`);
    return checkInMemoryRateLimit(rateLimitKey, maxRequests, windowSeconds);
  }
}

// ═══════════════════════════════════ ADMIT GENERATION (LUA) ═══════════════════════════════════

/**
 * Atomically admits generation credit bound to identity tuple (principalId, generationId).
 * Returns { admitted: boolean, isReplay: boolean, error?: string }
 */
export async function admitGeneration(options = {}) {
  const {
    principalId,
    generationId,
    maxCredits = 30,
    windowSeconds = 60,
    admissionTtl = 86400,
  } = options;

  const redis = getRedis();
  const rateLimitKey = `rl_user_generation:${principalId}`;
  const creditKey = `credit:admitted:${principalId}:${generationId}`;
  const nowMs = Date.now();
  const windowMs = windowSeconds * 1000;

  if (redis) {
    try {
      const luaScript = `
        -- KEYS[1]: rate_limit_key
        -- KEYS[2]: credit_admission_key
        -- ARGV[1]: window_ms
        -- ARGV[2]: max_credits
        -- ARGV[3]: now_ms
        -- ARGV[4]: admission_ttl

        if redis.call("EXISTS", KEYS[2]) == 1 then
          return {1, 1} -- Admitted (replayed): Zero credit deducted
        end

        redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", ARGV[3] - ARGV[1])
        local current_usage = redis.call("ZCARD", KEYS[1])

        if current_usage >= tonumber(ARGV[2]) then
          return {0, 0} -- Rejected: Quota limit exceeded
        end

        redis.call("ZADD", KEYS[1], ARGV[3], ARGV[3] .. "-" .. math.random(100000, 999999))
        redis.call("PEXPIRE", KEYS[1], ARGV[1])
        redis.call("SET", KEYS[2], "1", "EX", tonumber(ARGV[4]))

        return {1, 0} -- Admitted (fresh debit)
      `;

      const result = await redis.eval(luaScript, [rateLimitKey, creditKey], [windowMs, maxCredits, nowMs, admissionTtl]);
      const admitted = Array.isArray(result) && result[0] === 1;
      const isReplay = Array.isArray(result) && result[1] === 1;

      if (!admitted) {
        return {
          admitted: false,
          isReplay: false,
          error: `Generation rate limit exceeded (${maxCredits} generations/${windowSeconds}s). Please wait before generating again.`,
        };
      }

      return { admitted: true, isReplay };
    } catch (err) {
      if (isProductionMode()) {
        throw new RedisUnavailableError(`Redis admitGeneration failed in production: ${err.message}`);
      }
      console.warn(`[rateLimiter] admitGeneration Redis error:`, err.message);
    }
  } else if (isProductionMode()) {
    throw new RedisUnavailableError('Redis is required for generation admission in production mode');
  }

  // Memory fallback (Permitted ONLY in dev/test mode)
  if (isProductionMode()) {
    throw new RedisUnavailableError('Process-local Map fallback for generation admission is prohibited in production mode');
  }

  const memAdmissionKey = `${principalId}:${generationId}`;
  if (memoryIdempotency.has(memAdmissionKey)) {
    return { admitted: true, isReplay: true };
  }

  const rateCheck = checkInMemoryRateLimit(rateLimitKey, maxCredits, windowSeconds);
  if (!rateCheck.allowed) {
    return { admitted: false, isReplay: false, error: rateCheck.error };
  }

  memoryIdempotency.set(memAdmissionKey, { admitted: true, expiresAt: nowMs + admissionTtl * 1000 });
  return { admitted: true, isReplay: false };
}

// ═══════════════════════════════════ IDEMPOTENCY RECORD MANAGEMENT ═══════════════════════════════════

export function hashRequest(body) {
  const norm = typeof body === 'string' ? body : JSON.stringify(body);
  return crypto.createHash('sha256').update(norm).digest('hex');
}

export function hashKey(idempotencyKey) {
  return crypto.createHash('sha256').update(String(idempotencyKey)).digest('hex').slice(0, 32);
}

export function getIdempKey(principalId, keyHash) {
  return `idemp:v1:${principalId}:${keyHash}`;
}

export function getGuestTombstoneKey(guestId, keyHash) {
  return `idemp:tombstone:v1:guest:${guestId}:${keyHash}`;
}

export async function getIdempotencyRecord(principalId, keyHash) {
  const redis = getRedis();
  const key = getIdempKey(principalId, keyHash);

  if (redis) {
    try {
      const data = await redis.get(key);
      if (data) return typeof data === 'string' ? JSON.parse(data) : data;
      return null;
    } catch (err) {
      if (isProductionMode()) {
        throw new RedisUnavailableError(`Redis getIdempotencyRecord failed in production: ${err.message}`);
      }
      console.warn(`[rateLimiter] getIdempotencyRecord Redis error:`, err.message);
    }
  } else if (isProductionMode()) {
    throw new RedisUnavailableError('Redis is required for distributed idempotency in production mode');
  }

  // Memory fallback (Permitted ONLY in dev/test mode)
  if (isProductionMode()) return null;
  const mem = memoryIdempotency.get(key);
  if (mem && mem.expiresAt > Date.now()) return mem.data;
  return null;
}

export async function getGuestTombstone(guestId, keyHash) {
  const redis = getRedis();
  const key = getGuestTombstoneKey(guestId, keyHash);

  if (redis) {
    try {
      const data = await redis.get(key);
      if (data) return true;
      return false;
    } catch (err) {
      if (isProductionMode()) {
        throw new RedisUnavailableError(`Redis getGuestTombstone failed in production: ${err.message}`);
      }
      console.warn(`[rateLimiter] getGuestTombstone Redis error:`, err.message);
    }
  } else if (isProductionMode()) {
    throw new RedisUnavailableError('Redis is required for guest tombstones in production mode');
  }

  // Memory fallback (Permitted ONLY in dev/test mode)
  if (isProductionMode()) return false;
  const mem = memoryTombstones.get(key);
  if (mem && mem.expiresAt > Date.now()) return true;
  return false;
}

export async function reserveIdempotencyKey(principalId, keyHash, generationId, requestHash, ttlSeconds = 120) {
  const redis = getRedis();
  const key = getIdempKey(principalId, keyHash);
  const payload = {
    generationId,
    requestHash,
    status: 'IN_PROGRESS',
    createdAt: Date.now(),
  };
  const serialized = JSON.stringify(payload);

  if (redis) {
    try {
      const res = await redis.set(key, serialized, { nx: true, ex: ttlSeconds });
      return res === 'OK' || res === true;
    } catch (err) {
      if (isProductionMode()) {
        throw new RedisUnavailableError(`Redis reserveIdempotencyKey failed in production: ${err.message}`);
      }
      console.warn(`[rateLimiter] reserveIdempotencyKey Redis error:`, err.message);
    }
  } else if (isProductionMode()) {
    throw new RedisUnavailableError('Redis is required for distributed idempotency reservation in production mode');
  }

  // Memory fallback (Permitted ONLY in dev/test mode)
  if (isProductionMode()) {
    throw new RedisUnavailableError('Process-local Map fallback for idempotency reservation is prohibited in production mode');
  }

  const existing = memoryIdempotency.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return false;
  }
  memoryIdempotency.set(key, { data: payload, expiresAt: Date.now() + ttlSeconds * 1000 });
  return true;
}

export async function completeIdempotencyKey(principalId, keyHash, data, options = {}) {
  const { guestId = null, ttlSeconds = 86400 } = options;
  const key = getIdempKey(principalId, keyHash);
  const redis = getRedis();
  const serialized = JSON.stringify({
    ...data,
    status: 'COMPLETED',
    completedAt: Date.now(),
  });

  if (redis) {
    try {
      await redis.set(key, serialized, { ex: ttlSeconds });
      if (guestId) {
        // Set 30-day tombstone for guest idempotency key
        const tombKey = getGuestTombstoneKey(guestId, keyHash);
        await redis.set(tombKey, '1', { ex: 2592000 }); // 30 days
      }
      return true;
    } catch (err) {
      if (isProductionMode()) {
        throw new RedisUnavailableError(`Redis completeIdempotencyKey failed in production: ${err.message}`);
      }
      console.warn(`[rateLimiter] completeIdempotencyKey Redis error:`, err.message);
    }
  } else if (isProductionMode()) {
    throw new RedisUnavailableError('Redis is required for completing idempotency in production mode');
  }

  // Memory fallback (Permitted ONLY in dev/test mode)
  if (isProductionMode()) {
    return true;
  }

  memoryIdempotency.set(key, {
    data: { ...data, status: 'COMPLETED' },
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  if (guestId) {
    const tombKey = getGuestTombstoneKey(guestId, keyHash);
    memoryTombstones.set(tombKey, { expiresAt: Date.now() + 2592000 * 1000 });
  }

  return true;
}
