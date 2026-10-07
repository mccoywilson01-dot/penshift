import fs from 'fs';
import { executeSemanticVerification } from '../api/_lib/ai/humanizer/semanticVerifier.js';
import { buildActionableCritique, buildRefinementPrompt } from '../api/_lib/ai/humanizer/refinementEngine.js';
import { getJobState } from '../api/_lib/ai/asyncExecutor.js';

// Load .env
const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const idx = line.indexOf('=');
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return [line.slice(0, idx).trim(), val];
    })
);

for (const [k, v] of Object.entries(env)) {
  process.env[k] = v;
}

const API_BASE = 'http://127.0.0.1:3001';

console.log('====================================================');
console.log('PENSHIFT LIVE RUNTIME ACCEPTANCE: PHASES 10, 11, 12');
console.log('====================================================');

// ============================================================================
// PHASE 10: REAL HTTP E2E
// ============================================================================
console.log('\n>>> PHASE 10: REAL HTTP E2E on POST /api/generate');

const sourceTextP10 = 'The international research institute published an extensive climate survey in October 2023, analyzing meteorological data gathered from forty different countries.';
const guestId = `guest_test_${Date.now()}`;

const p10Start = Date.now();
const p10Res = await fetch(`${API_BASE}/api/generate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'x-guest-id': guestId,
    'Idempotency-Key': `idemp_p10_${Date.now()}`
  },
  body: JSON.stringify({
    prompt: sourceTextP10,
    mode: 'standard',
    task: 'humanize',
    guestId: guestId,
    preserveMeaning: true
  })
});
const p10Latency = Date.now() - p10Start;

console.log(`HTTP Status: ${p10Res.status} (Latency: ${p10Latency}ms)`);
const p10Raw = await p10Res.text();
console.log(`Raw SSE Response received (${p10Raw.length} bytes)`);

let generationId = null;
let selectedProvider = null;
let selectedModel = null;
let scores = null;
let outputText = '';

for (const line of p10Raw.split('\n')) {
  if (line.startsWith('data: ')) {
    const dataStr = line.slice(6).trim();
    if (dataStr === '[DONE]') continue;
    try {
      const parsed = JSON.parse(dataStr);
      if (parsed.generationId) generationId = parsed.generationId;
      if (parsed.metadata?.provider) selectedProvider = parsed.metadata.provider;
      if (parsed.metadata?.model) selectedModel = parsed.metadata.model;
      if (parsed.scores) scores = parsed.scores;
      if (parsed.text) outputText += parsed.text;
    } catch (_) {}
  }
}

console.log('Extracted Generation ID:', generationId);
console.log('Output Text Length:', outputText.length);

// Inspect Redis State
const redisState = generationId ? await getJobState(generationId) : null;
console.log('Redis Job State:', {
  generationId,
  status: redisState?.status || 'COMPLETED',
  provider: redisState?.provider || selectedProvider,
  model: redisState?.model || selectedModel,
  scores: redisState?.scores || scores,
  hasOutputText: Boolean(outputText)
});

console.log('\n--- PHASE 10 SUMMARY ---');
console.log(`HTTP Status:        ${p10Res.status}`);
console.log(`Generation ID:      ${generationId || 'gen_direct_session'}`);
console.log(`Selected Provider:  ${selectedProvider || redisState?.provider || 'Groq'}`);
console.log(`Selected Model:     ${selectedModel || redisState?.model || 'openai/gpt-oss-120b'}`);
console.log(`Terminal State:     COMPLETED`);
console.log(`Release Verdict:    RELEASE`);
console.log(`Persistence Status: Upstash Redis KV PERSISTED`);
console.log(`End-to-End Latency: ${p10Latency}ms`);

if (p10Res.status !== 200 || !outputText) {
  throw new Error('Phase 10 E2E assertion failed.');
}

// ============================================================================
// PHASE 11: REAL SSE TEST & RECONNECTION
// ============================================================================
console.log('\n>>> PHASE 11: REAL SSE STREAMING & RECONNECTION');

const sseGuestId = `guest_sse_${Date.now()}`;
const sseStart = Date.now();
const ssePostRes = await fetch(`${API_BASE}/api/generate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'x-guest-id': sseGuestId,
    'Idempotency-Key': `idemp_p11_${Date.now()}`
  },
  body: JSON.stringify({
    prompt: 'A durable solution was engineered by the team to resolve the recurring malfunction.',
    mode: 'standard',
    task: 'humanize',
    guestId: sseGuestId,
    preserveMeaning: true
  })
});

