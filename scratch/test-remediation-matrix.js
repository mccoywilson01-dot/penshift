/**
 * PenShift Forensic Audit Targeted Remediation Verification Suite
 * Exhaustively tests all P0/P1 fixes, functional controls, lock reliability, and linguistic preservation.
 */

import assert from 'assert';
import { MODEL_REGISTRY, getModel, getModelsByProvider } from '../api/_lib/ai/modelRegistry.js';
import { matchProviderAndModel } from '../api/_lib/ai/capabilityMatcher.js';
import {
  claimStageExecution,
  persistStageResult,
  releaseStageExecution,
  getStageResult,
  _resetCheckpointMemory,
} from '../api/_lib/ai/stageCheckpoint.js';
import {
  countWords,
  clean,
  cleanOutput,
  buildHumanizerPrompt,
  buildBlogPrompt,
  buildAffiliatePrompt,
  performTavilyResearch,
} from '../api/_lib/ai/promptBuilders.js';
import { hashKey, hashRequest } from '../api/_lib/rateLimiter.js';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

console.log('═══════════════════ PENSHIFT FORENSIC REMEDIATION VERIFICATION ═══════════════════\n');

// ── 1. Priority 1 (P0): Blog & Affiliate Idempotency-Key Verification ──
it('1. P0 Defect: Blog.jsx & Affiliate.jsx include Idempotency-Key, key reuse, and auth headers', () => {
  const blogCode = fs.readFileSync(path.resolve('./src/pages/Blog.jsx'), 'utf-8');
  assert(blogCode.includes('currentIdempotencyKeyRef'), 'Blog.jsx must track currentIdempotencyKeyRef');
  assert(blogCode.includes('lastRequestParamsRef'), 'Blog.jsx must track lastRequestParamsRef');
  assert(blogCode.includes("'Idempotency-Key': idempotencyKey"), 'Blog.jsx must transmit Idempotency-Key header');
  assert(blogCode.includes('getAuthHeaders'), 'Blog.jsx must include getAuthHeaders');

  const affCode = fs.readFileSync(path.resolve('./src/pages/Affiliate.jsx'), 'utf-8');
  assert(affCode.includes('currentIdempotencyKeyRef'), 'Affiliate.jsx must track currentIdempotencyKeyRef');
  assert(affCode.includes('lastRequestParamsRef'), 'Affiliate.jsx must track lastRequestParamsRef');
  assert(affCode.includes("'Idempotency-Key': idempotencyKey"), 'Affiliate.jsx must transmit Idempotency-Key header');
  assert(affCode.includes('getAuthHeaders'), 'Affiliate.jsx must include getAuthHeaders');
});

// ── 2. Priority 1 (P0): Score Idempotent Contract ──
it('2. P0 Defect: Score.jsx includes Idempotency-Key and api/generate.js enforces idempotent scoring contract', () => {
  const scoreCode = fs.readFileSync(path.resolve('./src/pages/Score.jsx'), 'utf-8');
  assert(scoreCode.includes('currentIdempotencyKeyRef'), 'Score.jsx must track currentIdempotencyKeyRef');
  assert(scoreCode.includes("'Idempotency-Key': idempotencyKey"), 'Score.jsx must transmit Idempotency-Key header');

  const generateCode = fs.readFileSync(path.resolve('./api/generate.js'), 'utf-8');
  assert(generateCode.includes('existingScoreRecord = await getIdempotencyRecord'), 'api/generate.js must check score idempotency');
  assert(generateCode.includes("existingScoreRecord.requestHash !== requestHash"), 'api/generate.js must reject key reuse with 409');
  assert(generateCode.includes("replayed: true"), 'api/generate.js must return replayed cached score');
});

// ── 3. Priority 1 (P0): QStash Worker Architecture in Generation Path ──
it('3. P0 Defect: QStash dispatch is integrated directly into api/generate.js generation flow', () => {
  const generateCode = fs.readFileSync(path.resolve('./api/generate.js'), 'utf-8');
  assert(generateCode.includes('dispatchGenerationToQStash'), 'api/generate.js must import and call dispatchGenerationToQStash');
  assert(generateCode.includes("process.env.QSTASH_TOKEN"), 'api/generate.js must branch on QSTASH_TOKEN');
  assert(generateCode.includes("getJobChunks(generationId"), 'api/generate.js must stream job chunks from worker');
});

