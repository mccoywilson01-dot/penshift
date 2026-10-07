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
process.env.NODE_ENV = 'test';
process.env.PENSHIFT_DEV_MODE = 'true';

// Dynamic imports will happen in runTests after env is loaded

// Mock Response Helper
class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.body = '';
    this.isStream = false;
    this.streamData = [];
    this.headersSent = false;
    this.writableEnded = false;
  }
  setHeader(name, val) {
    this.headers[name] = val;
  }
  getHeader(name) {
    return this.headers[name];
  }
  status(code) {
    this.statusCode = code;
    return this;
  }
  writeHead(code, headers = {}) {
    this.statusCode = code;
    this.headersSent = true;
    Object.assign(this.headers, headers);
    return this;
  }
  flushHeaders() {
    this.headersSent = true;
  }
  write(chunk) {
    this.isStream = true;
    this.streamData.push(chunk);
    return true;
  }
  end(data) {
    if (data) this.write(data);
    this.writableEnded = true;
  }
  json(obj) {
    this.headersSent = true;
    this.writableEnded = true;
    this.body = JSON.stringify(obj);
    return this;
  }
  send(data) {
    this.headersSent = true;
    this.writableEnded = true;
    this.body = data;
    return this;
  }
  getTextOutput() {
    if (this.isStream) {
      let fullText = '';
      for (const chunk of this.streamData) {
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line.length > 6) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) fullText += parsed.text;
            } catch (e) {}
          }
        }
      }
      return fullText;
    }
    if (typeof this.body === 'string') {
      try {
        const parsed = JSON.parse(this.body);
        if (parsed && typeof parsed.text === 'string') return parsed.text;
        if (parsed && typeof parsed.output === 'string') return parsed.output;
        return this.body;
      } catch {
        return this.body;
      }
    }
    return String(this.body || '');
  }
}

