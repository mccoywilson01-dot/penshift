import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const outDir = '/Users/satyajishu/.gemini/antigravity-ide/brain/95817c17-2338-45dc-ab10-459f8abd00a7';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('Capturing Home...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, 'screenshot_home_hero.png') });

  // Scroll to stats
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'screenshot_home_stats.png') });

  console.log('Capturing Humanizer...');
  await page.goto('http://localhost:5173/humanizer', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'screenshot_humanizer.png') });

  console.log('Capturing Blog...');
  await page.goto('http://localhost:5173/blog', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'screenshot_blog.png') });

  console.log('Capturing Affiliate...');
  await page.goto('http://localhost:5173/affiliate', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'screenshot_affiliate.png') });

  console.log('Capturing Score...');
  await page.goto('http://localhost:5173/score', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'screenshot_score.png') });

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
