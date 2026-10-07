const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = '/Users/satyajishu/.gemini/antigravity-ide/brain/95817c17-2338-45dc-ab10-459f8abd00a7/audit_screenshots';
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

const DESKTOP_PAGES = [
  { name: 'desktop_01_homepage_hero.png', url: 'http://localhost:5173/' },
  { name: 'desktop_02_humanizer_first_viewport.png', url: 'http://localhost:5173/humanizer' },
  { name: 'desktop_03_blog_first_viewport.png', url: 'http://localhost:5173/blog' },
  { name: 'desktop_04_affiliate_first_viewport.png', url: 'http://localhost:5173/affiliate' },
  { name: 'desktop_05_score_first_viewport.png', url: 'http://localhost:5173/score' },
];

const MOBILE_PAGES = [
  { name: 'mobile_06_homepage.png', url: 'http://localhost:5173/' },
  { name: 'mobile_07_humanizer.png', url: 'http://localhost:5173/humanizer' },
  { name: 'mobile_08_blog.png', url: 'http://localhost:5173/blog' },
  { name: 'mobile_09_affiliate.png', url: 'http://localhost:5173/affiliate' },
  { name: 'mobile_10_score.png', url: 'http://localhost:5173/score' },
];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  console.log('--- CAPTURING DESKTOP (1440x960, 2x Retina) ---');
  const dContext = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2,
  });
  const dPage = await dContext.newPage();

  for (const item of DESKTOP_PAGES) {
    console.log(`Navigating to ${item.url}...`);
    await dPage.goto(item.url, { waitUntil: 'networkidle' });
    await dPage.waitForTimeout(1600);
    const outPath = path.join(ARTIFACT_DIR, item.name);
    await dPage.screenshot({ path: outPath, fullPage: false });
    console.log(`Saved: ${outPath}`);
  }

  // Also capture Homepage Section 2 & 3 to prove background scope
  console.log('Capturing homepage secondary sections for background scope proof...');
  await dPage.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await dPage.waitForTimeout(1000);
  await dPage.evaluate(() => window.scrollBy(0, 850));
  await dPage.waitForTimeout(1000);
  const subSectionPath = path.join(ARTIFACT_DIR, 'desktop_11_homepage_subsections.png');
  await dPage.screenshot({ path: subSectionPath, fullPage: false });
  console.log(`Saved: ${subSectionPath}`);

  await dContext.close();

  console.log('--- CAPTURING MOBILE (390x844, 2x Retina) ---');
  const mContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const mPage = await mContext.newPage();

  for (const item of MOBILE_PAGES) {
    console.log(`Navigating mobile to ${item.url}...`);
    await mPage.goto(item.url, { waitUntil: 'networkidle' });
    await mPage.waitForTimeout(1600);
    const outPath = path.join(ARTIFACT_DIR, item.name);
    await mPage.screenshot({ path: outPath, fullPage: false });
    console.log(`Saved: ${outPath}`);
  }

  await mContext.close();
  await browser.close();
  console.log('ALL 10+ SCREENSHOTS CAPTURED SUCCESSFULLY!');
})();
