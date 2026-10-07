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

async function testGenerating() {
  const vite = spawn('npm', ['run', 'dev', '--', '--port', '5173'], {
    cwd: '/Users/satyajishu/Downloads/penshift-v8',
    stdio: 'pipe',
  });

  try {
    await waitForServer('http://localhost:5173');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

  let releaseStream;
  const holdStream = new Promise((resolve) => { releaseStream = resolve; });

  await page.route('**/api/generate', async (route) => {
    const req = route.request();
    let postData = {};
    try { postData = req.postDataJSON() || {}; } catch {}

    if (postData.task === 'score') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ score: { aiScore: 4, humanScore: 96 } })
      });
    }

    // Hold the response so it stays in generating/humanizing state
    await holdStream;
    return route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'data: {"text": "Done."}\n\ndata: [DONE]\n\n'
    });
  });

  await page.goto('http://localhost:5173/humanizer', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  const textarea = page.locator('textarea#input-text');
  await textarea.fill(
    'The utilization of artificial intelligence models facilitates the profound augmentation of textual assets.'
  );
  await page.waitForTimeout(400);

  const humanizeBtn = page.getByRole('button', { name: /Humanize/i }).filter({ hasText: 'Humanize' });
  await humanizeBtn.click();

  // Wait for loading indicator / progress to appear
  await page.waitForSelector('text=Humanizing', { timeout: 5000 });
  await page.waitForTimeout(300);

  const filePath = path.join(OUT_DIR, '03b_humanizer_generating.png');
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`Captured generating screenshot to: ${filePath}`);

  // Also copy to workspace screenshots
  const wsPath = '/Users/satyajishu/Downloads/penshift-v8/screenshots/03b_humanizer_generating.png';
  await page.screenshot({ path: wsPath, fullPage: true });
  console.log(`Copied to workspace: ${wsPath}`);

  // Release stream and close
  releaseStream();
  await page.waitForTimeout(500);
  await browser.close();
  } finally {
    vite.kill('SIGTERM');
  }
}

testGenerating().catch(err => {
  console.error(err);
  process.exit(1);
});
