import { chromium } from 'playwright';

const ARTIFACT_DIR = '/Users/satyajishu/.gemini/antigravity-ide/brain/95817c17-2338-45dc-ab10-459f8abd00a7';

async function main() {
  const browser = await chromium.launch({ headless: true });
  
  // Desktop Context
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await desktop.newPage();

  console.log('1. Capturing Home full page...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const distance = 300;
    const delay = 50;
    while (document.scrollingElement.scrollTop + window.innerHeight < document.scrollingElement.scrollHeight) {
      document.scrollingElement.scrollBy(0, distance);
      await new Promise(r => setTimeout(r, delay));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${ARTIFACT_DIR}/audit_home_full.png`, fullPage: true });

  console.log('2. Capturing Humanizer (Editor + Memory Drawer)...');
  await page.goto('http://localhost:5173/humanizer', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  // Click Personal Tone Memory toggle
  const memoryBtn = page.locator('button[aria-label="Toggle Personal Tone Memory"]');
  if (await memoryBtn.count() > 0) {
    await memoryBtn.click();
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: `${ARTIFACT_DIR}/audit_humanizer_editor.png` });

  // Humanizer History tab
  console.log('3. Capturing Humanizer History tab...');
  await page.click('button[role="tab"]:has-text("History")');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${ARTIFACT_DIR}/audit_humanizer_history.png` });

  console.log('4. Capturing Blog (Step 1, Step 2, Step 3)...');
  await page.goto('http://localhost:5173/blog', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ARTIFACT_DIR}/audit_blog_step1.png` });

  await page.click('button:has-text("Next: Settings")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ARTIFACT_DIR}/audit_blog_step2.png` });

  await page.click('button:has-text("Next: Advanced")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ARTIFACT_DIR}/audit_blog_step3.png` });

  console.log('5. Capturing Affiliate (Step 1, Step 2, Step 3)...');
  await page.goto('http://localhost:5173/affiliate', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ARTIFACT_DIR}/audit_affiliate_step1.png` });

  await page.click('button:has-text("Next: Strategy")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ARTIFACT_DIR}/audit_affiliate_step2.png` });

  await page.click('button:has-text("Next: Advanced")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ARTIFACT_DIR}/audit_affiliate_step3.png` });

  console.log('6. Capturing Score (Analyzer, Guide, History)...');
  await page.goto('http://localhost:5173/score', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ARTIFACT_DIR}/audit_score_analyzer.png` });

  await page.click('button:has-text("Guide")');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${ARTIFACT_DIR}/audit_score_guide.png` });

  await page.click('button:has-text("History")');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${ARTIFACT_DIR}/audit_score_history.png` });

  console.log('7. Capturing Auth Modal...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  await page.click('button:has-text("Sign In")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ARTIFACT_DIR}/audit_auth_modal.png` });

  await desktop.close();

  // Mobile Context (iPhone 13 / 14: 390x844)
  console.log('8. Capturing Mobile views...');
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const mPage = await mobile.newPage();

  const routes = [
    { url: 'http://localhost:5173/', name: 'mobile_home' },
    { url: 'http://localhost:5173/humanizer', name: 'mobile_humanizer' },
    { url: 'http://localhost:5173/blog', name: 'mobile_blog' },
    { url: 'http://localhost:5173/affiliate', name: 'mobile_affiliate' },
    { url: 'http://localhost:5173/score', name: 'mobile_score' },
  ];

  for (const r of routes) {
    await mPage.goto(r.url, { waitUntil: 'networkidle' });
    await mPage.waitForTimeout(300);
    await mPage.screenshot({ path: `${ARTIFACT_DIR}/audit_${r.name}.png` });
  }

  await mobile.close();
  await browser.close();
  console.log('Micro audit captures complete!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
