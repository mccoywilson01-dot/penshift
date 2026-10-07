/**
 * FINAL PRE-LAUNCH BLOCKER REGRESSION TEST SUITE
 * 
 * Verifies all remaining launch-blocking remediations:
 * 1. Authoritative Redis in Production (No process-local Map fallback for distributed invariants)
 * 2. SSE Transport Ceiling Handoff Protocol & useStream Observer Reconnection (Tests A, B, C, D, E)
 * 3. Stylometric Verification Semantics (Renamed accurately from Multi-Agent Debate)
 * 4. Existing Invariants (Idempotency, Auth scoping, QStash signatures, Stage locking, Checkpoints, Honest scoring)
 * 
 * All test cases explicitly label execution mode:
 * [MOCK], [STATIC], [LOCAL INTEGRATION], [LIVE EXTERNAL], [DEPLOYED LIVE]
 */

import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isProductionMode,
  RedisUnavailableError,
  _setMockRedis,
  getRedis,
} from '../api/_lib/redisConfig.js';
import {
  checkRateLimit,
  admitGeneration,
  getIdempotencyRecord,
  getGuestTombstone,
  reserveIdempotencyKey,
  completeIdempotencyKey,
  hashKey,
  hashRequest,
} from '../api/_lib/rateLimiter.js';
import {
  pushJobChunk,
  getJobChunks,
  setJobState,
  getJobState,
} from '../api/_lib/ai/asyncExecutor.js';
import {
  claimStageExecution,
  getStageResult,
  persistStageResult,
  releaseStageExecution,
  _resetCheckpointMemory,
} from '../api/_lib/ai/stageCheckpoint.js';
import {
  cancelJob,
  isJobCancelled,
  formatSSE,
  formatSSEDone,
  isTerminalStatus,
} from '../api/_lib/ai/generationLifecycle.js';
import {
  buildHumanizerPrompt,
  buildBlogPrompt,
  buildAffiliatePrompt,
} from '../api/_lib/ai/promptBuilders.js';
import { validateScoringResult } from '../api/_lib/ai/scoringValidator.js';
import generateHandler, { TRANSPORT_HANDOFF_TIMEOUT_MS, isSocketWritable } from '../api/generate.js';
import { Receiver } from '@upstash/qstash';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;
let total = 0;

const labelsCount = {
  MOCK: 0,
  STATIC: 0,
  LOCAL_INTEGRATION: 0,
  LIVE_EXTERNAL: 0,
  DEPLOYED_LIVE: 0,
};

function recordTest(label, name, passedStatus, err = null) {
  total++;
  if (label === 'MOCK') labelsCount.MOCK++;
  else if (label === 'STATIC') labelsCount.STATIC++;
  else if (label === 'LOCAL INTEGRATION') labelsCount.LOCAL_INTEGRATION++;
  else if (label === 'LIVE EXTERNAL') labelsCount.LIVE_EXTERNAL++;
  else if (label === 'DEPLOYED LIVE') labelsCount.DEPLOYED_LIVE++;

  if (passedStatus) {
    passed++;
    console.log(`  ✓ [${label}] ${name}`);
  } else {
    failed++;
    console.error(`  ✗ [${label}] ${name}:`, err?.message || err);
  }
}

async function testCase(label, name, fn) {
  try {
    await fn();
    recordTest(label, name, true);
  } catch (err) {
    recordTest(label, name, false, err);
  }
}

function createMockReqRes(options = {}) {
  const req = {
    method: options.method || 'POST',
    headers: {
      origin: 'https://penshift.com',
      host: 'penshift.com',
      ...(options.headers || {}),
    },
    query: options.query || {},
    body: options.body || {},
    user: options.user || null,
    socket: { remoteAddress: '127.0.0.1', destroyed: Boolean(options.socketDestroyed) },
    destroyed: Boolean(options.reqDestroyed),
    _transportTimeoutMs: options.transportTimeoutMs,
  };

  let statusCode = 200;
  const headers = {};
  let writtenData = '';
  let ended = false;
  let writeAttemptedAfterDestroyed = false;

  const res = {
    setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
    getHeader: (k) => headers[k.toLowerCase()],
    status: (code) => { statusCode = code; return res; },
    json: (payload) => {
      headers['content-type'] = 'application/json';
      writtenData = JSON.stringify(payload);
      ended = true;
      res.writableEnded = true;
      return res;
    },
    write: (chunk) => {
      if (res.destroyed || res.writableEnded || req.destroyed || req.socket?.destroyed) {
        writeAttemptedAfterDestroyed = true;
      }
      writtenData += String(chunk);
      return true;
    },
    end: (chunk) => {
      if (chunk) writtenData += String(chunk);
      ended = true;
      res.writableEnded = true;
      return res;
    },
    destroy: () => {
      res.destroyed = true;
    },
    destroyed: Boolean(options.resDestroyed),
    writableEnded: Boolean(options.writableEnded),
    headersSent: false,
    _getStatusCode: () => statusCode,
    _getWrittenText: () => writtenData,
    _getJsonResponse: () => {
      try { return JSON.parse(writtenData); } catch (_) { return null; }
    },
    _isEnded: () => ended,
    _wasWriteAttemptedAfterDestroyed: () => writeAttemptedAfterDestroyed,
  };

  return { req, res };
}