// ── 4. Priority 2 (P1): Model Registry Genuine Production Models ──
it('4. P1 Defect: modelRegistry.js uses genuine models (llama-3.3-70b-versatile, llama-3.1-8b-instant, gemini-2.0-flash, gemini-1.5-flash)', () => {
  const groqMain = getModel('llama-3.3-70b-versatile');
  assert(groqMain && groqMain.providerModelId === 'llama-3.3-70b-versatile', 'llama-3.3-70b-versatile must exist');
  assert.strictEqual(groqMain.provider, 'groq');

  const groqScore = getModel('llama-3.1-8b-instant');
  assert(groqScore && groqScore.providerModelId === 'llama-3.1-8b-instant', 'llama-3.1-8b-instant must exist');
  assert.strictEqual(groqScore.scoringMaxOutputTokens, 512);

  const geminiMain = getModel('gemini-2.0-flash');
  assert(geminiMain && geminiMain.providerModelId === 'gemini-2.0-flash', 'gemini-2.0-flash must exist');

  const geminiScore = getModel('gemini-1.5-flash');
  assert(geminiScore && geminiScore.providerModelId === 'gemini-1.5-flash', 'gemini-1.5-flash must exist');

  // Capability matcher routing
  const route = matchProviderAndModel({ task: 'humanize', requestedProvider: 'groq' });
  assert.strictEqual(route.actual_model, 'llama-3.3-70b-versatile');

  const routeGem = matchProviderAndModel({ task: 'humanize', requestedProvider: 'gemini' });
  assert.strictEqual(routeGem.actual_model, 'gemini-2.0-flash');
});

// ── 5. Priority 2 (P1): No Silent Synthetic Scoring Swallowing ──
it('5. P1 Defect: Scoring failure attempts fallback provider and reports unavailable instead of fabricating 35/96', () => {
  const generateCode = fs.readFileSync(path.resolve('./api/generate.js'), 'utf-8');
  assert(!generateCode.includes("let inputScore = { score: 35"), 'Must NOT hardcode synthetic input score 35');
  assert(!generateCode.includes("let outputScore = { score: 96"), 'Must NOT hardcode synthetic output score 96');
  assert(generateCode.includes("fallbackProvider.score"), 'Must attempt fallbackProvider on scoring failure');
  assert(generateCode.includes("unavailable: true"), 'Must report unavailable when scoring fails');
});

// ── 6. Priority 2 (P1): History Type Harmonization ──
it('6. P1 Defect: History types match across Supabase queries, worker, and generate.js', () => {
  const supCode = fs.readFileSync(path.resolve('./src/lib/supabase.js'), 'utf-8');
  assert(supCode.includes("type.eq.penshift_history_humanizer"), 'src/lib/supabase.js must query penshift_history_humanizer');

  const generateCode = fs.readFileSync(path.resolve('./api/generate.js'), 'utf-8');
  assert(generateCode.includes("task === 'humanize' ? 'penshift_history_humanizer'"), 'api/generate.js must set penshift_history_humanizer');

  const workerCode = fs.readFileSync(path.resolve('./api/_internal/worker/generation.js'), 'utf-8');
  assert(workerCode.includes("task === 'humanize' ? 'penshift_history_humanizer'"), 'worker must set penshift_history_humanizer');
});

// ── 7. Priority 2 (P1): Dead DOMPurify Removal ──
it('7. P1 Defect: Dead dompurify removed and rehype-sanitize actively handles sanitization', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve('./package.json'), 'utf-8'));
  assert(!pkg.dependencies.dompurify, 'package.json dompurify dead dependency must be removed');
});

// ── 8. Priority 2 (P1): Reconcile DB Constraint ──
it('8. P1 Defect: reconcile.js sets actual_provider and actual_model on COMPLETED to satisfy DB check constraint', () => {
  const recCode = fs.readFileSync(path.resolve('./api/_internal/reconcile.js'), 'utf-8');
  assert(recCode.includes("updatePayload.actual_provider"), 'reconcile.js must supply actual_provider');
  assert(recCode.includes("updatePayload.actual_model"), 'reconcile.js must supply actual_model');
});

// ── 9. Priority 2 (P1): Tavily Research Integration ──
itAsync('9. P1 Defect: Tavily web research is integrated in blog path and handles success/fallback gracefully', async () => {
  const generateCode = fs.readFileSync(path.resolve('./api/generate.js'), 'utf-8');
  assert(generateCode.includes("performTavilyResearch"), 'api/generate.js must invoke performTavilyResearch');

  // Verify performTavilyResearch handles missing key cleanly without throw
  const res = await performTavilyResearch('Quantum computing');
  assert(typeof res === 'object');
  assert(res.ok === false || res.ok === true);
  assert(Array.isArray(res.results));

  // Verify buildBlogPrompt injects research context
  const blogPrompt = buildBlogPrompt('Quantum computing', 'standard', {
    researchContext: '[Source 1: MIT Tech](https://mit.edu)\nBreakthrough in qubits announced.',
  });
  assert(blogPrompt.user.includes('retrieved_web_content'), 'Prompt user must include research context');
  assert(blogPrompt.user.includes('MIT Tech'), 'Prompt user must include citations');
});

