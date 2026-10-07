import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

export function parseAndCheckPrivate(ipString) {
  try {
    let clean = ipString.trim();
    if (clean.startsWith('[') && clean.endsWith(']')) {
      clean = clean.slice(1, -1);
    }
    // Check for IPv4 numeric/dword (e.g. 2130706433)
    if (/^\d+$/.test(clean)) {
      const num = parseInt(clean, 10);
      if (num >= 0 && num <= 4294967295) {
        const b1 = (num >>> 24) & 255;
        const b2 = (num >>> 16) & 255;
        const b3 = (num >>> 8) & 255;
        const b4 = num & 255;
        clean = `${b1}.${b2}.${b3}.${b4}`;
      }
    }

    // Check for IPv4 hex (e.g. 0x7f000001)
    if (/^0x[0-9a-fA-F]+$/i.test(clean)) {
      const num = parseInt(clean, 16);
      if (num >= 0 && num <= 4294967295) {
        const b1 = (num >>> 24) & 255;
        const b2 = (num >>> 16) & 255;
        const b3 = (num >>> 8) & 255;
        const b4 = num & 255;
        clean = `${b1}.${b2}.${b3}.${b4}`;
      }
    }

    const addr = ipaddr.parse(clean);
    const range = addr.range();

    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
      const ipv4 = addr.toIPv4Address();
      return ipv4.range() !== 'unicast';
    }

    return range !== 'unicast';
  } catch (e) {
    return null; // Return null if not a valid IP string
  }
}

/**
 * Validates a target URL against SSRF attack vectors.
 * Resolves DNS and inspects all returned IP addresses.
 * Returns { valid: true, resolvedIp, hostname } or { valid: false, reason }.
 */
export async function validateUrlForSSRF(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, reason: 'Invalid protocol. Only http and https are allowed.' };
    }

    const hostname = parsed.hostname;
    if (!hostname) {
      return { valid: false, reason: 'Missing hostname.' };
    }

    // Strict Port Whitelist: Only standard web ports 80 and 443 are permitted
    const port = parsed.port;
    if (port && port !== '80' && port !== '443') {
      return { valid: false, reason: 'Restricted port. Only standard web ports (80, 443) are permitted.' };
    }

    // Direct IP or localhost string check
    if (hostname.toLowerCase() === 'localhost') {
      return { valid: false, reason: 'Localhost is blocked.' };
    }

    // If hostname is directly an IP
    const isPrivDirect = parseAndCheckPrivate(hostname);
    if (isPrivDirect === true) {
      return { valid: false, reason: 'Private or loopback IP range is blocked.' };
    }
    if (isPrivDirect === false) {
      // It's a valid public IP
      let clean = hostname.trim();
      if (clean.startsWith('[') && clean.endsWith(']')) clean = clean.slice(1, -1);
      return { valid: true, resolvedIp: clean, hostname };
    }

    // DNS Lookup validation (inspect all resolved addresses)
    let addresses = [];
    try {
      const results = await lookup(hostname, { all: true });
      addresses = results || [];
    } catch (e) {
      return { valid: false, reason: `DNS resolution failed: ${e.message}` };
    }

    if (addresses.length === 0) {
      return { valid: false, reason: 'Could not resolve domain.' };
    }

    for (const record of addresses) {
      const isPriv = parseAndCheckPrivate(record.address);
      if (isPriv === null) {
        return { valid: false, reason: 'Unparseable IP from DNS lookup.' };
      }
      if (isPriv === true) {
        return { valid: false, reason: `Resolved IP (${record.address}) is in a restricted private range.` };
      }
    }

    return { valid: true, resolvedIp: addresses[0].address, hostname };
  } catch (err) {
    return { valid: false, reason: `Invalid URL format: ${err.message}` };
  }
}

/**
 * Securely fetches an external URL with SSRF protection, socket DNS verification on connect,
 * redirect limits, max byte limits, and timeouts.
 */
export async function safeFetchText(rawUrl, { maxBytes = 500000, timeoutMs = 8000, maxRedirects = 3 } = {}) {
  let currentUrl = rawUrl;
  let redirects = 0;

  while (redirects <= maxRedirects) {
    const ssrfCheck = await validateUrlForSSRF(currentUrl);
    if (!ssrfCheck.valid) {
      throw new Error(`SSRF Guard blocked URL: ${ssrfCheck.reason}`);
    }

    const parsed = new URL(currentUrl);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const result = await new Promise((resolve, reject) => {
      const req = lib.request(
        parsed,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PenShift/3.0',
            'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8'
          },
          timeout: timeoutMs,
          lookup: (hostname, opts, cb) => {
            // R-01 SSRF TOCTOU FIX: Skip second lookup to prevent DNS rebinding.
            // Support Node.js 20+ autoSelectFamily (options.all) and callback polymorphism
            const callback = typeof opts === 'function' ? opts : cb;
            const options = typeof opts === 'object' && opts !== null ? opts : {};
            const family = ssrfCheck.resolvedIp.includes(':') ? 6 : 4;
            if (options.all) {
              callback(null, [{ address: ssrfCheck.resolvedIp, family }]);
            } else {
              callback(null, ssrfCheck.resolvedIp, family);
            }
          }
        },
        (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
            const loc = res.headers.location;
            if (!loc) {
              res.resume();
              return reject(new Error('Redirect with no Location header'));
            }
            res.resume();
            return resolve({ redirect: new URL(loc, currentUrl).href });
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            res.resume();
            return reject(new Error(`HTTP Error ${res.statusCode}`));
          }

          const contentType = res.headers['content-type'] || '';
          if (!contentType.includes('text/') && !contentType.includes('application/json')) {
            req.destroy();
            return reject(new Error(`Unsupported Content-Type: ${contentType}`));
          }

          let data = '';
          let bytes = 0;
          res.setEncoding('utf8');

          res.on('data', (chunk) => {
            bytes += Buffer.byteLength(chunk);
            if (bytes > maxBytes) {
              req.destroy();
              return resolve({ data });
            }
            data += chunk;
          });

          res.on('end', () => resolve({ data }));
          res.on('error', (err) => reject(err));
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      req.on('error', (err) => reject(err));
      req.end();
    });

    if (result.redirect) {
      currentUrl = result.redirect;
      redirects++;
      continue;
    }

    return result.data || '';
  }

  throw new Error('Too many redirects');
}