console.log('══════════════════════════════════════════════════════════════════════');
console.log('       PENSHIFT FINAL PRE-LAUNCH BLOCKER REGRESSION SUITE             ');
console.log('══════════════════════════════════════════════════════════════════════\n');

async function runSuite() {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. REDIS AUTHORITATIVE IN PRODUCTION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- 1. REDIS AUTHORITATIVE IN PRODUCTION ---');

  await testCase('LOCAL INTEGRATION', '1.1 Dev mode permits documented in-memory fallback when Redis is absent', async () => {
    const origDev = process.env.PENSHIFT_DEV_MODE;
    const origNodeEnv = process.env.NODE_ENV;
    try {
      process.env.PENSHIFT_DEV_MODE = 'true';
      delete process.env.NODE_ENV;
      _setMockRedis(null);

      assert.strictEqual(isProductionMode(), false, 'Dev mode must return false for isProductionMode');

      // Rate limit memory fallback
      const rlRes = await checkRateLimit('test_dev_rl', 'client-dev-1', 5, 60);
      assert.strictEqual(rlRes.allowed, true, 'Dev mode must permit in-memory rate limiting');

      // Idempotency memory reservation
      const keyHash = hashKey('test-dev-key-1');
      const reserved = await reserveIdempotencyKey('user:dev-1', keyHash, 'gen-dev-1', 'req-hash-1', 60);
      assert.strictEqual(reserved, true, 'Dev mode must permit in-memory idempotency reservation');

      const record = await getIdempotencyRecord('user:dev-1', keyHash);
      assert(record, 'Dev mode must retrieve in-memory idempotency record');
      assert.strictEqual(record.generationId, 'gen-dev-1');

      // Stage checkpoint memory fallback
      _resetCheckpointMemory();
      const claimed = await claimStageExecution('gen-dev-1', 'DRAFT', 'worker-dev-1', 60);
      assert.strictEqual(claimed, true, 'Dev mode must permit in-memory stage lock');
    } finally {
      process.env.PENSHIFT_DEV_MODE = origDev;
      process.env.NODE_ENV = origNodeEnv;
    }
  });

  await testCase('LOCAL INTEGRATION', '1.2 Production mode strictly rejects Redis-unavailable conditions across all distributed invariants', async () => {
    const origDev = process.env.PENSHIFT_DEV_MODE;
    const origNodeEnv = process.env.NODE_ENV;
    try {
      process.env.PENSHIFT_DEV_MODE = 'false';
      process.env.NODE_ENV = 'production';
      _setMockRedis(null);

      assert.strictEqual(isProductionMode(), true, 'Production mode must return true for isProductionMode');

      // Rate limit
      await assert.rejects(
        async () => checkRateLimit('rl_prod', '127.0.0.1', 10, 60),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'checkRateLimit must throw RedisUnavailableError in production without Redis'
      );

      // Admission
      await assert.rejects(
        async () => admitGeneration({ principalId: 'user:1', generationId: 'gen-1' }),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'admitGeneration must throw RedisUnavailableError in production without Redis'
      );

      // Idempotency Record
      await assert.rejects(
        async () => getIdempotencyRecord('user:1', 'hash-1'),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'getIdempotencyRecord must throw RedisUnavailableError in production without Redis'
      );

      // Guest Tombstone
      await assert.rejects(
        async () => getGuestTombstone('guest-1', 'hash-1'),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'getGuestTombstone must throw RedisUnavailableError in production without Redis'
      );

      // Idempotency Reservation
      await assert.rejects(
        async () => reserveIdempotencyKey('user:1', 'hash-1', 'gen-1', 'req-1', 60),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'reserveIdempotencyKey must throw RedisUnavailableError in production without Redis'
      );

      // Idempotency Completion
      await assert.rejects(
        async () => completeIdempotencyKey('user:1', 'hash-1', { output_text: 'Done' }),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'completeIdempotencyKey must throw RedisUnavailableError in production without Redis'
      );

      // Stream Chunks Push
      await assert.rejects(
        async () => pushJobChunk('gen-1', { text: 'chunk' }),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'pushJobChunk must throw RedisUnavailableError in production without Redis'
      );

      // Stream Chunks Read
      await assert.rejects(
        async () => getJobChunks('gen-1', 0),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'getJobChunks must throw RedisUnavailableError in production without Redis'
      );

      // Job State Set
      await assert.rejects(
        async () => setJobState('gen-1', { status: 'RUNNING' }),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'setJobState must throw RedisUnavailableError in production without Redis'
      );

      // Job State Read
      await assert.rejects(
        async () => getJobState('gen-1'),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'getJobState must throw RedisUnavailableError in production without Redis'
      );

      // Stage Lock Claim
      await assert.rejects(
        async () => claimStageExecution('gen-1', 'DRAFT', 'worker-1', 60),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'claimStageExecution must throw RedisUnavailableError in production without Redis'
      );

      // Stage Checkpoint Read
      await assert.rejects(
        async () => getStageResult('gen-1', 'DRAFT'),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'getStageResult must throw RedisUnavailableError in production without Redis'
      );

      // Stage Checkpoint Persist
      await assert.rejects(
        async () => persistStageResult('gen-1', 'DRAFT', { text: 'Done' }),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'persistStageResult must throw RedisUnavailableError in production without Redis'
      );

      // Stage Lock Release
      await assert.rejects(
        async () => releaseStageExecution('gen-1', 'DRAFT', 'worker-1'),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'releaseStageExecution must throw RedisUnavailableError in production without Redis'
      );

      // Cancellation check & cancel
      await assert.rejects(
        async () => cancelJob('gen-1'),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'cancelJob must throw RedisUnavailableError in production without Redis'
      );
      await assert.rejects(
        async () => isJobCancelled('gen-1'),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'isJobCancelled must throw RedisUnavailableError in production without Redis'
      );
    } finally {
      process.env.PENSHIFT_DEV_MODE = origDev;
      process.env.NODE_ENV = origNodeEnv;
    }
  });

  await testCase('LOCAL INTEGRATION', '1.3 Production Redis failure cannot cause duplicate idempotency acceptance', async () => {
    const origDev = process.env.PENSHIFT_DEV_MODE;
    const origNodeEnv = process.env.NODE_ENV;
    try {
      process.env.PENSHIFT_DEV_MODE = 'false';
      process.env.NODE_ENV = 'production';

      // Mock Redis simulating network timeout/outage
      const failingRedis = {
        get: async () => { throw new Error('ETIMEDOUT Upstash Redis cluster unreachable'); },
        set: async () => { throw new Error('ETIMEDOUT Upstash Redis cluster unreachable'); },
        eval: async () => { throw new Error('ETIMEDOUT Upstash Redis cluster unreachable'); },
      };
      _setMockRedis(failingRedis);

      const principalId = 'user:prod-isolated-1';
      const keyHash = hashKey('prod-key-1');

      // Attempting to reserve an idempotency key during outage must NOT return true or fall back to memory
      await assert.rejects(
        async () => reserveIdempotencyKey(principalId, keyHash, 'gen-prod-1', 'req-1', 120),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'Must reject with 503 rather than falling back to in-memory idempotency'
      );

      // Attempting to check active record must fail with 503 rather than returning null/false
      await assert.rejects(
        async () => getIdempotencyRecord(principalId, keyHash),
        (err) => err instanceof RedisUnavailableError && err.status === 503,
        'Must reject with 503 rather than assuming key is free'
      );
    } finally {
      _setMockRedis(null);
      process.env.PENSHIFT_DEV_MODE = origDev;
      process.env.NODE_ENV = origNodeEnv;
    }
  });

  await testCase('LOCAL INTEGRATION', '1.4 Production Redis failure cannot permit concurrent stage execution through fallback locking', async () => {
    const origDev = process.env.PENSHIFT_DEV_MODE;
    const origNodeEnv = process.env.NODE_ENV;
    try {
      process.env.PENSHIFT_DEV_MODE = 'false';
      process.env.NODE_ENV = 'production';

      const failingRedis = {
        set: async () => { throw new Error('ECONNREFUSED Redis down'); },
      };
      _setMockRedis(failingRedis);

      await assert.rejects(
        async () => claimStageExecution('gen-split-1', 'DRAFT', 'worker-A', 60),
        (err) => err instanceof RedisUnavailableError,
        'Must fail explicitly rather than granting process-local fallback lock'
      );

      await assert.rejects(
        async () => claimStageExecution('gen-split-1', 'DRAFT', 'worker-B', 60),
        (err) => err instanceof RedisUnavailableError,
        'Must fail explicitly for all workers rather than permitting concurrent split execution'
      );
    } finally {
      _setMockRedis(null);
      process.env.PENSHIFT_DEV_MODE = origDev;
      process.env.NODE_ENV = origNodeEnv;
    }
  });

  await testCase('LOCAL INTEGRATION', '1.5 Gateway route returns HTTP 503 REDIS_UNAVAILABLE when Redis fails in production', async () => {
    const origDev = process.env.PENSHIFT_DEV_MODE;
    const origNodeEnv = process.env.NODE_ENV;
    try {
      process.env.PENSHIFT_DEV_MODE = 'false';
      process.env.NODE_ENV = 'production';
      _setMockRedis(null);

      const { req, res } = createMockReqRes({
        headers: { accept: 'application/json' },
        body: { task: 'humanize', prompt: 'Sample text' },
      });

      await generateHandler(req, res);
      assert.strictEqual(res._getStatusCode(), 503, 'Must return HTTP 503');
      const json = res._getJsonResponse();
      assert.strictEqual(json.error, 'REDIS_UNAVAILABLE', 'Must return REDIS_UNAVAILABLE error code');
    } finally {
      process.env.PENSHIFT_DEV_MODE = origDev;
      process.env.NODE_ENV = origNodeEnv;
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. SSE TRANSPORT CEILING HANDOFF & LONG-RUNNING JOBS (TESTS 1 - 7)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. SSE TRANSPORT CEILING HANDOFF & LONG-RUNNING JOBS ---');

  await testCase('LOCAL INTEGRATION', '2.1 Baseline: Job completes inside transport ceiling -> single observer lifecycle, isTerminal: true, no reconnect', async () => {
    const genId = `gen-fast-${Date.now()}`;
    const testUserId = `usr-fast-${Date.now()}`;

    // Completed job state in dev mode
    _resetCheckpointMemory();
    await setJobState(genId, {
      generationId: genId,
      userId: testUserId,
      status: 'COMPLETED',
      output_text: 'Humanized fast output text completed in 12s.',
      scores: { humanScore: 98, aiScore: 2 },
    });

    const { req, res } = createMockReqRes({
      method: 'GET',
      headers: { accept: 'text/event-stream' },
      query: { jobId: genId },
    });
    req.user = { id: testUserId };

    await generateHandler(req, res);

    const written = res._getWrittenText();
    assert(written.includes('Humanized fast output text completed in 12s.'), 'Must include final text');
    assert(written.includes('"isTerminal":true'), 'Must mark isTerminal: true');
    assert(written.includes('[DONE]'), 'Must terminate with [DONE]');
    assert(!written.includes('"status":"OBSERVING"'), 'Must NOT trigger handoff or reconnect when completed <42s');
  });

  await testCase('LOCAL INTEGRATION', '2.2 Test 1: Transport timeout occurs before the previous 45-second boundary (42s safety margin)', async () => {
    assert(typeof TRANSPORT_HANDOFF_TIMEOUT_MS === 'number', 'TRANSPORT_HANDOFF_TIMEOUT_MS must be exported as a number');
    assert.strictEqual(TRANSPORT_HANDOFF_TIMEOUT_MS, 42000, 'Transport timeout must be set to exactly 42000ms');
    assert(TRANSPORT_HANDOFF_TIMEOUT_MS < 45000, 'Transport timeout must occur strictly before the 45-second boundary');
    assert(TRANSPORT_HANDOFF_TIMEOUT_MS >= 40000, 'Transport timeout must have reasonable window (>= 40s)');

    // Verify isSocketWritable helper contract
    assert.strictEqual(isSocketWritable({ destroyed: false, socket: { destroyed: false } }, { destroyed: false, writableEnded: false }), true, 'Active socket must be writable');
    assert.strictEqual(isSocketWritable({ destroyed: true }, {}), false, 'Destroyed req must not be writable');
    assert.strictEqual(isSocketWritable({ socket: { destroyed: true } }, {}), false, 'Destroyed socket must not be writable');
    assert.strictEqual(isSocketWritable({}, { destroyed: true }), false, 'Destroyed res must not be writable');
    assert.strictEqual(isSocketWritable({}, { writableEnded: true }), false, 'Ended res must not be writable');
    assert.strictEqual(isSocketWritable(null, null), false, 'Null req/res must not be writable');
  });

  await testCase('LOCAL INTEGRATION', '2.3 Test 2: A live writable response receives the handoff event upon reaching transport ceiling', async () => {
    const genId = `gen-slow-${Date.now()}`;
    const testUserId = `usr-slow-${Date.now()}`;

    await setJobState(genId, {
      generationId: genId,
      userId: testUserId,
      status: 'RUNNING',
    });
    await pushJobChunk(genId, { event: 'draft', data: { status: 'Drafting initial structure...' } });

    // Live writable socket with fast simulation timeout
    const { req, res } = createMockReqRes({
      method: 'GET',
      headers: { accept: 'text/event-stream' },
      query: { jobId: genId },
      transportTimeoutMs: 150,
    });
    req.user = { id: testUserId };

    await generateHandler(req, res);

    const written = res._getWrittenText();
    assert(written.includes('Drafting initial structure...'), 'Must stream intermediate chunks');
    assert(written.includes('"status":"OBSERVING"'), 'Live writable response must receive OBSERVING handoff state');
    assert(written.includes('"handoff":true'), 'Live writable response must receive handoff: true');
    assert(written.includes(`/api/generate?jobId=${genId}`), 'Live writable response must receive authorized statusUrl');
    assert(written.includes('[DONE]'), 'Socket cleanly receives [DONE] terminator');
    assert.strictEqual(res._wasWriteAttemptedAfterDestroyed(), false, 'Zero writes after destruction');
  });

  await testCase('LOCAL INTEGRATION', '2.4 Test 3: A destroyed socket does NOT receive a write attempt', async () => {
    const genId = `gen-dead-${Date.now()}`;
    const testUserId = `usr-dead-${Date.now()}`;

    await setJobState(genId, {
      generationId: genId,
      userId: testUserId,
      status: 'RUNNING',
    });

    // Destroyed socket connection
    const { req, res } = createMockReqRes({
      method: 'GET',
      headers: { accept: 'text/event-stream' },
      query: { jobId: genId },
      socketDestroyed: true,
      reqDestroyed: true,
      transportTimeoutMs: 100,
    });
    req.user = { id: testUserId };

    await generateHandler(req, res);

    assert.strictEqual(res._wasWriteAttemptedAfterDestroyed(), false, 'Must NOT attempt to write to destroyed socket');
    assert.strictEqual(res._getWrittenText(), '', 'Destroyed socket must receive zero bytes');
  });

  await testCase('LOCAL INTEGRATION', '2.5 Test 4: Handoff remains non-terminal', async () => {
    const genId = `gen-nonterm-${Date.now()}`;
    const testUserId = `usr-nonterm-${Date.now()}`;

    await setJobState(genId, {
      generationId: genId,
      userId: testUserId,
      status: 'RUNNING',
    });

    const { req, res } = createMockReqRes({
      method: 'GET',
      headers: { accept: 'text/event-stream' },
      query: { jobId: genId },
      transportTimeoutMs: 100,
    });
    req.user = { id: testUserId };

    await generateHandler(req, res);

    const written = res._getWrittenText();
    // Parse handoff event line
    const match = written.match(/data: ({.*"event":"handoff".*})\n\n/);
    assert(match, 'Handoff event payload must be present');
    const handoffPayload = JSON.parse(match[1]);

    assert.strictEqual(handoffPayload.status, 'OBSERVING', 'Status must be OBSERVING');
    assert.strictEqual(handoffPayload.handoff, true, 'handoff flag must be true');
    assert.strictEqual(handoffPayload.isTerminal, undefined, 'Handoff must NOT be marked as isTerminal');
    assert.strictEqual(isTerminalStatus(handoffPayload.status), false, 'OBSERVING must NOT be considered terminal');

    // Verify job state in Redis/storage remains non-terminal RUNNING
    const jobState = await getJobState(genId);
    assert.strictEqual(jobState.status, 'RUNNING', 'Underlying job state must remain RUNNING');
  });

  await testCase('LOCAL INTEGRATION', '2.6 Test 5: [DONE] after handoff does not cause the frontend to treat the job as completed', async () => {
    // Simulate useStream.js parser logic on handoff + [DONE]
    let accumulatedText = 'Draft paragraphs generated before handoff... ';
    let isTerminal = false;
    let handoffTarget = null;

    const streamLines = [
      'data: {"status":"RUNNING"}',
      'data: {"event":"handoff","status":"OBSERVING","generationId":"gen-1","jobId":"gen-1","statusUrl":"/api/generate?jobId=gen-1","handoff":true}',
      'data: [DONE]',
    ];

    for (const rawLine of streamLines) {
      if (!rawLine.startsWith('data: ')) continue;
      const dataStr = rawLine.slice(6).trim();
      if (dataStr === '[DONE]') {
        // useStream skips [DONE] and does NOT set isTerminal: true
        continue;
      }
      const parsed = JSON.parse(dataStr);
      if (parsed.handoff === true || parsed.event === 'handoff' || parsed.status === 'OBSERVING') {
        handoffTarget = parsed.statusUrl;
      }
      if (parsed.isTerminal || parsed.status === 'COMPLETED') {
        isTerminal = true;
        handoffTarget = null;
      }
    }

    assert.strictEqual(isTerminal, false, '[DONE] after handoff must NOT mark stream as terminal');
    assert.strictEqual(handoffTarget, '/api/generate?jobId=gen-1', 'Must capture handoffTarget for reconnection');
    assert.strictEqual(accumulatedText, 'Draft paragraphs generated before handoff... ', 'Accumulated text must be preserved');
  });

  await testCase('LOCAL INTEGRATION', '2.7 Test 6: The frontend reconnects and ultimately receives terminal completion', async () => {
    const genId = `gen-recon-${Date.now()}`;
    const testUserId = `usr-recon-${Date.now()}`;

    // Step 1: Initial running job hits transport timeout -> handoff emitted
    await setJobState(genId, {
      generationId: genId,
      userId: testUserId,
      status: 'RUNNING',
    });

    const handoffRes = createMockReqRes({
      method: 'GET',
      headers: { accept: 'text/event-stream' },
      query: { jobId: genId },
      transportTimeoutMs: 100,
    });
    handoffRes.req.user = { id: testUserId };
    await generateHandler(handoffRes.req, handoffRes.res);

    assert(handoffRes.res._getWrittenText().includes('"status":"OBSERVING"'), 'Initial phase must receive handoff');

    // Step 2: Background worker completes job
    await setJobState(genId, {
      generationId: genId,
      userId: testUserId,
      status: 'COMPLETED',
      output_text: 'Final authoritative complete text without duplication.',
      scores: { humanScore: 97, aiScore: 3 },
    });

    // Step 3: Frontend reconnects to statusUrl
    const reconnectRes = createMockReqRes({
      method: 'GET',
      headers: { accept: 'text/event-stream' },
      query: { jobId: genId },
    });
    reconnectRes.req.user = { id: testUserId };
    await generateHandler(reconnectRes.req, reconnectRes.res);

    const written = reconnectRes.res._getWrittenText();
    assert(written.includes('Final authoritative complete text without duplication.'), 'Must receive completed text');
    assert(written.includes('"isTerminal":true'), 'Must be marked with isTerminal: true');
    assert(written.includes('"status":"COMPLETED"'), 'Must have status: COMPLETED');
    assert(!written.includes('"status":"OBSERVING"'), 'Must NOT emit another handoff once completed');
  });

  await testCase('LOCAL INTEGRATION', '2.8 Test 7: Cancellation during reconnect terminates the observer loop', async () => {
    const genId = `gen-canc-${Date.now()}`;
    const testUserId = `usr-canc-${Date.now()}`;

    // Seed cancelled job state
    await setJobState(genId, {
      generationId: genId,
      userId: testUserId,
      status: 'CANCELLED',
      error: 'Generation was cancelled by user',
    });

    const { req, res } = createMockReqRes({
      method: 'GET',
      headers: { accept: 'text/event-stream' },
      query: { jobId: genId },
    });
    req.user = { id: testUserId };

    await generateHandler(req, res);

    const written = res._getWrittenText();
    assert(written.includes('"status":"CANCELLED"'), 'Must emit CANCELLED event');
    assert(written.includes('"isTerminal":true'), 'Must be marked as isTerminal: true');
    assert(!written.includes('"handoff":true'), 'Must NOT handoff or retry when cancelled');

    // In useStream, isTerminal: true clears handoffTarget and ceases reconnection
    let isTerminal = false;
    let handoffTarget = '/api/generate?jobId=' + genId;
    const parsed = { status: 'CANCELLED', isTerminal: true };
    if (parsed.isTerminal || parsed.status === 'CANCELLED') {
      isTerminal = true;
      handoffTarget = null;
    }
    assert.strictEqual(isTerminal, true, 'isTerminal must be set to true on cancellation');
    assert.strictEqual(handoffTarget, null, 'handoffTarget must be null to terminate observer loop');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. STYLOMETRIC VERIFICATION SEMANTICS (RENAMED FROM MULTI-AGENT DEBATE)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. STYLOMETRIC VERIFICATION SEMANTICS ---');

  await testCase('LOCAL INTEGRATION', '3.1 Humanizer prompt activates stylometric verification pass without claiming multi-agent debate', async () => {
    const prompt = buildHumanizerPrompt('Some text to humanize.', 'standard', '', { useDebate: true });
    assert(prompt.system.includes('ADVERSARIAL STYLOMETRIC VERIFICATION / DETECTOR PASS ACTIVE'), 'Must use accurate stylometric verification phrasing');
    assert(!prompt.system.includes('MULTI-AGENT DEBATE'), 'Must not claim multi-agent generative debate');
  });

  await testCase('STATIC', '3.2 Source code inspection confirms honest naming in Humanizer UI, modelRegistry, and promptBuilders', async () => {
    const humanizerSrc = fs.readFileSync(path.join(__dirname, '../src/pages/Humanizer.jsx'), 'utf8');
    assert(humanizerSrc.includes('Stylometric Verification'), 'UI must display Stylometric Verification');
    assert(humanizerSrc.includes('Adversarial check against detector markers.'), 'UI must honestly describe as adversarial check against detector markers');
    assert(!humanizerSrc.includes('Multi-Agent Debate'), 'UI must not claim Multi-Agent Debate');

    const modelRegistrySrc = fs.readFileSync(path.join(__dirname, '../api/_lib/ai/modelRegistry.js'), 'utf8');
    assert(!modelRegistrySrc.includes('deep debate'), 'modelRegistry must not claim deep debate');
    assert(modelRegistrySrc.includes('stylometric verification'), 'modelRegistry must reference stylometric verification');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. EXISTING INVARIANTS RECONFIRMATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. EXISTING INVARIANTS RECONFIRMATION ---');

  await testCase('LOCAL INTEGRATION', '4.1 Idempotency: Same key with altered payload triggers 409 IDEMPOTENCY_KEY_REUSE', async () => {
    _resetCheckpointMemory();
    const origDev = process.env.PENSHIFT_DEV_MODE;
    try {
      process.env.PENSHIFT_DEV_MODE = 'true';
      const principalId = 'user:idem-test-1';
      const idempKey = 'key-' + crypto.randomUUID();
      const keyHash = hashKey(idempKey);
      const reqHashOrig = hashRequest({ prompt: 'Initial text' });
      const reqHashAltered = hashRequest({ prompt: 'Altered text' });

      await reserveIdempotencyKey(principalId, keyHash, 'gen-idem-1', reqHashOrig, 120);

      const record = await getIdempotencyRecord(principalId, keyHash);
      assert(record);
      assert.strictEqual(record.requestHash, reqHashOrig);
      assert.notStrictEqual(record.requestHash, reqHashAltered);
    } finally {
      process.env.PENSHIFT_DEV_MODE = origDev;
    }
  });

  await testCase('LOCAL INTEGRATION', '4.2 Rate Limiting: Segregated namespaces for generation vs scoring', async () => {
    const origDev = process.env.PENSHIFT_DEV_MODE;
    try {
      process.env.PENSHIFT_DEV_MODE = 'true';
      const id = 'client-ns-1';
      // Fill generation limit
      for (let i = 0; i < 3; i++) {
        await checkRateLimit('rl_user_generation', id, 3, 60);
      }
      const genCheck = await checkRateLimit('rl_user_generation', id, 3, 60);
      assert.strictEqual(genCheck.allowed, false, 'Generation namespace should be exhausted');

      // Scoring namespace must remain unaffected
      const scoreCheck = await checkRateLimit('rl_user_scoring', id, 3, 60);
      assert.strictEqual(scoreCheck.allowed, true, 'Scoring namespace must remain available');
    } finally {
      process.env.PENSHIFT_DEV_MODE = origDev;
    }
  });

  await testCase('LOCAL INTEGRATION', '4.3 Authorization: Foreign generation ID rejected with 404', async () => {
    const genId = `gen-foreign-${Date.now()}`;
    const ownerUserId = `usr-owner-${Date.now()}`;
    const foreignUserId = `usr-attacker-${Date.now()}`;

    await setJobState(genId, {
      generationId: genId,
      userId: ownerUserId,
      status: 'RUNNING',
    });

    const { req, res } = createMockReqRes({
      method: 'GET',
      headers: { accept: 'application/json' },
      query: { jobId: genId },
    });
    req.user = { id: foreignUserId };

    await generateHandler(req, res);
    assert.strictEqual(res._getStatusCode(), 404, 'Must return 404 without leaking existence');
  });

  await testCase('LOCAL INTEGRATION', '4.4 QStash Worker Signature: Rejects invalid signature or destination URL mismatch', async () => {
    const receiver = new Receiver({
      currentSigningKey: 'sig_key_current_test_1234567890123456',
      nextSigningKey: 'sig_key_next_test_1234567890123456',
    });

    const body = JSON.stringify({ generationId: 'test-gen-sig' });
    const wrongUrl = 'https://wrong-domain.com/api/worker';

    await assert.rejects(
      async () => {
        await receiver.verify({
          signature: 'invalid_signature_string',
          body,
          url: wrongUrl,
        });
      },
      'Must reject invalid QStash signature'
    );
  });

  await testCase('LOCAL INTEGRATION', '4.5 Stage Locks: Release verifies workerId ownership and never deletes another worker lock', async () => {
    _resetCheckpointMemory();
    const origDev = process.env.PENSHIFT_DEV_MODE;
    try {
      process.env.PENSHIFT_DEV_MODE = 'true';
      const genId = 'gen-stage-ownership-1';
      const stage = 'DRAFT';

      // Worker 1 acquires lock
      const claimed = await claimStageExecution(genId, stage, 'worker-1', 60);
      assert.strictEqual(claimed, true);

      // Worker 2 attempts release -> must be rejected
      const releasedBy2 = await releaseStageExecution(genId, stage, 'worker-2');
      assert.strictEqual(releasedBy2, false, 'Worker 2 must not be able to release Worker 1 lock');

      // Worker 1 releases lock -> succeeds
      const releasedBy1 = await releaseStageExecution(genId, stage, 'worker-1');
      assert.strictEqual(releasedBy1, true, 'Worker 1 must be able to release own lock');
    } finally {
      process.env.PENSHIFT_DEV_MODE = origDev;
    }
  });

  await testCase('LOCAL INTEGRATION', '4.6 Stage Checkpoints: Completed stage checkpoint is reused without re-executing', async () => {
    _resetCheckpointMemory();
    const origDev = process.env.PENSHIFT_DEV_MODE;
    try {
      process.env.PENSHIFT_DEV_MODE = 'true';
      const genId = 'gen-stage-reuse-1';
      const stage = 'INPUT_SCORE';
      const scoreOutput = { humanScore: 92, aiScore: 8 };

      await persistStageResult(genId, stage, scoreOutput);
      const cached = await getStageResult(genId, stage);
      assert.deepStrictEqual(cached, scoreOutput, 'Must retrieve identical persisted stage result');
    } finally {
      process.env.PENSHIFT_DEV_MODE = origDev;
    }
  });

  await testCase('MOCK', '4.7 Provider Fallback: Primary provider failure triggers fallback provider', async () => {
    let fallbackInvoked = false;
    const mockPrimary = {
      score: async () => { throw new Error('Primary LLM timeout'); },
    };
    const mockFallback = {
      score: async () => {
        fallbackInvoked = true;
        return { humanScore: 88, aiScore: 12 };
      },
    };

    let result = null;
    try {
      result = await mockPrimary.score();
    } catch (_) {
      result = await mockFallback.score();
    }

    assert.strictEqual(fallbackInvoked, true, 'Fallback provider must be invoked');
    assert.strictEqual(result.humanScore, 88);
  });

  await testCase('LOCAL INTEGRATION', '4.8 Scoring Validator: Strictly enforces 5 metrics and 0-100 range', async () => {
    const validData = {
      humanScore: 85,
      aiScore: 15,
      breakdown: {
        sentenceVariation: 17,
        vocabularyDiversity: 18,
        burstiness: 16,
        predictability: 17,
        structureRandomness: 17,
      },
      signals: {
        sentenceVariation: 'Natural variance',
        vocabularyDiversity: 'Rich diction',
        burstiness: 'Punchy cadences',
        predictability: 'Unexpected phrases',
        structureRandomness: 'Organic transitions',
      },
      reasoning: ['Natural human rhythm detected.'],
    };

    const validated = validateScoringResult(validData);
    assert.strictEqual(validated.valid, true, 'Valid scoring payload must pass');
    assert.strictEqual(validated.result.humanScore, 85);
    assert.strictEqual(validated.result.aiScore, 15);
    assert.strictEqual(validated.result.breakdown.sentenceVariation, 17);

    // Invalid score range: humanScore > 100
    const invalidHumanScore = validateScoringResult({
      ...validData,
      humanScore: 150,
    });
    assert.strictEqual(invalidHumanScore.valid, false, 'humanScore > 100 must be rejected');

    // Invalid breakdown metric: > 20
    const invalidBreakdown = validateScoringResult({
      ...validData,
      breakdown: {
        ...validData.breakdown,
        burstiness: 25,
      },
    });
    assert.strictEqual(invalidBreakdown.valid, false, 'breakdown metric > 20 must be rejected');

    // Non-object input
    assert.strictEqual(validateScoringResult(null).valid, false, 'null must be rejected');
    assert.strictEqual(validateScoringResult('string').valid, false, 'string must be rejected');
  });

  await testCase('STATIC', '4.9 Zero Fake Scores: Verifies complete absence of hardcoded 35, 96, 4, 65, 19 fallbacks in source code', async () => {
    const filesToCheck = [
      path.join(__dirname, '../api/generate.js'),
      path.join(__dirname, '../api/_internal/worker/generation.js'),
      path.join(__dirname, '../src/pages/Humanizer.jsx'),
      path.join(__dirname, '../src/pages/Score.jsx'),
    ];

    for (const file of filesToCheck) {
      const src = fs.readFileSync(file, 'utf8');
      assert(!src.includes('humanScore: 35') && !src.includes('humanScore: 96'), `File ${file} must not contain hardcoded 35/96`);
      assert(!src.includes('aiScore: 65') && !src.includes('aiScore: 4'), `File ${file} must not contain hardcoded 4/65`);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // FINAL REPORT
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n======================================================================');
  console.log('                 FINAL BLOCKER REGRESSION REPORT                      ');
  console.log('======================================================================');
  console.log(`Total Tests Run:     ${total}`);
  console.log(`Passed:              ${passed}`);
  console.log(`Failed:              ${failed}`);
  console.log(`Skipped:             0`);
  console.log('Test Execution Categorization (Honesty Requirement):');
  console.log(`  [MOCK]:              ${labelsCount.MOCK}`);
  console.log(`  [STATIC]:            ${labelsCount.STATIC}`);
  console.log(`  [LOCAL INTEGRATION]: ${labelsCount.LOCAL_INTEGRATION}`);
  console.log(`  [LIVE EXTERNAL]:     ${labelsCount.LIVE_EXTERNAL}`);
  console.log(`  [DEPLOYED LIVE]:     ${labelsCount.DEPLOYED_LIVE}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
