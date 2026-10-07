import fs from 'fs';
import { MODEL_REGISTRY, resolveModel } from '../api/_lib/ai/modelRegistry.js';
import { matchProviderAndModel } from '../api/_lib/ai/capabilityMatcher.js';

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
Object.assign(process.env, env);

console.log('====================================================');
console.log('PHASE 3 — MODEL REGISTRY CONSISTENCY AUDIT');
console.log('====================================================');

const groqKey = env.GROQ_API_KEY_1;
const geminiKey = env.GEMINI_API_KEY_1;

// 1. Live Provider Probe Function
async function probeGroqModel(modelId) {
  const start = Date.now();
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Say "OK"' }],
        max_tokens: 5,
        temperature: 0.1
      }),
      signal: AbortSignal.timeout(10000)
    });
    const latency = Date.now() - start;
    const data = await res.json();
    return {
      status: res.status,
      ok: res.ok,
      latency,
      text: data.choices?.[0]?.message?.content?.trim() || null,
      error: data.error?.message || null
    };
  } catch (err) {
    return { status: 0, ok: false, latency: Date.now() - start, error: err.message };
  }
}

async function probeGeminiModel(modelId, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    const start = Date.now();
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say "OK"' }] }],
          generationConfig: { maxOutputTokens: 5, temperature: 0.1 }
        }),
        signal: AbortSignal.timeout(10000)
      });
      const latency = Date.now() - start;
      const data = await res.json();
      if ((res.status === 503 || res.status === 429) && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      return {
        status: res.status,
        ok: res.ok,
        latency,
        text: data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null,
        error: data.error?.message || null
      };
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      return { status: 0, ok: false, latency: Date.now() - start, error: err.message };
    }
  }
}

// 2. Active Model Inventory
const activeModels = [
  { role: 'Groq Canonical Drafting', canonicalId: 'groq-drafting', provider: 'groq', modelId: 'openai/gpt-oss-120b' },
  { role: 'Groq Fast Verifier/Scoring', canonicalId: 'groq-verifier', provider: 'groq', modelId: 'openai/gpt-oss-20b' },
  { role: 'Groq Resilient Fallback', canonicalId: 'groq-fallback', provider: 'groq', modelId: 'qwen/qwen3.8-27b' },
  { role: 'Gemini Canonical Drafting', canonicalId: 'gemini-drafting', provider: 'gemini', modelId: 'gemini-3.5-flash' },
  { role: 'Gemini Fast Verifier/Scoring', canonicalId: 'gemini-verifier', provider: 'gemini', modelId: 'gemini-3.1-flash-lite' },
  { role: 'Gemini Resilient Fallback', canonicalId: 'gemini-fallback', provider: 'gemini', modelId: 'gemini-3.8-flash' }
];

console.log('\n--- LIVE PROBE OF ALL ACTIVE REGISTRY MODELS ---');
let allProbesPassed = true;

for (const m of activeModels) {
  let probe;
  if (m.provider === 'groq') {
    probe = await probeGroqModel(m.modelId);
  } else {
    probe = await probeGeminiModel(m.modelId);
  }
  
  const statusStr = probe.ok ? 'OPERATIONAL (200 OK)' : `FAILED (${probe.status}: ${probe.error})`;
  console.log(`[${m.role}]`);
  console.log(`  Canonical ID:    ${m.canonicalId}`);
  console.log(`  Provider:        ${m.provider}`);
  console.log(`  ProviderModelId: ${m.modelId}`);
  console.log(`  Live HTTP Probe: ${statusStr} [${probe.latency}ms]`);
  if (!probe.ok) allProbesPassed = false;
}

// 3. Consistency Across Codebase
console.log('\n--- CROSS-FILE CONSISTENCY VERIFICATION ---');

// Check modelRegistry.js resolveModel()
const resolvedGroqDraft = resolveModel('groq', 'canonical');
const resolvedGroqFast = resolveModel('groq', 'fast');
const resolvedGeminiDraft = resolveModel('gemini', 'canonical');
const resolvedGeminiFast = resolveModel('gemini', 'fast');

console.log('modelRegistry.js resolutions:', {
  'groq:canonical': resolvedGroqDraft.providerModelId,
  'groq:fast': resolvedGroqFast.providerModelId,
  'gemini:canonical': resolvedGeminiDraft.providerModelId,
  'gemini:fast': resolvedGeminiFast.providerModelId
});

// Check capabilityMatcher.js
const routeHumanize = matchProviderAndModel({ task: 'humanize', requestedProvider: 'auto' });
const routeScore = matchProviderAndModel({ task: 'score', requestedProvider: 'auto' });
const routeBlog = matchProviderAndModel({ task: 'blog', requestedProvider: 'auto' });

console.log('capabilityMatcher.js routing:', {
  humanize: { provider: routeHumanize.actual_provider, model: routeHumanize.actual_model, fallback: routeHumanize.fallback_model },
  score: { provider: routeScore.actual_provider, model: routeScore.actual_model, fallback: routeScore.fallback_model },
  blog: { provider: routeBlog.actual_provider, model: routeBlog.actual_model, fallback: routeBlog.fallback_model }
});

// Assertions
const expectedDraft = 'openai/gpt-oss-120b';
const expectedFast = 'openai/gpt-oss-20b';
const expectedGeminiDraft = 'gemini-3.5-flash';
const expectedGeminiFast = 'gemini-3.1-flash-lite';

const checks = [
  resolvedGroqDraft.providerModelId === expectedDraft,
  resolvedGroqFast.providerModelId === expectedFast,
  resolvedGeminiDraft.providerModelId === expectedGeminiDraft,
  resolvedGeminiFast.providerModelId === expectedGeminiFast,
  routeHumanize.actual_model === expectedDraft,
  routeScore.actual_model === expectedFast || routeScore.actual_model === 'gemini-3.1-flash-lite',
  allProbesPassed
];

const consistencyPass = checks.every(Boolean);
console.log(`\nModel Registry Consistency Result: ${consistencyPass ? 'PASS' : 'FAIL'}`);

if (!consistencyPass) {
  throw new Error('Phase 3 Model Registry Consistency check failed!');
}
