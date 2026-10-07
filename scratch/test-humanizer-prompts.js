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

const inputAIText = `Artificial intelligence is fundamentally transforming the modern business landscape in unprecedented ways. It is important to note that organizations must delve into novel methodologies and leverage robust frameworks to foster innovation. Furthermore, utilizing comprehensive metrics is a testament to sustainable operational excellence in today's rapidly evolving world.`;

const GROQ_KEY = process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;

// PROMPT CANDIDATE 1: Deep Semantic Deconstruction & Grounded Human Voice
const PROMPT_V1 = {
  system: `You are a professional human editor and writer. Your job is to completely rewrite AI-generated text so it sounds 100% human-written, authentic, and natural.

CRITICAL RULES:
1. MEANING: Retain the core ideas and facts of the original text.
2. VOICE & TONE: Write like a real person with a clear perspective. Use natural contractions (it's, don't, we've), varied sentence lengths, and concrete words.
3. ABSOLUTE BAN LIST (NEVER USE):
   - delve, leverage, robust, testament, foster, landscape, tapestry, realm, vital, paramount, pivotal, seamless, revolutionize, transformative, game-changer, beacon, embark
   - "in today's world", "it is important to note", "furthermore", "moreover", "in conclusion", "to summarize", "a myriad of"
4. BURSTINESS & PERPLEXITY:
   - Mix very short sentences (3-6 words) with medium (10-16 words) and longer compound sentences (20+ words).
   - Use direct, everyday phrasing instead of abstract corporate buzzwords (e.g., say "new tools that work" instead of "novel methodological frameworks").
5. DO NOT output boilerplate, intro, outro, quotation marks, or meta-comments. Return ONLY the rewritten text.`,
  user: `Rewrite this AI text to be 100% human, natural, and engaging:\n\n${inputAIText}`
};

// PROMPT CANDIDATE 2: Two-step Persona Rewrite (Practical Veteran Practitioner)
const PROMPT_V2 = {
  system: `You are an experienced practitioner who writes with genuine human clarity, grit, and conversational warmth. 

Your mission: Take sterile, corporate AI text and rewrite it as if you're explaining it directly to a colleague over coffee.

STRICT GUIDELINES:
- Strip away every single trace of corporate fluff ("operational excellence", "transforming the landscape", "leveraging frameworks").
- Translate abstract concepts into concrete, grounded realities.
- Vary your cadence: throw in short thoughts, natural pauses with dashes or commas, and flowing explanations.
- Use natural idioms and conversational flow without sounding forced.
- Never use rhetorical questions unless they are genuinely thought-provoking.
- Never include fake robotic fragments.
- Keep the length roughly similar (within 15% of original word count).

Output ONLY the raw rewritten text. No formatting headers, no quotes.`,
  user: `Text to humanize:\n${inputAIText}`
};

// PROMPT CANDIDATE 3: Ultra-High Perplexity Humanizer (God Mode)
const PROMPT_V3 = {
  system: `You are an elite ghostwriter known for high-perplexity, rhythmically diverse, and emotionally grounded prose. 

To make text undetectable by AI detectors (GPTZero, Turnitin, Originality.ai), apply these structural dynamics:
1. Asymmetrical Syntax: Never write balanced clauses ("not only X, but also Y"). Break parallel patterns.
2. Grounded Vocabulary: Replace 100% of Latinate business jargon with crisp Anglo-Saxon verbs and nouns.
3. Natural Human Cadence: Combine a 4-word punchy statement with a 24-word conversational reflection.
4. Idiomatic Connectives: Use "Honestly,", "The real kicker is,", "At the end of the day,", "Here's what happens in practice:".
5. Omit all AI tropes: no "delve", "testament", "landscape", "foster", "robust", "unprecedented", "moreover", "furthermore".

Preserve the original meaning completely.
Output ONLY the transformed human text.`,
  user: `Text to rewrite:\n${inputAIText}`
};

async function testGroq(promptObj, label) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: promptObj.system },
          { role: 'user', content: promptObj.user }
        ],
        temperature: 0.85,
        top_p: 0.9,
        max_tokens: 1000
      })
    });
    const data = await res.json();
    console.log(`\n================== ${label} (Groq Llama 3.3 70B) ==================`);
    const output = data.choices?.[0]?.message?.content;
    console.log(output);
    return output;
  } catch (e) {
    console.error(`Error ${label}:`, e);
  }
}

async function testGemini(promptObj, label) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: promptObj.system }] },
        contents: [{ parts: [{ text: promptObj.user }] }],
        generationConfig: { temperature: 0.85, topP: 0.95 }
      })
    });
    const data = await res.json();
    console.log(`\n================== ${label} (Gemini 2.0 Flash) Status: ${res.status} ==================`);
    if (!res.ok) {
      console.log('Gemini Error:', JSON.stringify(data));
    }
    const output = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log(output);
    return output;
  } catch (e) {
    console.error(`Error ${label}:`, e);
  }
}

async function run() {
  console.log('Testing Humanizer Prompts on sample text:');
  console.log(inputAIText);
  
  await testGroq(PROMPT_V1, 'Candidate V1');
  await testGroq(PROMPT_V2, 'Candidate V2');
  await testGroq(PROMPT_V3, 'Candidate V3');
  
  await testGemini(PROMPT_V1, 'Gemini V1');
  await testGemini(PROMPT_V2, 'Gemini V2');
  await testGemini(PROMPT_V3, 'Gemini V3');
}

run();
