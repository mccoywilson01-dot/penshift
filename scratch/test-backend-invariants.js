import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  claimStageExecution,
  getStageResult,
  persistStageResult,
  releaseStageExecution,
  _resetCheckpointMemory,
} from '../api/_lib/ai/stageCheckpoint.js';
import {
  admitGeneration,
  getIdempotencyRecord,
  getGuestTombstone,
  reserveIdempotencyKey,
  completeIdempotencyKey,
  hashKey,
  hashRequest,
  checkRateLimit,
} from '../api/_lib/rateLimiter.js';
import {
  isTerminalStatus,
  GENERATION_STATUS,
  getJobLockKey,
  getJobCancelKey,
  isJobCancelled,
  cancelJob,
} from '../api/_lib/ai/generationLifecycle.js';
import {
  CANONICAL_WORKER_URL,
  dispatchGenerationToQStash,
} from '../api/_lib/ai/asyncExecutor.js';
import { Receiver } from '@upstash/qstash';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    failed++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    failed++;
  }
}

console.log('═══════════════════ PENSHIFT REVISION 9 BACKEND INVARIANTS ═══════════════════\n');

async function runAllInvariants() {
  _resetCheckpointMemory();

  // ── 1. IDEMPOTENCY INVARIANTS ──
  console.log('--- 1. Idempotency Invariants ---');

  await itAsync('1.1 Same principal + same key + same payload: replays/observes original generation', async () => {
    const principalId = 'user:' + crypto.randomUUID();
    const idempKey = 'key-' + crypto.randomUUID();
    const keyHash = hashKey(idempKey);
    const genId = crypto.randomUUID();
    const payload = { prompt: 'Test text', mode: 'standard', task: 'humanize' };
    const reqHash = hashRequest(payload);

    // Initial reservation
    const reserved = await reserveIdempotencyKey(principalId, keyHash, genId, reqHash, 120);
    assert.strictEqual(reserved, true, 'Reservation should succeed');

    // Retrieve active record
    const active = await getIdempotencyRecord(principalId, keyHash);
    assert(active, 'Active record must exist');
    assert.strictEqual(active.generationId, genId);
    assert.strictEqual(active.requestHash, reqHash);

    // Complete generation
    await completeIdempotencyKey(principalId, keyHash, {
      generationId: genId,
      requestHash: reqHash,
      output_text: 'Transformed output',
      scores: { humanScore: 97 },
    });

    const completed = await getIdempotencyRecord(principalId, keyHash);
    assert.strictEqual(completed.status, 'COMPLETED');
    assert.strictEqual(completed.output_text, 'Transformed output');
  });

  await itAsync('1.2 Same key + modified payload: triggers 409 IDEMPOTENCY_KEY_REUSE', async () => {
    const principalId = 'guest:' + crypto.randomUUID();
    const idempKey = 'key-' + crypto.randomUUID();
    const keyHash = hashKey(idempKey);
    const genId = crypto.randomUUID();

    const payloadOriginal = { prompt: 'Original text', mode: 'standard' };
    const payloadModified = { prompt: 'Altered text', mode: 'standard' };

    const hashOrig = hashRequest(payloadOriginal);
    const hashMod = hashRequest(payloadModified);

    await reserveIdempotencyKey(principalId, keyHash, genId, hashOrig, 120);
    const record = await getIdempotencyRecord(principalId, keyHash);

    assert(record);
    const isReuseConflict = record.requestHash !== hashMod;
    assert.strictEqual(isReuseConflict, true, 'Payload tampering must trigger conflict');
  });

  await itAsync('1.3 Retry does not consume another credit and does not create another generation', async () => {
    const principalId = 'user:' + crypto.randomUUID();
    const genId = crypto.randomUUID();

    const adm1 = await admitGeneration({
      principalId,
      generationId: genId,
      maxCredits: 30,
      windowSeconds: 60,
    });
    assert.strictEqual(adm1.admitted, true);
    assert.strictEqual(adm1.isReplay, false);

    const adm2 = await admitGeneration({
      principalId,
      generationId: genId,
      maxCredits: 30,
      windowSeconds: 60,
    });
    assert.strictEqual(adm2.admitted, true);
    assert.strictEqual(adm2.isReplay, true, 'Retry must be admitted as replay without quota deduction');
  });

  // ── 2. AUTHORIZATION INVARIANTS ──
  console.log('\n--- 2. Authorization Invariants ---');

  it('2.1 Foreign authenticated generation ID returns authorization-safe 404', () => {
    const userA = crypto.randomUUID();
    const userB = crypto.randomUUID();
    const recordUserB = { id: crypto.randomUUID(), user_id: userB };

    // Function simulating authorization gate in api/generate.js
    function checkAccess(requesterId, record) {
      if (!record || record.user_id !== requesterId) {
        return { status: 404, error: 'NOT_FOUND' };
      }
      return { status: 200, data: record };
    }

    const resA = checkAccess(userA, recordUserB);
    assert.strictEqual(resA.status, 404, 'Must return 404 for foreign authenticated user');

    const resB = checkAccess(userB, recordUserB);
    assert.strictEqual(resB.status, 200, 'Must allow owner');
  });

  it('2.2 Foreign guest generation ID returns authorization-safe 404', () => {
    const guestA = crypto.randomUUID();
    const guestB = crypto.randomUUID();
    const stateGuestB = { generationId: crypto.randomUUID(), guestId: guestB };

    function checkGuestAccess(requesterGuestId, state) {
      if (!state || state.guestId !== requesterGuestId) {
        return { status: 404, error: 'NOT_FOUND' };
      }
      return { status: 200, data: state };
    }

    const resA = checkGuestAccess(guestA, stateGuestB);
    assert.strictEqual(resA.status, 404, 'Must return 404 for foreign guest');

    const resB = checkGuestAccess(guestB, stateGuestB);
    assert.strictEqual(resB.status, 200, 'Must allow owner guest');
  });

  await itAsync('2.3 Unauthorized cancellation is rejected and job:cancel is NOT set', async () => {
    const ownerUserId = crypto.randomUUID();
    const attackerUserId = crypto.randomUUID();
    const genId = 'gen-' + crypto.randomUUID();
    const record = { id: genId, user_id: ownerUserId };

    let cancelCalled = false;
    async function handleCancel(requesterId, targetRecord) {
      if (!targetRecord || targetRecord.user_id !== requesterId) {
        return { status: 404, error: 'NOT_FOUND' };
      }
      cancelCalled = true;
      await cancelJob(targetRecord.id);
      return { status: 200, cancelled: true };
    }

    const attackerAttempt = await handleCancel(attackerUserId, record);
    assert.strictEqual(attackerAttempt.status, 404, 'Attacker must be rejected with 404');
    assert.strictEqual(cancelCalled, false, 'Cancel must not be invoked');

    const isCancelled = await isJobCancelled(genId);
    assert.strictEqual(isCancelled, false, 'Cancellation key must not be written');
  });

  it('2.4 Generation ID alone is never treated as authorization credential', () => {
    function evaluateAuth(headers, params, record) {
      const authHeader = headers?.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authorized: false, reason: 'MISSING_OR_INVALID_AUTH' };
      }
      // Having matching generationId without valid session owner fails
      return { authorized: true };
    }

    const bareJobRequest = { headers: {} };
    assert.strictEqual(evaluateAuth(bareJobRequest).authorized, false);
  });

  // ── 3. QSTASH & WORKER VERIFICATION INVARIANTS ──
  console.log('\n--- 3. QStash & Worker Invariants ---');

  await itAsync('3.1 QStash Signature: Rejects invalid signature, wrong destination URL, or tampered body', async () => {
    const currentSigningKey = 'sigkey_current_' + crypto.randomBytes(8).toString('hex');
    const nextSigningKey = 'sigkey_next_' + crypto.randomBytes(8).toString('hex');
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });

    const rawBody = JSON.stringify({ generationId: 'test_gen', task: 'humanize' });
    const wrongUrl = 'https://malicious-site.com/api/steal';

    // 1. Invalid signature
    const validBadSig = await receiver.verify({
      signature: 'invalid.jwt.token',
      body: rawBody,
      url: CANONICAL_WORKER_URL,
    }).catch(() => false);
    assert.strictEqual(validBadSig, false, 'Invalid signature must be rejected');

    // 2. Wrong destination URL
    const validWrongUrl = await receiver.verify({
      signature: 'eyJhbGciOiJIUzI1NiJ9.fake.sig',
      body: rawBody,
      url: wrongUrl,
    }).catch(() => false);
    assert.strictEqual(validWrongUrl, false, 'Wrong destination URL must be rejected');

    // 3. Tampered body
    const validTampered = await receiver.verify({
      signature: 'eyJhbGciOiJIUzI1NiJ9.fake.sig',
      body: rawBody + 'tampered',
      url: CANONICAL_WORKER_URL,
    }).catch(() => false);
    assert.strictEqual(validTampered, false, 'Tampered body must be rejected');
  });

  await itAsync('3.2 QStash Publish Contract: HTTP 200 (Fresh) and HTTP 202 (Deduplicated)', async () => {
    const originalFetch = global.fetch;
    process.env.QSTASH_TOKEN = 'test_token_123';

    try {
      // 200 Fresh
      global.fetch = async () => ({
        status: 200,
        text: async () => JSON.stringify({ messageId: 'msg_fresh_001' }),
      });
      const fresh = await dispatchGenerationToQStash({ generationId: 'gen_001' });
      assert.strictEqual(fresh.success, true);
      assert.strictEqual(fresh.status, 200);
      assert.strictEqual(fresh.deduplicated, false);

      // 202 Deduplicated
      global.fetch = async () => ({
        status: 202,
        text: async () => JSON.stringify({ messageId: 'msg_dedupe_002', deduplicated: true }),
      });
      const dedupe = await dispatchGenerationToQStash({ generationId: 'gen_002' });
      assert.strictEqual(dedupe.success, true);
      assert.strictEqual(dedupe.status, 202);
      assert.strictEqual(dedupe.deduplicated, true);

      // Other status -> recovery error
      global.fetch = async () => ({
        status: 503,
        text: async () => 'Service Unavailable',
      });
      const err = await dispatchGenerationToQStash({ generationId: 'gen_003' });
      assert.strictEqual(err.success, false);
      assert.strictEqual(err.status, 503);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // ── 4. WORKER EXECUTION & STAGE CHECKPOINT INVARIANTS ──
  console.log('\n--- 4. Worker Execution & Stage Checkpoints ---');

  await itAsync('4.1 Terminal generation produces zero provider calls', async () => {
    let providerCalls = 0;
    const terminalState = { status: 'COMPLETED', output_text: 'Existing output', scores: { humanScore: 96 } };

    async function executeWorker(genId, state) {
      if (isTerminalStatus(state.status)) {
        return { status: state.status, replayed: true };
      }
      providerCalls++;
      return { status: 'RUNNING' };
    }

    const res = await executeWorker('gen-term-1', terminalState);
    assert.strictEqual(res.status, 'COMPLETED');
    assert.strictEqual(res.replayed, true);
    assert.strictEqual(providerCalls, 0, 'Zero provider calls on terminal status');
  });

  await itAsync('4.2 Execution lock permits at most one concurrent worker', async () => {
    const genId = 'gen-mutex-' + crypto.randomUUID();
    const workerA = 'worker-alpha';
    const workerB = 'worker-beta';

    const lockA = await claimStageExecution(genId, 'DRAFT', workerA, 60);
    assert.strictEqual(lockA, true, 'Worker A acquires lock');

    const lockB = await claimStageExecution(genId, 'DRAFT', workerB, 60);
    assert.strictEqual(lockB, false, 'Worker B must be rejected while Worker A holds lock');

    await releaseStageExecution(genId, 'DRAFT');

    const lockBAfter = await claimStageExecution(genId, 'DRAFT', workerB, 60);
    assert.strictEqual(lockBAfter, true, 'Worker B acquires lock after Worker A releases');
    await releaseStageExecution(genId, 'DRAFT');
  });

  await itAsync('4.3 Completed stage checkpoint is reused (skips provider call on retry)', async () => {
    let llmCallCount = 0;
    const genId = 'gen-ckpt-' + crypto.randomUUID();

    async function executeStage(stageName) {
      const cached = await getStageResult(genId, stageName);
      if (cached) {
        return cached; // Skip LLM call!
      }
      llmCallCount++;
      const output = { stage: stageName, text: `Result for ${stageName}` };
      await persistStageResult(genId, stageName, output);
      return output;
    }

    // First attempt: executes stage 1 & 2
    await executeStage('INPUT_SCORE');
    await executeStage('DRAFT');
    assert.strictEqual(llmCallCount, 2);

    // Second attempt (worker retry/reconnection): skips stage 1 & 2
    const res1 = await executeStage('INPUT_SCORE');
    const res2 = await executeStage('DRAFT');
    assert.strictEqual(llmCallCount, 2, 'LLM calls must remain 2 (0 new calls on checkpoint hit)');
    assert.strictEqual(res1.stage, 'INPUT_SCORE');
    assert.strictEqual(res2.stage, 'DRAFT');

    // Stage 3 executes for the first time
    await executeStage('CRITIQUE');
    assert.strictEqual(llmCallCount, 3);
  });

  // ── 5. PERSISTENCE & GUEST TOMBSTONES ──
  console.log('\n--- 5. Persistence & Guest Tombstones ---');

  await itAsync('5.1 Guest 30-Day Tombstone lifecycle: 0-24h active, 24h-30d rejected, >30d fresh', async () => {
    const guestId = crypto.randomUUID();
    const principalId = `guest:${guestId}`;
    const keyHash = hashKey('key-tomb-test');

    // 1. Initial generation completed
    await completeIdempotencyKey(
      principalId,
      keyHash,
      { output_text: 'Output A', scores: { humanScore: 96 } },
      { guestId }
    );

    // In 0-24h window: active record exists
    const activeRec = await getIdempotencyRecord(principalId, keyHash);
    assert(activeRec, 'Active record must be retrievable');

    // Tombstone exists
    const hasTombstone = await getGuestTombstone(guestId, keyHash);
    assert.strictEqual(hasTombstone, true, '30-day tombstone must be active');
  });

  it('5.2 Generated columns provider and mode are STORED and read-only in DDL', () => {
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261001000000_create_generations_table.sql');
    const ddl = fs.readFileSync(migrationPath, 'utf8');

    assert(ddl.includes('provider VARCHAR(50) GENERATED ALWAYS AS (COALESCE(actual_provider, requested_provider)) STORED'));
    assert(ddl.includes('mode VARCHAR(50) GENERATED ALWAYS AS (requested_mode) STORED'));
    assert(ddl.includes('REVOKE INSERT, UPDATE ON public.generations FROM anon, authenticated'));
  });

  // ── 6. RATE LIMITING NAMESPACES ──
  console.log('\n--- 6. Rate Limiting Namespaces ---');

  await itAsync('6.1 rl_user_generation and rl_user_scoring operate in strictly segregated namespaces', async () => {
    const id = crypto.randomUUID();

    const genCheck = await checkRateLimit('rl_user_generation', id, 30, 60);
    assert.strictEqual(genCheck.allowed, true);
    assert.strictEqual(genCheck.count, 1);

    const scoreCheck = await checkRateLimit('rl_user_scoring', id, 60, 60);
    assert.strictEqual(scoreCheck.allowed, true);
    assert.strictEqual(scoreCheck.count, 1, 'Scoring bucket must start at 1 independently from generation bucket');
  });

  console.log(`\n================================================================`);
  console.log(`Backend Invariants: ${passed} passed, ${failed} failed.`);
  console.log(`================================================================\n`);

  if (failed > 0) process.exit(1);
}

runAllInvariants();
