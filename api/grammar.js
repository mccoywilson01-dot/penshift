import crypto from 'crypto';
import { getRedis, checkRateLimit, getClientIp } from './_lib/rateLimiter.js';
import { verifyBearerToken } from './_lib/supabase.js';

export const maxDuration = 60;

export default async function handler(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://penshift.onrender.com,https://penshift.com').split(',').map(o => o.trim());
  const reqOrigin = req.headers.origin;
  const isDev = process.env.PENSHIFT_DEV_MODE === 'true' && (!reqOrigin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(reqOrigin));
  const isAllowedOrigin = reqOrigin && allowed.includes(reqOrigin);

  let verifiedUser = null;
  const authHeader = req.headers.authorization;
  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    verifiedUser = await verifyBearerToken(authHeader);
    if (verifiedUser) {
      req.user = verifiedUser;
    }
  }

  if (isDev) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin || '*');
  } else if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
  } else if (!reqOrigin) {
    if (!verifiedUser) {
      res.setHeader('Access-Control-Allow-Origin', allowed[0]);
      return res.status(403).json({ error: 'Direct API access requires authentication.' });
    }
    res.setHeader('Access-Control-Allow-Origin', allowed[0]);
  } else {
    res.setHeader('Access-Control-Allow-Origin', allowed[0]);
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
  
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Identify User
  const userId = req.user?.id || null;

  // Atomic rate limiter
  const ip = getClientIp(req);
  const rateLimitKey = userId ? `user_${userId}` : `ip_${ip}`;
  const maxReqs = userId ? 40 : 5;
  const rlResult = await checkRateLimit('rl_grammar', rateLimitKey, maxReqs, 60);
  if (!rlResult.allowed) {
    return res.status(rlResult.error?.includes('unavailable') ? 503 : 429).json({ 
      error: rlResult.error || 'Rate limit exceeded. Please wait a minute.' 
    });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'Valid text string is required' });
  }

  if (text.length > 20000) {
    return res.status(413).json({ error: 'Text exceeds maximum allowed length of 20,000 characters' });
  }

  const redis = getRedis();
  const uaHash = req.headers['user-agent'] ? crypto.createHash('md5').update(req.headers['user-agent']).digest('hex').substring(0, 8) : 'noua';
  const cacheKey = `grammar:${userId || ip + ':' + uaHash}:${crypto.createHash('sha256').update(text).digest('hex')}`;
  if (redis) {
    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) return res.status(200).json(cachedData);
    } catch (e) {
      console.error('Redis get error:', e.message);
    }
  }

  try {
    const bodyObj = { text, language: 'en-US' };
    let apiUrl = 'https://api.languagetool.org/v2/check';
    if (process.env.LANGUAGETOOL_USERNAME && process.env.LANGUAGETOOL_API_KEY) {
      bodyObj.username = process.env.LANGUAGETOOL_USERNAME;
      bodyObj.apiKey = process.env.LANGUAGETOOL_API_KEY;
      apiUrl = 'https://api.languagetoolplus.com/v2/check';
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(bodyObj),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    
    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({ error: 'Too many grammar checks. Please wait a moment and try again.' });
      }
      throw new Error(`LanguageTool API error: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`LanguageTool API error: Expected JSON but got ${contentType}`);
    }
    const data = await response.json();
    
    if (redis) {
      try {
        await redis.set(cacheKey, data, { ex: 3600 }); // 1 hour TTL (was 30 days)
      } catch (e) {
        console.error('Redis set error:', e.message);
      }
    }
    
    return res.status(200).json(data);
  } catch (e) {
    if (e.name === 'AbortError') return res.status(504).json({ error: 'Gateway Timeout: Grammar check took too long.' });
    console.error('[Grammar Check Error]:', e);
    if (e.message && e.message.includes('LanguageTool API error')) {
      return res.status(503).json({ error: 'Grammar checking service is temporarily busy. Please try again in a moment.' });
    }
    return res.status(500).json({ error: 'Internal server error while processing grammar check' });
  }
}
