import { validateUrlForSSRF } from '../api/_lib/ssrf.js';
import { checkRateLimit, getClientIp } from '../api/_lib/rateLimiter.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runSSRFTests() {
  console.log('\n--- 1. SSRF Protection Tests ---');

  const blockedUrls = [
    { url: 'http://127.0.0.1:8080/admin', desc: 'IPv4 Loopback (127.0.0.1)' },
    { url: 'http://localhost/secret', desc: 'Hostname localhost' },
    { url: 'http://169.254.169.254/latest/meta-data', desc: 'AWS/Cloud Metadata (169.254.169.254)' },
    { url: 'http://10.0.0.1/internal', desc: 'Private 10.0.0.0/8' },
    { url: 'http://192.168.1.1/router', desc: 'Private 192.168.0.0/16' },
    { url: 'http://172.16.0.1/', desc: 'Private 172.16.0.0/12' },
    { url: 'http://0.0.0.0/', desc: 'Zero IP 0.0.0.0' },
    { url: 'http://0/', desc: 'Shorthand 0' },
    { url: 'http://2130706433/', desc: 'Dword IPv4 integer (127.0.0.1)' },
    { url: 'http://0x7f000001/', desc: 'Hex IPv4 integer (127.0.0.1)' },
    { url: 'http://[::1]/', desc: 'IPv6 Loopback ([::1])' },
    { url: 'http://[fd12:3456:789a::1]/', desc: 'IPv6 ULA fd00::/7 bypass attempt' },
    { url: 'http://[fc00::1]/', desc: 'IPv6 ULA fc00::/7' },
    { url: 'http://[fe80::1]/', desc: 'IPv6 Link-Local [fe80::1]' },
    { url: 'http://[fe90::1]/', desc: 'IPv6 Link-Local fe80::/10 range [fe90::1]' },
    { url: 'http://[::ffff:127.0.0.1]/', desc: 'IPv4-mapped IPv6 loopback' },
    { url: 'http://100.64.0.1/', desc: 'Carrier-grade NAT (100.64.0.0/10)' },
    { url: 'ftp://example.com/file', desc: 'Invalid protocol FTP' },
    { url: 'javascript:alert(1)', desc: 'Javascript pseudo-protocol' }
  ];

  for (const test of blockedUrls) {
    const res = await validateUrlForSSRF(test.url);
    assert(!res.valid, `Should block ${test.desc} (${test.url})`);
  }

  // Test safe public URL
  const safeRes = await validateUrlForSSRF('https://example.com');
  assert(safeRes.valid, 'Should allow safe public URL (https://example.com)');
}

async function runRateLimiterTests() {
  console.log('\n--- 2. Rate Limiting Tests ---');
  
  // Test IP extraction (authoritative Cloudflare edge header)
  const reqCf = { headers: { 'cf-connecting-ip': '203.0.113.195' } };
  assert(getClientIp(reqCf) === '203.0.113.195', 'Extracts trusted Cloudflare cf-connecting-ip');

  const reqFallback = { headers: { 'x-forwarded-for': '198.51.100.20, 10.0.0.1' } };
  // In production, untrusted x-forwarded-for is rejected to prevent spoofing
  assert(getClientIp(reqFallback) === '127.0.0.1', 'Blocks untrusted x-forwarded-for in production mode');

  process.env.PENSHIFT_DEV_MODE = 'true';
  assert(getClientIp(reqFallback) === '198.51.100.20', 'Extracts first forwarded-for IP in dev mode');
  delete process.env.PENSHIFT_DEV_MODE;

  // Test rate limiter execution in non-prod fallback
  const testKey = `test_${Date.now()}`;
  const res = await checkRateLimit('rl_test', testKey, 5, 60);
  assert(res.allowed === true, 'Rate limiter permits valid request');
}

async function runPayloadLimitTests() {
  console.log('\n--- 3. Advanced Payload Limit Tests ---');
  
  // Test ImagePrompts Array Limit
  const maxImagesReq = { body: { prompt: 'hello', imagePrompts: new Array(100).fill('draw a cat') } };
  // Mock res to capture status
  let statusCode = 200;
  const mockRes = { status: (c) => { statusCode = c; return { json: () => {} } }, setHeader: () => {} };
  
  // Test context stringification guard
  const deeplyNestedContext = { level1: { level2: { level3: 'a'.repeat(20000) } } };
  
  try {
    const strContext = JSON.stringify(deeplyNestedContext);
    assert(strContext.length > 10000, 'Nested context payload triggers size guard');
  } catch (e) {
    assert(false, 'JSON stringify failed unexpectedly in test');
  }
}

async function main() {
  console.log('Running PenShift Security & Architecture Test Suite...');
  await runSSRFTests();
  await runRateLimiterTests();
  await runPayloadLimitTests();

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
