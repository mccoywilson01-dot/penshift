import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { persistGenerationRow, findGenerationById } from '../api/_lib/supabase.js';

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
console.log('PHASE 1 — SUPABASE PERSISTENCE LIVE VERIFICATION');
console.log('====================================================');

const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error('FAIL: SUPABASE_SERVICE_ROLE_KEY is not configured in .env');
  process.exit(1);
}

const client = createClient(url, serviceKey);

// 1. Check table existence (No PGRST205)
console.log('>>> 1. Verifying public.generations existence & schema cache <<<');
const { data: initialRead, error: readErr } = await client.from('generations').select('id').limit(1);

if (readErr) {
  console.error(`FAILED: ${readErr.message} (Code: ${readErr.code})`);
  if (readErr.code === 'PGRST205') {
    console.error('BLOCKER: DDL migration has not been executed on remote PostgreSQL database yet.');
  }
  process.exit(1);
}

console.log('PASS: client.from("generations").select("id").limit(1) resolved without PGRST205!');

// 2. Test Real Application Persistence Path
console.log('\n>>> 2. Exercising Application Persistence Path (persistGenerationRow) <<<');
const testUserId = '00000000-0000-0000-0000-000000000001';
const testIdempotencyKey = `live_gate_${Date.now()}`;

const testPayload = {
  user_id: testUserId,
  idempotency_key: testIdempotencyKey,
  type: 'penshift_history',
  task: 'humanize',
  requested_mode: 'standard',
  requested_provider: 'groq',
  actual_provider: 'groq',
  actual_model: 'openai/gpt-oss-120b',
  input_text: 'The committee stopped short of approving the proposed transaction.',
  output_text: 'The committee chose not to finalize approval for the proposed deal.',
  input_word_count: 9,
  output_word_count: 11,
  scores: { semanticFidelity: 1.0, humanCadence: 0.94 },
  status: 'COMPLETED'
};

const persisted = await persistGenerationRow(testPayload);
if (!persisted || !persisted.id) {
  console.error('FAIL: persistGenerationRow failed to return persisted record.');
  process.exit(1);
}

console.log(`PASS: Record persisted with ID: ${persisted.id}`);
console.log(`  Status:          ${persisted.status}`);
console.log(`  Actual Provider: ${persisted.actual_provider}`);
console.log(`  Actual Model:    ${persisted.actual_model}`);
console.log(`  Generated Provider: ${persisted.provider}`);
console.log(`  Generated Mode:     ${persisted.mode}`);

// 3. Retrieve through history / read path
console.log('\n>>> 3. Verifying Read / Retrieval Path <<<');
const retrieved = await findGenerationById(persisted.id);
if (!retrieved || retrieved.id !== persisted.id) {
  console.error('FAIL: findGenerationById failed to retrieve persisted row.');
  process.exit(1);
}

console.log('PASS: findGenerationById successfully retrieved persisted row!');
console.log('\nPHASE 1 PERSISTENCE VERIFICATION: 100% PASS');