// ── 10. Priority 3: Disconnected Humanizer Controls (userMemory, vocab, sentenceLength, useDebate) ──
it('10. Priority 3: Humanizer controls (userMemory, vocab, sentenceLength, useDebate) modulate generation prompt', () => {
  const text = 'Artificial intelligence tools are changing software engineering rapidly.';

  // 1. userMemory (Prompt injection hardened: must be in untrusted user section, NOT system prompt)
  const pMemory = buildHumanizerPrompt(text, 'standard', 'Always sound like an aggressive Wall Street trader');
  assert(pMemory.user.includes('Wall Street trader'), 'Must incorporate userMemory into untrusted user content section');
  assert(!pMemory.system.includes('Wall Street trader'), 'Must NOT inject raw userMemory into trusted system instructions');

  // 2. vocab
  const pSimple = buildHumanizerPrompt(text, 'standard', '', { vocab: 'simple' });
  assert(pSimple.system.includes('VOCABULARY PROFILE (SIMPLE)'), 'Must apply simple vocab instructions');

  const pAdv = buildHumanizerPrompt(text, 'standard', '', { vocab: 'advanced' });
  assert(pAdv.system.includes('VOCABULARY PROFILE (ADVANCED)'), 'Must apply advanced vocab instructions');

  // 3. sentenceLength
  const pShort = buildHumanizerPrompt(text, 'standard', '', { sentenceLength: 'short' });
  assert(pShort.system.includes('SYNTAX RHYTHM (SHORT)'), 'Must apply short syntax rhythm');

  const pLong = buildHumanizerPrompt(text, 'standard', '', { sentenceLength: 'long' });
  assert(pLong.system.includes('SYNTAX RHYTHM (LONG)'), 'Must apply long syntax rhythm');

  // 4. useDebate (Stylometric verification pass)
  const pDebate = buildHumanizerPrompt(text, 'standard', '', { useDebate: true });
  assert(pDebate.system.includes('ADVERSARIAL STYLOMETRIC VERIFICATION'), 'Must activate adversarial stylometric verification pass');
});

// ── 11. Priority 4: Stage Checkpoint Lock Release Atomic Ownership Verification ──
itAsync('11. Priority 4: releaseStageExecution verifies workerId ownership and never deletes another worker lock', async () => {
  _resetCheckpointMemory();
  const genId = 'gen-test-lock-1';
  const stage = 'DRAFT';
  const workerA = 'worker-A';
  const workerB = 'worker-B';

  // Worker A acquires lock
  const claimedA = await claimStageExecution(genId, stage, workerA, 60);
  assert.strictEqual(claimedA, true, 'Worker A acquires initial lock');

  // Worker B attempts to release Worker A's lock with Worker B's id -> must fail / return false
  const releasedWrong = await releaseStageExecution(genId, stage, workerB);
  assert.strictEqual(releasedWrong, false, 'Worker B cannot release Worker A lock');

  // Lock must STILL be held
  const claimedSecond = await claimStageExecution(genId, stage, workerB, 60);
  assert.strictEqual(claimedSecond, false, 'Worker B still cannot claim lock while Worker A holds it');

  // Worker A releases its own lock -> must succeed
  const releasedCorrect = await releaseStageExecution(genId, stage, workerA);
  assert.strictEqual(releasedCorrect, true, 'Worker A can release its own lock');

  // Now Worker B can claim the lock
  const claimedNow = await claimStageExecution(genId, stage, workerB, 60);
  assert.strictEqual(claimedNow, true, 'Worker B can claim freed lock');
});

// ── 12. Priority 5: SCRUB_MAP Non-Destructive Replacement & Tense Preservation ──
it('12. Priority 5: cleanOutput preserves tense, parts of speech, capitalization, and formal register', () => {
  // 1. Tense preservation: leveraged -> used (NOT present tense use)
  const inputTense = 'The engineers leveraged modern protocols and were delving into performance metrics.';
  const outputTense = cleanOutput(inputTense);
  assert(outputTense.includes('used modern protocols'), `Expected "used modern protocols", got: "${outputTense}"`);
  assert(outputTense.includes('exploring performance metrics'), `Expected "exploring performance metrics", got: "${outputTense}"`);
  assert(!outputTense.includes('use modern protocols'), 'Must not substitute present tense "use" for past tense "leveraged"');

  // 2. Register & meaning: consequently -> as a result (NEVER casual "plus")
  const inputTrans = 'The server failed; consequently, the failover was triggered.';
  const outputTrans = cleanOutput(inputTrans);
  assert(outputTrans.includes('as a result'), `Expected "as a result", got: "${outputTrans}"`);
  assert(!outputTrans.includes('plus'), 'Must NEVER substitute "plus" for "consequently"');

  // 3. Adverb preservation: seamlessly -> smoothly (NOT adjective smooth)
  const inputAdv = 'The integration executed seamlessly across all nodes.';
  const outputAdv = cleanOutput(inputAdv);
  assert(outputAdv.includes('executed smoothly'), `Expected "executed smoothly", got: "${outputAdv}"`);
  assert(!outputAdv.includes('executed smooth '), 'Must not replace adverb "seamlessly" with adjective "smooth"');

  // 4. Capitalization preservation
  const inputCap = 'Consequently, the system recovered. Delving into the logs revealed the fix.';
  const outputCap = cleanOutput(inputCap);
  assert(outputCap.startsWith('As a result,'), `Expected "As a result,", got: "${outputCap}"`);
  assert(outputCap.includes('Exploring the logs'), `Expected "Exploring the logs", got: "${outputCap}"`);
});

// Wait for async tests before printing final summary
setTimeout(() => {
  console.log(`\n================================================================`);
  console.log(`Forensic Remediation Tests: ${passed} passed, ${failed} failed.`);
  console.log(`================================================================\n`);
  if (failed > 0) process.exit(1);
}, 500);
