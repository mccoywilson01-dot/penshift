import crypto from 'crypto';
import { getRedis, checkRateLimit, getClientIp } from './_lib/rateLimiter.js';
import { verifyBearerToken } from './_lib/supabase.js';

function getSentences(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
    return Array.from(segmenter.segment(text)).map(s => s.segment.trim()).filter(Boolean);
  }
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
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

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Identify User
  const userId = req.user?.id || null;

  // Atomic rate limiter
  const ip = getClientIp(req);
  const rateLimitKey = userId ? `user_${userId}` : `ip_${ip}`;
  const maxReqs = userId ? 30 : 3;
  const rlResult = await checkRateLimit('rl_plag', rateLimitKey, maxReqs, 60);
  if (!rlResult.allowed) {
    return res.status(rlResult.error?.includes('unavailable') ? 503 : 429).json({ 
      error: rlResult.error || 'Rate limit exceeded. Please wait a minute.' 
    });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required and must be a string' });
  }

  if (text.length > 20000) {
    return res.status(413).json({ error: 'Text exceeds maximum allowed length of 20,000 characters' });
  }

  const sanitizedText = text.trim();
  if (sanitizedText.length === 0) {
    return res.status(400).json({ error: 'Text cannot be empty' });
  }

  const redis = getRedis();
  const uaHash = req.headers['user-agent'] ? crypto.createHash('md5').update(req.headers['user-agent']).digest('hex').substring(0, 8) : 'noua';
  const cacheKey = `plag:${userId || ip + ':' + uaHash}:${crypto.createHash('sha256').update(sanitizedText).digest('hex')}`;
  if (redis) {
    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) return res.status(200).json(cachedData);
    } catch (e) {
      console.error('Redis get error:', e.message);
    }
  }

  try {
    const sentences = getSentences(sanitizedText).map(s => s.trim()).filter(s => s.length > 20);
    const validSentences = sentences.filter(s => s.trim().split(/\s+/).length >= 5);
    
    if (sentences.length === 0 || validSentences.length === 0) {
      // If there are no valid sentences to check, do not declare it 100% unique.
      const finalData = { unique: null, error: 'Text too short or lacks sufficient sentence structure to analyze', matches: [], checkedCount: 0 };
      if (redis) {
        try {
          await redis.set(cacheKey, finalData, { ex: 3600 });
        } catch (e) {
          console.error('Redis set error:', e.message);
        }
      }
      return res.status(200).json(finalData);
    }

    const maxSentencesToCheck = 5;
    
    // Deterministic Stratified Sampling
    const toCheck = [];
    if (validSentences.length <= maxSentencesToCheck) {
      toCheck.push(...validSentences);
    } else {
      const step = (validSentences.length - 1) / (maxSentencesToCheck - 1);
      for (let i = 0; i < maxSentencesToCheck; i++) {
        const idx = Math.round(i * step);
        const s = validSentences[idx].trim();
        if (!toCheck.includes(s)) toCheck.push(s);
      }
    }
    
    if (toCheck.length === 0) {
      return res.status(200).json({ unique: null, error: 'Text structure could not be analyzed for originality', matches: [], checkedCount: 0 });
    }

    const startTime = Date.now();

    const results = await Promise.all(toCheck.map(async (sentence) => {
      if (Date.now() - startTime > 45000) {
        console.warn('Plagiarism check hitting timeout limit, breaking early');
        return { failed: true };
      }
      try {
        const sanitizedSentence = sentence.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
        const query = encodeURIComponent(`"${sanitizedSentence}"`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        let cleanResults = '';
        let fetchSuccess = false;

        try {
          if (process.env.TAVILY_API_KEY) {
            const tavilyRes = await fetch('https://api.tavily.com/search', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`
              },
              body: JSON.stringify({ query: `"${sanitizedSentence}"`, search_depth: 'basic', max_results: 3 }),
              signal: controller.signal
            });
            if (tavilyRes.ok) {
              const tData = await tavilyRes.json();
              cleanResults = (tData.results || []).map(r => r.content || '').join(' ').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '');
              fetchSuccess = true;
            }
          } else if (process.env.SERP_API_KEY) {
            const url = `https://serpapi.com/search.json?q=${query}&api_key=${process.env.SERP_API_KEY}`;
            const serpRes = await fetch(url, { signal: controller.signal });
            if (serpRes.ok) {
              const json = await serpRes.json();
              const snippets = (json.organic_results || []).map(r => r.snippet || '').join(' ');
              cleanResults = snippets.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '');
              fetchSuccess = true;
            }
          } else {
            const url = `https://html.duckduckgo.com/html/?q=${query}`;
            const ddgRes = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
              },
              signal: controller.signal
            });

            if (ddgRes.ok) {
              const html = await ddgRes.text();
              const lowerHtml = html.toLowerCase();
              const isBlocked = lowerHtml.includes('captcha') || 
                                lowerHtml.includes('rate limit') || 
                                lowerHtml.includes('challenge') || 
                                lowerHtml.includes('blocked') ||
                                lowerHtml.includes('anomaly');
              
              if (!isBlocked && (lowerHtml.includes('duckduckgo') || lowerHtml.includes('id="links"') || lowerHtml.includes('results'))) {
                const hasResults = lowerHtml.includes('class="result__snippet');
                const hasNoResults = lowerHtml.includes('no results') || lowerHtml.includes('not find any results');
                
                if (hasResults) {
                  const snippetMatches = [];
                  const snippetRegex = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|span|div|p)>/gi;
                  let m;
                  while ((m = snippetRegex.exec(html)) !== null) {
                    if (m[1]) {
                      const textSnippet = m[1].slice(0, 1000).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
                      snippetMatches.push(textSnippet);
                    }
                  }
                  cleanResults = snippetMatches.join(' ').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '');
                  fetchSuccess = true;
                } else if (hasNoResults) {
                  cleanResults = '';
                  fetchSuccess = true;
                }
              }
            }
          }
        } finally {
          clearTimeout(timeoutId);
        }

        if (!fetchSuccess) {
          return { failed: true };
        } else if (cleanResults.length === 0) {
          // If fetch succeeded but cleanResults is empty, it means 0 matches were found (100% original)
          return { failed: false, plagiarized: false };
        } else {
          const cleanWords = sentence.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
          if (cleanWords.length >= 5) {
            let matchCount = 0;
            const totalChunks = cleanWords.length - 2;
            const searchTarget = ' ' + cleanResults + ' ';
            for (let i = 0; i < totalChunks; i++) {
               const chunk = cleanWords[i] + ' ' + cleanWords[i+1] + ' ' + cleanWords[i+2];
               if (searchTarget.includes(' ' + chunk + ' ')) matchCount++;
            }
            
            const threshold = Math.floor(totalChunks * 0.4);
            if (matchCount > threshold && matchCount > 0) {
              return { failed: false, plagiarized: true, match: { sentence: sentence, found: true } };
            }
          }
          return { failed: false, plagiarized: false };
        }
      } catch (error) {
        console.error('Fetch error:', error.message);
        return { failed: true };
      }
    }));

    const failedCount = results.filter(r => r.failed).length;
    const plagiarizedCount = results.filter(r => r.plagiarized).length;
    const matches = results.filter(r => r.match).map(r => r.match);
    const checkedCount = results.length;

    if (toCheck.length > 0 && failedCount > toCheck.length / 2) {
      return res.status(503).json({ error: 'Plagiarism search engine is temporarily busy. Please retry.' });
    }

    const successfulChecks = Math.max(1, checkedCount - failedCount);
    const uniquenessScore = Math.max(0, 100 - Math.round((plagiarizedCount / successfulChecks) * 100));
    const finalData = {
      unique: uniquenessScore,
      matches,
      checkedCount: toCheck.length
    };

    if (redis && failedCount === 0 && toCheck.length > 0) {
      try {
        await redis.set(cacheKey, finalData, { ex: 3600 }); // 1 hour TTL
      } catch (e) {
        console.error('Redis set error:', e.message);
      }
    }

    return res.status(200).json(finalData);

  } catch (error) {
    console.error('Plagiarism Error:', error);
    return res.status(500).json({ error: 'Failed to run plagiarism check' });
  }
}