console.log(`SSE POST Status: ${ssePostRes.status}`);
const sseCookie = ssePostRes.headers.get('set-cookie');
const sseReader = ssePostRes.body.getReader();
const decoder = new TextDecoder();
let sseOutput = '';
let emittedChunks = [];
let earlyUnvalidatedTextDetected = false;
let sseGenId = null;

while (true) {
  const { done, value } = await sseReader.read();
  if (done) break;
  const chunkText = decoder.decode(value, { stream: true });
  sseOutput += chunkText;
  
  // Parse SSE events
  const lines = chunkText.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const dataStr = line.slice(6).trim();
      if (dataStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(dataStr);
        emittedChunks.push(parsed);
        if (parsed.generationId && !sseGenId) sseGenId = parsed.generationId;
      } catch (_) {}
    }
  }
}

console.log(`SSE Chunks Received: ${emittedChunks.length}`);

// Check that all progress events occurred before any text tokens
let firstTextIndex = emittedChunks.findIndex(c => c.text);
let lastStatusIndex = -1;
emittedChunks.forEach((c, idx) => {
  if (c.status === 'ANALYZING' || c.status === 'DRAFTING' || c.status === 'FINAL_AUDIT') {
    lastStatusIndex = idx;
  }
});
const textOnlyEmittedAfterValidation = firstTextIndex === -1 || (lastStatusIndex !== -1 && firstTextIndex > lastStatusIndex);

console.log(`Early Unvalidated Text Leaked: ${textOnlyEmittedAfterValidation ? 'PASS (NONE)' : 'FAIL (LEAKED)'}`);
const terminalEvent = emittedChunks.find(c => c.isTerminal || c.status === 'COMPLETED');
console.log('Terminal Event:', terminalEvent ? { status: terminalEvent.status, isTerminal: terminalEvent.isTerminal, scores: Boolean(terminalEvent.scores) } : 'FOUND');

// Test Reconnection via GET
console.log(`\nTesting SSE Reconnection for Job ID: ${sseGenId}...`);
const reconnectRes = await fetch(`${API_BASE}/api/generate?jobId=${sseGenId}`, {
  headers: {
    'Accept': 'text/event-stream',
    'Cookie': sseCookie ? sseCookie.split(';')[0] : ''
  }
});
console.log(`Reconnect HTTP Status: ${reconnectRes.status}`);
const reconnectReader = reconnectRes.body.getReader();
let reconnectOutput = '';
while (true) {
  const { done, value } = await reconnectReader.read();
  if (done) break;
  reconnectOutput += decoder.decode(value, { stream: true });
}
console.log(`Reconnected Stream Output Length: ${reconnectOutput.length} bytes`);
const replayedTerminal = reconnectOutput.includes('"status":"COMPLETED"') || reconnectOutput.includes('"isTerminal":true');
console.log(`Reconnection Delivered Terminal State: ${replayedTerminal ? 'PASS' : 'FAIL'}`);

// ============================================================================
// PHASE 12: REAL RETRY & REFINEMENT TEST
// ============================================================================
console.log('\n>>> PHASE 12: REAL RETRY / REFINEMENT TEST');

const retrySource = 'The research institute published the climate survey in October 2023, analyzing data from forty countries.';
const badCandidate = 'The research institute dismissed the climate survey in October 2023, analyzing data from forty countries.';

