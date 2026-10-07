import { chromium } from '@playwright/test';
import path from 'path';

const outDir = '/Users/satyajishu/.gemini/antigravity-ide/brain/95817c17-2338-45dc-ab10-459f8abd00a7';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  
  // Scroll to fallback chain and CTA
  await page.evaluate(() => window.scrollBy(0, 3600));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'screenshot_home_chain_cta.png') });

  await browser.close();
  console.log('Home chain captured!');
}

run().catch(console.error);
