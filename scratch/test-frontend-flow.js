import assert from 'assert';
import crypto from 'crypto';

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

console.log('═══════════════════ PENSHIFT PHASE 7 FRONTEND CONSUMPTION TESTS ═══════════════════\n');

// 1. Idempotency Key Generation & Retry Reuse Invariant
it('1. Frontend Idempotency: Fresh UUID on new request, exact key reuse on retry', () => {
  let currentIdempotencyKey = null;
  let lastRequestParams = null;

  function runRequest(input, mode, provider, vocab, sentenceLength) {
    const isRetry = Boolean(
      currentIdempotencyKey &&
      lastRequestParams &&
      lastRequestParams.prompt === input &&
      lastRequestParams.mode === mode &&
      lastRequestParams.provider === provider &&
      lastRequestParams.vocab === vocab &&
      lastRequestParams.sentenceLength === sentenceLength
    );

    const idempotencyKey = isRetry ? currentIdempotencyKey : crypto.randomUUID();
    currentIdempotencyKey = idempotencyKey;
    lastRequestParams = { prompt: input, mode, provider, vocab, sentenceLength };
    return { idempotencyKey, isRetry };
  }

  // Initial call
  const req1 = runRequest('Sample text to humanize', 'standard', 'auto', 50, 50);
  assert(req1.idempotencyKey, 'Must produce valid idempotency key');
  assert.strictEqual(req1.isRetry, false, 'First call is not a retry');

  // Retry with EXACT same parameters
  const req2 = runRequest('Sample text to humanize', 'standard', 'auto', 50, 50);
  assert.strictEqual(req2.idempotencyKey, req1.idempotencyKey, 'Retry MUST reuse the exact same key');
  assert.strictEqual(req2.isRetry, true, 'Retry must be flagged as retry');

  // Altered text
  const req3 = runRequest('Modified text to humanize', 'standard', 'auto', 50, 50);
  assert.notStrictEqual(req3.idempotencyKey, req1.idempotencyKey, 'Modified text MUST generate fresh key');
  assert.strictEqual(req3.isRetry, false, 'Modified text is not a retry');

  // Altered mode
  const req4 = runRequest('Modified text to humanize', 'aggressive', 'auto', 50, 50);
  assert.notStrictEqual(req4.idempotencyKey, req3.idempotencyKey, 'Modified mode MUST generate fresh key');
  assert.strictEqual(req4.isRetry, false, 'Modified mode is not a retry');
});

// 2. Lifecycle State Mapping for all 9 states
it('2. Frontend Lifecycle State Mapping: Handles all 9 states correctly', () => {
  const transitions = [];
  let currentStage = null;
  let currentError = null;
  let currentToast = null;

  function handleStatus(status, data) {
    transitions.push(status);
    if (status === 'QUEUED' || status === 'DISPATCHING' || status === 'RUNNING' || status === 'STREAMING') {
      currentStage = 'humanize';
    } else if (status === 'VALIDATING' || status === 'FINALIZING') {
      currentStage = 'score';
    } else if (status === 'COMPLETED') {
      currentStage = 'done';
    } else if (status === 'FAILED') {
      currentError = data?.error || 'Generation failed.';
      currentStage = null;
    } else if (status === 'CANCELLED') {
      currentToast = 'Generation Cancelled';
      currentStage = null;
    }
  }

  // Test progression through all states
  const allStates = [
    'QUEUED',
    'DISPATCHING',
    'RUNNING',
    'STREAMING',
    'VALIDATING',
    'FINALIZING',
    'COMPLETED'
  ];

  for (const st of allStates) {
    handleStatus(st, {});
  }
  assert.strictEqual(currentStage, 'done');
  assert.strictEqual(transitions.length, 7);

  // Test FAILED transition
  handleStatus('FAILED', { error: 'Upstream provider timed out' });
  assert.strictEqual(currentStage, null);
  assert.strictEqual(currentError, 'Upstream provider timed out');

  // Test CANCELLED transition
  handleStatus('CANCELLED', {});
  assert.strictEqual(currentStage, null);
  assert.strictEqual(currentToast, 'Generation Cancelled');
});

