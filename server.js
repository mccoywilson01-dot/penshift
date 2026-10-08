import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '10000', 10);
const DIST_DIR = path.resolve(__dirname, 'dist');

// Pre-load route handlers
import healthHandler from './api/health.js';
import generateHandler from './api/generate.js';
import grammarHandler from './api/grammar.js';
import plagiarismHandler from './api/plagiarism.js';
import readabilityHandler from './api/readability.js';
import workerHandler from './api/_internal/worker/generation.js';
import reconcileHandler from './api/_internal/reconcile.js';

const API_ROUTES = {
  '/api/health': healthHandler,
  '/api/generate': generateHandler,
  '/api/grammar': grammarHandler,
  '/api/plagiarism': plagiarismHandler,
  '/api/readability': readabilityHandler,
  '/api/internal/worker/generation': workerHandler,
  '/api/_internal/worker/generation': workerHandler,
  '/api/internal/reconcile': reconcileHandler,
  '/api/_internal/reconcile': reconcileHandler,
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
  '.map': 'application/json',
};

function applySecurityHeaders(res) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://vpgluvkotanjmbameaxn.supabase.co; worker-src 'self' blob:; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  );
}

/**
 * Augment native http request/response objects with helpers expected by serverless handlers.
 */
function enhanceResponse(res) {
  res.status = function status(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function json(data) {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(data));
    return res;
  };
  res.send = function send(data) {
    if (typeof data === 'object' && !Buffer.isBuffer(data)) {
      return res.json(data);
    }
    res.end(data);
    return res;
  };
}

const ROUTE_BODY_LIMITS = {
  '/api/generate': 1 * 1024 * 1024, // 1 MB (prompt + metadata)
  '/api/internal/worker/generation': 2 * 1024 * 1024, // 2 MB (QStash dispatch envelope)
  '/api/_internal/worker/generation': 2 * 1024 * 1024,
  '/api/grammar': 256 * 1024, // 256 KB
  '/api/plagiarism': 256 * 1024, // 256 KB
  '/api/readability': 256 * 1024, // 256 KB
  '/api/internal/reconcile': 64 * 1024, // 64 KB
  '/api/_internal/reconcile': 64 * 1024,
  '/api/health': 1024, // 1 KB
};
const DEFAULT_MAX_BODY_BYTES = 512 * 1024; // 512 KB

/**
 * Safely parse body with route-aware size limits, while preserving async iterable stream for QStash signature verification.
 */
async function parseRequestBody(req, pathname = '') {
  const maxBytes = ROUTE_BODY_LIMITS[pathname] || DEFAULT_MAX_BODY_BYTES;

  const cl = req.headers['content-length'];
  if (cl) {
    const contentLength = parseInt(cl, 10);
    if (!Number.isNaN(contentLength) && contentLength > maxBytes) {
      const err = new Error('PAYLOAD_TOO_LARGE');
      err.statusCode = 413;
      throw err;
    }
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalBytes += buf.length;
    if (totalBytes > maxBytes) {
      const err = new Error('PAYLOAD_TOO_LARGE');
      err.statusCode = 413;
      throw err;
    }
    chunks.push(buf);
  }
  const rawBody = Buffer.concat(chunks);
  req.rawBody = rawBody;

  // Make req replayable as an async iterable for handlers that use `for await (const chunk of req)`
  req[Symbol.asyncIterator] = async function* asyncIterator() {
    yield rawBody;
  };

  const contentType = req.headers['content-type'] || '';
  if (rawBody.length > 0 && contentType.includes('application/json')) {
    try {
      req.body = JSON.parse(rawBody.toString('utf-8'));
    } catch (_) {
      req.body = {};
    }
  } else if (!req.body) {
    req.body = {};
  }
}

/**
 * Handle serving static files from Vite dist directory with pre-compressed gzip support.
 */
function serveStaticFile(req, res, pathname) {
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.resolve(DIST_DIR, '.' + path.sep + safePath);

  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  // Check if target is a directory or path without extension
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback to index.html
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Cache headers
  if (safePath.startsWith('/assets/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (safePath === '/sw.js' || safePath === '/registerSW.js') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }

  const acceptEncoding = req.headers['accept-encoding'] || '';
  const gzPath = filePath + '.gz';

  if (acceptEncoding.includes('gzip') && fs.existsSync(gzPath)) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(gzPath).pipe(res);
  } else {
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    applySecurityHeaders(res);
    enhanceResponse(res);

    const host = req.headers.host || `localhost:${PORT}`;
    const url = new URL(req.url, `http://${host}`);
    const pathname = url.pathname;

    // Attach parsed query parameters
    const query = {};
    for (const [k, v] of url.searchParams.entries()) {
      query[k] = v;
    }
    req.query = query;

    // 1. API Route matching
    const handler = API_ROUTES[pathname];
    if (handler) {
      res.setHeader('Cache-Control', 'no-store');
      await parseRequestBody(req, pathname);
      return await handler(req, res);
    }

    // 2. Reject unmatched /api routes
    if (pathname.startsWith('/api/')) {
      res.statusCode = 404;
      return res.json({ error: 'Endpoint Not Found', path: pathname });
    }

    // 3. Static asset or SPA routing
    if (req.method === 'GET' || req.method === 'HEAD') {
      return serveStaticFile(req, res, pathname);
    }

    res.statusCode = 405;
    res.end('Method Not Allowed');
  } catch (err) {
    if (err.statusCode === 413 || err.message === 'PAYLOAD_TOO_LARGE') {
      if (!res.headersSent) {
        res.statusCode = 413;
        return res.json({ error: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds maximum allowed size for this route.' });
      }
    }
    console.error('Unhandled Server Error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      const isProd = process.env.NODE_ENV === 'production';
      res.json({
        error: 'INTERNAL_SERVER_ERROR',
        message: isProd ? 'An unexpected server error occurred.' : err.message,
      });
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 PenShift Production Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, gracefully shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, gracefully shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
