/**
 * Lightweight Health Check Endpoint for Render / Uptime Monitoring
 * Returns HTTP 200 { ok: true, status: 'healthy' } immediately without calling
 * external LLMs, consuming credits, or mutating data.
 */

export const maxDuration = 10;

export default async function handler(req, res) {
  // CORS & Methods
  const origin = req.headers?.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://penshift.onrender.com,https://penshift.com').split(',').map(s => s.trim());
  const isDev = process.env.PENSHIFT_DEV_MODE === 'true' && (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  const isAllowedOrigin = origin && allowed.includes(origin);

  if (isDev || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Service-Status', 'ok');

  return res.status(200).json({
    ok: true,
    status: 'healthy',
    service: 'penshift',
    timestamp: new Date().toISOString()
  });
}
