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

const GROQ_KEY = process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY;

const sampleText = `Artificial intelligence is fundamentally transforming the modern business landscape in unprecedented ways. It is important to note that organizations must delve into novel methodologies and leverage robust frameworks to foster innovation. Furthermore, utilizing comprehensive metrics is a testament to sustainable operational excellence in today's rapidly evolving world.`;

const PROMPT = {
  system: `You are an expert human writer and editor. Your task is to rewrite AI-generated text so it sounds 100% natural, human, and authentic.

CRITICAL PRINCIPLES:
1. DE-JARGONIZE: Completely eliminate corporate fluff, empty buzzwords, and academic abstractions (e.g., "fundamentally transforming", "business landscape", "unprecedented ways", "novel methodologies", "robust frameworks", "sustainable operational excellence", "testament to").
2. CONCRETE REALITY: Rewrite abstract claims into grounded, practical human statements. Explain how things actually work in plain English.
3. ORGANIC HUMAN CADENCE:
   - Mix short, decisive sentences with natural, conversational explanations.
   - Use natural human contractions (it's, don't, we're, they've).
   - Use natural transitional phrasing (e.g., "In practice,", "Honestly,", "The real key is", "What actually matters is").
   - NEVER use formulaic rhetorical questions (e.g. "What do organizations need?").
   - NEVER use mechanical sentence fragments (e.g. "Simple. Fast. Reliable.").
4. MEANING: Retain the core underlying factual meaning and message.
5. NO PREAMBLE / NO QUOTES: Return ONLY the plain humanized text.`,
  user: `Transform this AI text into natural, human-sounding writing:\n\n${sampleText}`
};

async function test() {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: PROMPT.system },
        { role: 'user', content: PROMPT.user }
      ],
      temperature: 0.82,
      top_p: 0.92,
      max_tokens: 1000
    })
  });
  const data = await res.json();
  console.log('--- REFINED HUMANIZER OUTPUT ---');
  console.log(data.choices?.[0]?.message?.content);
}

test();