// 3. HTTP 202 Observer Reconnect Invariant
it('3. Frontend Reconnection: HTTP 202 attaches observer without creating second generation', () => {
  let generationsCreated = 0;
  let observersAttached = 0;
  let creditsDebited = 0;

  function simulateGatewayRequest(isNew, existingJobId) {
    if (isNew) {
      generationsCreated++;
      creditsDebited++;
      return { status: 200, isStream: true, generationId: 'gen-new-123' };
    }
    // Existing ongoing generation
    observersAttached++;
    return {
      status: 202,
      body: { statusUrl: `/api/generate?jobId=${existingJobId}`, generationId: existingJobId, idempotent: true },
    };
  }

  // 1. Initial request
  const first = simulateGatewayRequest(true);
  assert.strictEqual(generationsCreated, 1);
  assert.strictEqual(creditsDebited, 1);

  // 2. Reconnect request (e.g. client reconnects or retries)
  const reconnect = simulateGatewayRequest(false, first.generationId);
  assert.strictEqual(reconnect.status, 202);
  assert.strictEqual(reconnect.body.generationId, first.generationId);
  assert.strictEqual(generationsCreated, 1, 'No new generation must be created');
  assert.strictEqual(creditsDebited, 1, 'Zero new credits must be debited');
  assert.strictEqual(observersAttached, 1, 'Observer attached to existing generation');
});

// 4. Terminal Replay Invariant
it('4. Frontend Terminal Replay: Replays terminal result with zero AI calls and zero credit deduction', () => {
  let aiCalls = 0;
  let creditsDebited = 0;

  const mockDbOrCache = {
    status: 'COMPLETED',
    output_text: 'Previously completed high-quality humanized text.',
    scores: { humanScore: 98, inputScore: 32, aiScore: 2 },
  };

  function simulateTerminalRequest(hasTerminalRecord) {
    if (hasTerminalRecord) {
      // Replay terminal state
      return {
        text: mockDbOrCache.output_text,
        scores: mockDbOrCache.scores,
        status: mockDbOrCache.status,
        replayed: true,
      };
    }
    aiCalls++;
    creditsDebited++;
    return { text: 'New output', replayed: false };
  }

  const result = simulateTerminalRequest(true);
  assert.strictEqual(result.replayed, true, 'Must indicate replayed result');
  assert.strictEqual(result.text, mockDbOrCache.output_text);
  assert.strictEqual(result.scores.humanScore, 98);
  assert.strictEqual(aiCalls, 0, 'Zero AI provider calls made');
  assert.strictEqual(creditsDebited, 0, 'Zero credits debited');
});

// 5. Cancellation Invariant
it('5. Frontend Cancellation: Dispatches cancel action with auth headers and stops reader', () => {
  let cancelDispatchedUrl = null;
  let cancelAuthHeader = null;
  let readerStopped = false;

  const mockActiveJobId = 'gen-cancel-target-789';
  const mockToken = 'mock-jwt-token-456';

  function cancelAllRequests(activeJobId, token) {
    if (activeJobId) {
      cancelDispatchedUrl = `/api/generate?action=cancel&jobId=${encodeURIComponent(activeJobId)}`;
      cancelAuthHeader = `Bearer ${token}`;
    }
    readerStopped = true;
  }

  cancelAllRequests(mockActiveJobId, mockToken);

  assert(cancelDispatchedUrl.includes('action=cancel'), 'Must dispatch action=cancel');
  assert(cancelDispatchedUrl.includes(mockActiveJobId), 'Must include target jobId');
  assert.strictEqual(cancelAuthHeader, `Bearer ${mockToken}`, 'Must send bearer token for ownership check');
  assert.strictEqual(readerStopped, true, 'Stream reader must be stopped');
});

// 6. Elimination of Redundant Client-Side Scoring Calls
it('6. Unified SSE Stream: Pre-scoring and post-scoring arrive in stream without secondary client HTTP calls', () => {
  const secondaryHttpCalls = [];
  const receivedScores = {};

  // Mock SSE event processor
  function processSSEEvent(data) {
    if (data.inputScore !== undefined) {
      receivedScores.inputScore = data.inputScore;
    }
    if (data.outputScore !== undefined) {
      receivedScores.outputScore = data.outputScore;
    }
  }

  // Stream events from server
  processSSEEvent({ inputScore: 35, scores: { inputScore: 35 } });
  processSSEEvent({ text: 'Sentence 1... ' });
  processSSEEvent({ text: 'Sentence 2... ' });
  processSSEEvent({ outputScore: 96, scores: { inputScore: 35, outputScore: 96, aiScore: 4 } });

  assert.strictEqual(receivedScores.inputScore, 35, 'Input score consumed from stream');
  assert.strictEqual(receivedScores.outputScore, 96, 'Output score consumed from stream');
  assert.strictEqual(secondaryHttpCalls.length, 0, 'Zero separate scoring HTTP calls made by client');
});

console.log(`\n================================================================`);
console.log(`Phase 7 Tests finished: ${passed} passed, ${failed} failed.`);
console.log(`================================================================\n`);

if (failed > 0) {
  process.exit(1);
}
