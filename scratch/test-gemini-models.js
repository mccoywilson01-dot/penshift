import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2
].filter(Boolean);

const models = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash-thinking-exp-01-21',
  'gemini-2.5-flash'
];

async function checkModels() {
  for (const key of GEMINI_KEYS) {
    console.log(`\n--- Testing Key: ${key.slice(0, 10)}... ---`);
    for (const m of models) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hello' }] }]
          })
        });
        if (res.ok) {
          const data = await res.json();
          console.log(`✅ Model ${m}: OK 200 -> Output: ${data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()}`);
        } else {
          console.log(`❌ Model ${m}: Failed ${res.status} (${(await res.json())?.error?.message?.slice(0, 60)}...)`);
        }
      } catch (err) {
        console.log(`❌ Model ${m}: Error ${err.message}`);
      }
    }
  }
}

checkModels();
