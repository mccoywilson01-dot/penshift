import { checkRateLimit, getClientIp } from './_lib/rateLimiter.js';
import { verifyBearerToken } from './_lib/supabase.js';

const VOWEL_REGEX = /[aeiouy]{1,2}/g;
const SUFFIX_REGEX = /(?:[^laeiouy]es|ed|[^laeiouy]e)$/;

function countSyllables(word) {
  if (!word || word.length <= 3) return 1;
  const clean = word.toLowerCase().replace(SUFFIX_REGEX, '').replace(/^y/, '');
  const matches = clean.match(VOWEL_REGEX);
  return matches ? matches.length : 1;
}

export const maxDuration = 60;
export default async function handler(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://penshift.com').split(',').map(o => o.trim());
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
  const maxReqs = userId ? 60 : 5;
  const rlResult = await checkRateLimit('rl_readability', rateLimitKey, maxReqs, 60);
  if (!rlResult.allowed) {
    return res.status(rlResult.error?.includes('unavailable') ? 503 : 429).json({ 
      error: rlResult.error || 'Rate limit exceeded. Please wait a minute.' 
    });
  }

  const text = req.body?.text;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing text provided' });
  }

  // Prevent processing overly large payloads to avoid memory exhaustion / ReDoS
  if (text.length > 50000) {
    return res.status(413).json({ error: 'Text payload too large' });
  }

  try {
    const sentences = Math.max(1, text.split(/[.!?\n]+/).filter(s => s.trim().length > 0).length);
    let words = 0;
    let syllables = 0;
    let complexWords = 0;
    
    const wordRegex = /[\p{L}\p{N}]+/gu;
    let match;
    let iterations = 0;
    while ((match = wordRegex.exec(text)) !== null) {
      iterations++;
      if (iterations % 2000 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }

      const w = match[0];
      if (/^\d+$/.test(w)) continue;
      
      const cleanWord = w.replace(/[^\p{L}]/gu, '');
      if (cleanWord.length > 0) {
        words++;
        const count = countSyllables(cleanWord);
        syllables += count;
        if (count >= 3) complexWords++;
      }
    }

    if (words === 0) {
      return res.status(400).json({ error: 'Text contains no valid words' });
    }
    
    const fleschReadingEase = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
    const fleschKincaidGrade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
    const gunningFog = 0.4 * ((words / sentences) + 100 * (complexWords / words));

    return res.status(200).json({
      metrics: {
        fleschReadingEase: Math.max(0, Math.min(100, Math.round(fleschReadingEase))),
        fleschKincaidGrade: Math.max(0, Math.round(fleschKincaidGrade * 10) / 10),
        gunningFog: Math.max(0, Math.round(gunningFog * 10) / 10),
        sentenceCount: sentences,
        wordCount: words,
        syllableCount: syllables,
        avgSentenceLength: Math.round((words / sentences) * 10) / 10
      }
    });
  } catch (e) {
    console.error('Readability API Error:', e);
    return res.status(500).json({ error: 'Internal server error during readability analysis' });
  }
}