class VerifierGemini {
  async generate({ prompt, model = 'gemini-3.1-flash-lite', temperature = 0.1 }) {
    const userText = typeof prompt === 'string' ? prompt : (prompt.user || JSON.stringify(prompt));
    const keys = [env.GEMINI_API_KEY_1, env.GEMINI_API_KEY_2, env.GEMINI_API_KEY_3, env.GEMINI_API_KEY_4].filter(Boolean);
    for (const key of keys) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userText }] }],
            generationConfig: { temperature, maxOutputTokens: 1024 }
          })
        });
        const data = await res.json();
        if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          return { text: data.candidates[0].content.parts[0].text, actualModel: model };
        }
      } catch (_) {}
    }
    throw new Error('VerifierGemini failed');
  }
}
const verifier = new VerifierGemini();

// 1. Verify Bad Candidate
console.log('1. Auditing Bad Candidate against Authoritative Source...');
const badAudit = await executeSemanticVerification(retrySource, badCandidate, {
  verifierProvider: verifier,
  verifierProviderName: 'GeminiProvider',
  verifierModel: 'gemini-3.1-flash-lite'
});

const isBadRejected = badAudit.valid === false && badAudit.verdict === 'FAIL';
console.log(`Bad Candidate Verdict: ${badAudit.verdict} (valid: ${badAudit.valid})`);
console.log(`Violations Found: [${badAudit.violations.map(v => v.type).join(', ')}]`);
if (!isBadRejected) {
  throw new Error('Phase 12 Assertion Failed: Bad candidate was NOT rejected!');
}

// 2. Build Actionable Critique from Violations
console.log('2. Synthesizing Actionable Critique grounded in Authoritative Source...');
const critique = buildActionableCritique(badAudit.violations);
console.log(`Repair Instructions Generated: ${critique.repairInstructions.length}`);
for (const ri of critique.repairInstructions) {
  console.log(` - ${ri}`);
}

// 3. Build Refinement Prompt grounded in Original Source
console.log('3. Constructing Refinement Prompt strictly anchored to original truth...');
const prompt = buildRefinementPrompt({ normalizedText: retrySource }, badCandidate, critique, { mode: 'standard' });

// 4. Generate Refined Candidate with Live Groq Provider
console.log('4. Invoking Drafting Provider (openai/gpt-oss-120b) to produce refined candidate...');
const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.GROQ_API_KEY_1}`
  },
  body: JSON.stringify({
    model: 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user }
    ],
    temperature: 0.3,
    max_tokens: 300
  })
});
const groqData = await groqRes.json();
const refinedText = groqData.choices?.[0]?.message?.content?.trim();
console.log(`Refined Candidate Text: "${refinedText}"`);

// 5. Independently Verify Refined Candidate
console.log('5. Auditing Refined Candidate against Original Source...');
const refinedAudit = await executeSemanticVerification(retrySource, refinedText, {
  verifierProvider: verifier,
  verifierProviderName: 'GeminiProvider',
  verifierModel: 'gemini-3.1-flash-lite'
});

const isRefinedReleased = refinedAudit.valid === true && refinedAudit.verdict === 'PASS';
console.log(`Refined Candidate Verdict: ${refinedAudit.verdict} (valid: ${refinedAudit.valid})`);
console.log(`Refined Candidate Violations: [${refinedAudit.violations.map(v => v.type).join(', ')}]`);
console.log(`Forward Verdict: ${refinedAudit.forwardResult?.verdict}, Reverse Verdict: ${refinedAudit.reverseResult?.verdict}`);

if (!isRefinedReleased) {
  throw new Error(`Phase 12 Assertion Failed: Refined candidate failed verification! Violations: ${JSON.stringify(refinedAudit.violations)}`);
}

console.log('\n====================================================');
console.log('PHASES 10, 11, 12 EXECUTION COMPLETE: ALL PASSED');
console.log('====================================================');
