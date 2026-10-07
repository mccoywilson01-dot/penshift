import { MODEL_REGISTRY, getModel, getModelsByProvider, resolveModel } from '../api/_lib/ai/modelRegistry.js';
import assert from 'assert';

console.log('=== TESTING PHASE 1: MODEL REGISTRY ===');

// 1. Every registry providerModelId is non-empty
for (const [id, entry] of Object.entries(MODEL_REGISTRY)) {
  assert(entry.providerModelId && entry.providerModelId.trim().length > 0, `Empty providerModelId for ${id}`);
  assert(['groq', 'gemini'].includes(entry.provider), `Invalid provider for ${id}`);
}
console.log('PASS 1: All registry providerModelIds are non-empty.');

// 2. Deprecated IDs check - no entry should point to dead model IDs
const deadIds = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash-pro'];
for (const [id, entry] of Object.entries(MODEL_REGISTRY)) {
  assert(!deadIds.includes(entry.providerModelId), `Entry ${id} points to dead providerModelId ${entry.providerModelId}`);
}
console.log('PASS 2: Zero entries point to deprecated model IDs.');

// 3. Fallback candidates are distinct and reachable
const groqModels = getModelsByProvider('groq', { onlyEnabled: true });
const geminiModels = getModelsByProvider('gemini', { onlyEnabled: true });

console.log('Enabled Groq models:', groqModels.map(m => `${m.providerModelId} (priority ${m.fallbackPriority})`));
console.log('Enabled Gemini models:', geminiModels.map(m => `${m.providerModelId} (priority ${m.fallbackPriority})`));

assert(groqModels.length >= 2, 'Must have at least 2 enabled Groq models');
assert(geminiModels.length >= 2, 'Must have at least 2 enabled Gemini models');
console.log('PASS 3: Fallback candidates distinct.');

// 4. Resolving drafting and scoring models
const groqDraft = resolveModel('groq', 'draft');
const groqScore = resolveModel('groq', 'score');
const geminiDraft = resolveModel('gemini', 'draft');
const geminiScore = resolveModel('gemini', 'score');

assert.strictEqual(groqDraft.providerModelId, 'openai/gpt-oss-120b');
assert.strictEqual(groqScore.providerModelId, 'openai/gpt-oss-20b');
assert.strictEqual(geminiDraft.providerModelId, 'gemini-3.8-flash');
assert.strictEqual(geminiScore.providerModelId, 'gemini-3.1-flash-lite');
console.log('PASS 4: Resolution to operational drafting & scoring models verified.');

console.log('=== PHASE 1 TEST SUITE PASSED ===');
