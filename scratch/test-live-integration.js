import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { Receiver } from '@upstash/qstash';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
const envPath = path.resolve(__dirname, '../.env');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  }
}

// Populate process.env with the actual configured variables
for (const [k, v] of Object.entries(env)) {
  process.env[k] = v;
}

console.log('════════════════════════════════════════════════════════════════');
console.log('🌐 PENSHIFT REVISION 9: LIVE / STAGING INTEGRATION PROBE');
console.log('════════════════════════════════════════════════════════════════\n');

async function probeLiveServices() {
  const results = {
    supabase: null,
    redis: null,
    qstash: null,
    gemini: null,
    groq: null,
    tavily: null,
    vercelDeployment: null
  };

  // 1. SUPABASE PROBE
  console.log('--- 1. Probing Supabase Real Service ---');
  const supaUrl = env.VITE_SUPABASE_URL;
  const supaAnon = env.VITE_SUPABASE_ANON_KEY;
  console.log(`Endpoint: ${supaUrl || 'MISSING'}`);
  if (!supaUrl || supaUrl.includes('placeholder') || !supaAnon) {
    results.supabase = { status: 'CONFIG_PLACEHOLDER', message: 'Configured with placeholder/dummy values' };
  }
  try {
    const client = createClient(supaUrl, supaAnon);
    const { data, error } = await client.from('generations').select('count', { count: 'exact', head: true });
    if (error) {
      results.supabase = { status: 'FAILED', message: `${error.message} (Code: ${error.code || 'N/A'})` };
    } else {
      results.supabase = { status: 'SUCCESS', message: 'Connected to live Supabase generations table' };
    }
  } catch (err) {
    results.supabase = { status: 'NETWORK_ERROR', message: err.message };
  }
  console.log(`Result: [${results.supabase.status}] ${results.supabase.message}\n`);

  // 2. UPSTASH REDIS PROBE
  console.log('--- 2. Probing Upstash Redis Real Service ---');
  const redisUrl = env.UPSTASH_REDIS_REST_URL;
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN;
  console.log(`Endpoint: ${redisUrl || 'MISSING'}`);
  try {
    const res = await fetch(`${redisUrl}/ping`, {
      headers: { Authorization: `Bearer ${redisToken}` }
    });
    const body = await res.text();
    if (res.ok && body.includes('PONG')) {
      results.redis = { status: 'SUCCESS', message: 'PONG received from Upstash' };
    } else {
      results.redis = { status: 'FAILED', message: `HTTP ${res.status}: ${body.slice(0, 100)}` };
    }
  } catch (err) {
    results.redis = { status: 'NETWORK_ERROR', message: err.message };
  }
  console.log(`Result: [${results.redis.status}] ${results.redis.message}\n`);

  // 3. QSTASH PROBE
  console.log('--- 3. Probing Upstash QStash Real Service ---');
  const qstashToken = env.QSTASH_TOKEN || process.env.QSTASH_TOKEN;
  console.log(`Token configured: ${qstashToken ? 'YES' : 'NO'}`);
  if (!qstashToken) {
    results.qstash = { status: 'MISSING_CREDENTIALS', message: 'QSTASH_TOKEN not provided in environment' };
  } else {
    try {
      const res = await fetch('https://qstash.upstash.io/v2/messages', {
        headers: { Authorization: `Bearer ${qstashToken}` }
      });
      results.qstash = { status: res.status === 200 ? 'SUCCESS' : 'FAILED', message: `HTTP ${res.status}` };
    } catch (err) {
      results.qstash = { status: 'NETWORK_ERROR', message: err.message };
    }
  }
  console.log(`Result: [${results.qstash.status}] ${results.qstash.message}\n`);

  // 4. GEMINI API PROBE
  console.log('--- 4. Probing Google Gemini Real API ---');
  const geminiKey = env.GEMINI_API_KEY_1 || env.GEMINI_API_KEY;
  console.log(`Key configured: ${geminiKey ? (geminiKey.includes('placeholder') ? 'PLACEHOLDER' : 'REAL') : 'NO'}`);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] })
    });
    const text = await res.text();
    if (res.ok) {
      results.gemini = { status: 'SUCCESS', message: 'HTTP 200 Live generation verified' };
    } else {
      results.gemini = { status: 'FAILED', message: `HTTP ${res.status}: ${text.slice(0, 120)}` };
    }
  } catch (err) {
    results.gemini = { status: 'NETWORK_ERROR', message: err.message };
  }
  console.log(`Result: [${results.gemini.status}] ${results.gemini.message}\n`);

  // 5. GROQ API PROBE
  console.log('--- 5. Probing Groq Cloud Real API ---');
  const groqKey = env.GROQ_API_KEY_1 || env.GROQ_API_KEY;
  console.log(`Key configured: ${groqKey ? (groqKey.includes('placeholder') ? 'PLACEHOLDER' : 'REAL') : 'NO'}`);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${groqKey}` }
    });
    const text = await res.text();
    if (res.ok) {
      results.groq = { status: 'SUCCESS', message: 'HTTP 200 Live models listed' };
    } else {
      results.groq = { status: 'FAILED', message: `HTTP ${res.status}: ${text.slice(0, 120)}` };
    }
  } catch (err) {
    results.groq = { status: 'NETWORK_ERROR', message: err.message };
  }
  console.log(`Result: [${results.groq.status}] ${results.groq.message}\n`);

  // 6. TAVILY API PROBE
  console.log('--- 6. Probing Tavily Real Search API ---');
  const tavilyKey = env.TAVILY_API_KEY;
  console.log(`Key configured: ${tavilyKey ? (tavilyKey.includes('placeholder') ? 'PLACEHOLDER' : 'REAL') : 'NO'}`);
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: tavilyKey, query: 'ping' })
    });
    const text = await res.text();
    if (res.ok) {
      results.tavily = { status: 'SUCCESS', message: 'HTTP 200 Live search responded' };
    } else {
      results.tavily = { status: 'FAILED', message: `HTTP ${res.status}: ${text.slice(0, 120)}` };
    }
  } catch (err) {
    results.tavily = { status: 'NETWORK_ERROR', message: err.message };
  }
  console.log(`Result: [${results.tavily.status}] ${results.tavily.message}\n`);

  // 7. VERCEL DEPLOYMENT PROBE
  console.log('--- 7. Probing Vercel Deployment ---');
  const projectJsonPath = path.resolve(__dirname, '../.vercel/project.json');
  if (fs.existsSync(projectJsonPath)) {
    const pJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
    console.log(`Linked Vercel Project: ${pJson.projectName} (Org: ${pJson.orgId}, ID: ${pJson.projectId})`);
  }
  try {
    const testDeploy = await fetch('https://penshift-v8.vercel.app', { method: 'HEAD' });
    results.vercelDeployment = { status: testDeploy.status === 200 ? 'SUCCESS' : 'NOT_DEPLOYED', message: `HTTP ${testDeploy.status}` };
  } catch (err) {
    results.vercelDeployment = { status: 'NETWORK_ERROR', message: err.message };
  }
  console.log(`Result: [${results.vercelDeployment.status}] ${results.vercelDeployment.message}\n`);

  return results;
}

probeLiveServices();
