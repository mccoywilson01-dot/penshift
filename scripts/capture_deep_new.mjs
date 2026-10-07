import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  // 1. Humanizer
  await page.goto('http://localhost:5173/humanizer', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/Users/satyajishu/.gemini/antigravity-ide/brain/95817c17-2338-45dc-ab10-459f8abd00a7/humanizer_controls_new.png' });

  // 2. Blog Step 2
  await page.goto('http://localhost:5173/blog', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.click('button:has-text("Next: Settings")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/Users/satyajishu/.gemini/antigravity-ide/brain/95817c17-2338-45dc-ab10-459f8abd00a7/blog_step2_new.png' });

  // 3. Blog Step 3
  await page.click('button:has-text("Next: Advanced")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/Users/satyajishu/.gemini/antigravity-ide/brain/95817c17-2338-45dc-ab10-459f8abd00a7/blog_step3_new.png' });

  // 4. Affiliate Step 2
  await page.goto('http://localhost:5173/affiliate', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.click('button:has-text("Next: Strategy")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/Users/satyajishu/.gemini/antigravity-ide/brain/95817c17-2338-45dc-ab10-459f8abd00a7/affiliate_step2_new.png' });

  // 5. Affiliate Step 3
  await page.click('button:has-text("Next: Advanced")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/Users/satyajishu/.gemini/antigravity-ide/brain/95817c17-2338-45dc-ab10-459f8abd00a7/affiliate_step3_new.png' });

  await browser.close();
  console.log('All detailed views captured!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
