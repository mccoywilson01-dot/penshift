import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';

const OUT_DIR = '/Users/satyajishu/.gemini/antigravity-ide/brain/712ff563-c94d-4c8d-b0a2-a766be7fbb80/screenshots';

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error(`Server did not start at ${url} within ${timeoutMs}ms`);
}

async function run() {
  console.log('Starting Vite server...');
  const vite = spawn('npm', ['run', 'dev', '--', '--port', '5173'], {
    cwd: '/Users/satyajishu/Downloads/penshift-v8',
    stdio: 'pipe',
  });

  vite.stderr.on('data', d => console.error(`[vite err] ${d}`));
  
  try {
    await waitForServer('http://localhost:5173');
    console.log('Vite server ready. Launching Chromium...');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    async function capture(pagePath, filename, prepareFn = null) {
      console.log(`Capturing: ${pagePath} -> ${filename}...`);
      await page.goto(`http://localhost:5173${pagePath}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);

      if (prepareFn) {
        await prepareFn(page);
      }

      const filePath = path.join(OUT_DIR, filename);
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`Saved: ${filePath}`);
    }

    // 1. Home
    await capture('/', '01_home_page.png');

    // 2. Humanizer (Empty)
    await capture('/humanizer', '02_humanizer_empty.png');

    // 3. Humanizer (Populated with text)
    await capture('/humanizer', '03_humanizer_populated.png', async (p) => {
      const textarea = p.locator('textarea#input-text');
      await textarea.fill(
        'The continuous advancement of large language models and neural generative architectures has substantially transformed modern digital publishing. Enterprise teams increasingly require sophisticated algorithmic synthesis to produce nuanced, contextually coherent narratives.'
      );
      await p.waitForTimeout(400);
    });

    // 4. Humanizer (Completed with output & scores)
    await (async () => {
      const p = await context.newPage();
      await p.route('**/api/generate', async (route) => {
        const req = route.request();
        let postData = {};
        try { postData = req.postDataJSON() || {}; } catch {}

        if (postData.task === 'score') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              score: {
                aiScore: 3,
                humanScore: 97,
                breakdown: { burstiness: 20, perplexity: 19, predictability: 19, repetition: 20, formality: 19 }
              }
            })
          });
        }
        const sseBody = 'data: {"text": "When we step back and examine modern neural systems, the most striking shift isn\'t just scale—it\'s cadence. Writing like a real human means abandoning tidy corporate predictability and letting authentic ideas breathe."}\n\ndata: [DONE]\n\n';
        return route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: sseBody
        });
      });

      await p.goto('http://localhost:5173/humanizer', { waitUntil: 'networkidle' });
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(400);

      const textarea = p.locator('textarea#input-text');
      await textarea.fill(
        'The continuous advancement of large language models and neural generative architectures has substantially transformed modern digital publishing.'
      );
      await p.waitForTimeout(400);

      const humanizeBtn = p.getByRole('button', { name: /Humanize/i }).filter({ hasText: 'Humanize' });
      await humanizeBtn.click();
      await p.waitForSelector('text=When we step back and examine modern neural systems', { timeout: 10000 });
      await p.waitForTimeout(1000);

      const filePath = path.join(OUT_DIR, '04_humanizer_completed.png');
      await p.screenshot({ path: filePath, fullPage: true });
      console.log(`Saved: ${filePath}`);
      await p.close();
    })();

    // 5. Score
    await capture('/score', '05_score_page.png');

    // 6. Blog
    await capture('/blog', '06_blog_page.png');

    // 7. Affiliate
    await capture('/affiliate', '07_affiliate_page.png');

    await browser.close();
    console.log('All screenshots captured successfully!');
  } finally {
    vite.kill('SIGTERM');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
