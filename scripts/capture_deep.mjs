import { chromium } from '@playwright/test';
import path from 'path';

const outDir = '/Users/satyajishu/.gemini/antigravity-ide/brain/95817c17-2338-45dc-ab10-459f8abd00a7';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Affiliate Step 2
  await page.goto('http://localhost:5173/affiliate', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Strategy")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'screenshot_affiliate_step2.png') });

  // Affiliate Step 3
  await page.click('button:has-text("Advanced")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'screenshot_affiliate_step3.png') });

  // Blog Step 2
  await page.goto('http://localhost:5173/blog', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Settings")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'screenshot_blog_step2.png') });

  // Blog Step 3
  await page.click('button:has-text("Advanced")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'screenshot_blog_step3.png') });

  // Humanizer Tone & Advanced Controls
  await page.goto('http://localhost:5173/humanizer', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.screenshot({ path: path.join(outDir, 'screenshot_humanizer_controls.png') });

  await browser.close();
  console.log('Deep screenshots captured successfully!');
}

run().catch(err => {
  console.error('Deep capture error:', err);
  process.exit(1);
});