async function runTests() {
  const { default: healthHandler } = await import('../api/health.js');
  const { default: generateHandler } = await import('../api/generate.js');
  const { default: plagiarismHandler } = await import('../api/plagiarism.js');
  const { default: grammarHandler } = await import('../api/grammar.js');
  const { default: readabilityHandler } = await import('../api/readability.js');

  console.log('════════════════════════════════════════════════════════════════');
  console.log('🚀 PENSHIFT V8 END-TO-END AUTOMATED VERIFICATION SUITE');
  console.log('════════════════════════════════════════════════════════════════\n');

  // TEST 1: Health Check
  console.log('🧪 TEST 1: /api/health');
  try {
    const res = new MockResponse();
    await healthHandler({ method: 'GET', headers: {} }, res);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${res.body}`);
    if (res.statusCode === 200) {
      console.log('✅ Health check passed!\n');
    } else {
      console.log('❌ Health check failed with non-200\n');
    }
  } catch (err) {
    console.error('❌ Health check exception:', err);
  }

  // TEST 2: Content Generation + Humanize
  console.log('🧪 TEST 2: /api/generate (Humanize task with AI text)');
  const sampleAIText = `Artificial intelligence is fundamentally transforming the modern business landscape in unprecedented ways. It is important to note that organizations must delve into novel methodologies and leverage robust frameworks to foster innovation. Furthermore, utilizing comprehensive metrics is a testament to sustainable operational excellence in today's rapidly evolving world.`;
  try {
    const req = {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', authorization: 'Bearer test-token' },
      body: {
        prompt: sampleAIText,
        task: 'humanize',
        mode: 'aggressive',
        apiProvider: 'auto'
      }
    };
    const res = new MockResponse();
    await generateHandler(req, res);
    const humanizedText = res.getTextOutput();
    console.log(`Status: ${res.statusCode}`);
    console.log(`Stream chunks received: ${res.streamData.length}`);
    console.log(`Humanized Output Preview (${humanizedText.length} chars):\n---\n${humanizedText.slice(0, 300)}...\n---`);
    if (humanizedText && humanizedText.length > 50) {
      console.log('✅ Humanize test PASSED!\n');
    } else {
      console.log(`❌ Humanize test FAILED! Raw res:`, res.streamData, res.body);
    }
  } catch (err) {
    console.error('❌ Humanize test exception:', err);
  }

  // TEST 3: Affiliate Review Generation for 'prostavive'
  console.log('🧪 TEST 3: /api/generate (Affiliate Review for "ProstaVive")');
  try {
    const req = {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', authorization: 'Bearer test-token' },
      body: {
        prompt: 'ProstaVive',
        task: 'affiliate',
        mode: 'standard',
        apiProvider: 'auto',
        prosCons: true,
        schemaMarkup: true,
        affiliateLink: 'https://prostavive.com/discount',
        length: '900-1400 words'
      }
    };
    const res = new MockResponse();
    await generateHandler(req, res);
    const affiliateOutput = res.getTextOutput();
    console.log(`Status: ${res.statusCode}`);
    console.log(`Stream chunks received: ${res.streamData.length}`);
    console.log(`Affiliate Output Length: ${affiliateOutput.length} chars`);
    console.log(`Affiliate Output Preview:\n---\n${affiliateOutput.slice(0, 400)}...\n---`);
    
    const hasSchema = affiliateOutput.includes('application/ld+json') || affiliateOutput.includes('schema.org') || affiliateOutput.includes('json');
    const hasLink = affiliateOutput.includes('prostavive.com/discount') || affiliateOutput.includes('ProstaVive');
    const hasProsCons = affiliateOutput.toLowerCase().includes('pros') && affiliateOutput.toLowerCase().includes('cons');

    console.log(`Checks: Schema Markup=${hasSchema}, Link/Name=${hasLink}, Pros/Cons=${hasProsCons}`);
    if (affiliateOutput && affiliateOutput.length > 200) {
      console.log('✅ Affiliate ProstaVive test PASSED!\n');
    } else {
      console.log('❌ Affiliate ProstaVive test FAILED!\n');
    }
  } catch (err) {
    console.error('❌ Affiliate test exception:', err);
  }

  // TEST 4: Blog Generation with Tavily Research Context
  console.log('🧪 TEST 4: /api/generate (Blog Article with Tavily Research)');
  try {
    const req = {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', authorization: 'Bearer test-token' },
      body: {
        prompt: 'Best morning habits to boost daily energy naturally',
        task: 'blog',
        mode: 'seo',
        apiProvider: 'auto',
        readabilityTarget: 'Middle School',
        length: '900-1400 words'
      }
    };
    const res = new MockResponse();
    await generateHandler(req, res);
    const blogOutput = res.getTextOutput();
    console.log(`Status: ${res.statusCode}`);
    console.log(`Stream chunks received: ${res.streamData.length}`);
    console.log(`Blog Output Length: ${blogOutput.length} chars`);
    console.log(`Blog Output Preview:\n---\n${blogOutput.slice(0, 350)}...\n---`);
    if (blogOutput && blogOutput.length > 200) {
      console.log('✅ Blog generation test PASSED!\n');
    } else {
      console.log('❌ Blog generation test FAILED!\n');
    }
  } catch (err) {
    console.error('❌ Blog test exception:', err);
  }

  // TEST 5: AI Detector Score
  console.log('🧪 TEST 5: /api/generate (Score task)');
  try {
    const req = {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', authorization: 'Bearer test-token' },
      body: {
        prompt: sampleAIText,
        action: 'score',
        apiProvider: 'auto'
      }
    };
    const res = new MockResponse();
    await generateHandler(req, res);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Score Response:`, res.body);
    const parsed = JSON.parse(res.body);
    if (parsed.score && typeof parsed.score.humanScore === 'number') {
      console.log(`✅ Score test PASSED! Human: ${parsed.score.humanScore}%, AI: ${parsed.score.aiScore}%\n`);
    } else {
      console.log('❌ Score test FAILED!\n');
    }
  } catch (err) {
    console.error('❌ Score test exception:', err);
  }

  // TEST 6: Readability API
  console.log('🧪 TEST 6: /api/readability');
  try {
    const req = {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', authorization: 'Bearer test-token' },
      body: { text: sampleAIText }
    };
    const res = new MockResponse();
    await readabilityHandler(req, res);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Readability Response:`, res.body);
    const parsed = JSON.parse(res.body);
    if (parsed.metrics && parsed.metrics.fleschReadingEase !== undefined) {
      console.log('✅ Readability test PASSED!\n');
    } else {
      console.log('❌ Readability test FAILED!\n');
    }
  } catch (err) {
    console.error('❌ Readability test exception:', err);
  }

  // TEST 7: Grammar API
  console.log('🧪 TEST 7: /api/grammar');
  try {
    const req = {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', authorization: 'Bearer test-token' },
      body: { text: 'He go to the store yesterday and buyed apples.' }
    };
    const res = new MockResponse();
    await grammarHandler(req, res);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Grammar Response:`, res.body.slice(0, 300));
    if (res.statusCode === 200) {
      console.log('✅ Grammar test PASSED!\n');
    } else {
      console.log(`❌ Grammar test returned status ${res.statusCode}\n`);
    }
  } catch (err) {
    console.error('❌ Grammar test exception:', err);
  }

  // TEST 8: Plagiarism API
  console.log('🧪 TEST 8: /api/plagiarism');
  try {
    const req = {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', authorization: 'Bearer test-token' },
      body: { text: 'To be, or not to be, that is the question: Whether \'tis nobler in the mind to suffer the slings and arrows of outrageous fortune.' }
    };
    const res = new MockResponse();
    await plagiarismHandler(req, res);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Plagiarism Response:`, res.body);
    if (res.statusCode === 200) {
      console.log('✅ Plagiarism test PASSED!\n');
    } else {
      console.log(`❌ Plagiarism test returned status ${res.statusCode}\n`);
    }
  } catch (err) {
    console.error('❌ Plagiarism test exception:', err);
  }

  console.log('════════════════════════════════════════════════════════════════');
  console.log('🏁 ALL TESTS EXECUTED');
  console.log('════════════════════════════════════════════════════════════════');
}

runTests();
