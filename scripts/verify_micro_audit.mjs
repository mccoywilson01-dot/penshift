import { chromium } from 'playwright';

const OUT_DIR = '/Users/satyajishu/.gemini/antigravity-ide/brain/95817c17-2338-45dc-ab10-459f8abd00a7';

async function verify() {
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Standard (1280x800) - laptop size to confirm side-by-side lg:grid-cols-3
  console.log('1. Testing Laptop 1280x800 viewports...');
  const laptop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const lPage = await laptop.newPage();

  // Affiliate Step 1
  await lPage.goto('http://localhost:5173/affiliate', { waitUntil: 'networkidle' });
  await lPage.evaluate(() => window.scrollTo(0, 0));
  await lPage.waitForTimeout(300);
  await lPage.screenshot({ path: `${OUT_DIR}/verify_laptop_affiliate.png` });

  // Blog Step 1
  await lPage.goto('http://localhost:5173/blog', { waitUntil: 'networkidle' });
  await lPage.evaluate(() => window.scrollTo(0, 0));
  await lPage.waitForTimeout(300);
  await lPage.screenshot({ path: `${OUT_DIR}/verify_laptop_blog.png` });

  // Humanizer
  await lPage.goto('http://localhost:5173/humanizer', { waitUntil: 'networkidle' });
  await lPage.evaluate(() => window.scrollTo(0, 0));
  await lPage.waitForTimeout(300);
  await lPage.screenshot({ path: `${OUT_DIR}/verify_laptop_humanizer.png` });

  // Score
  await lPage.goto('http://localhost:5173/score', { waitUntil: 'networkidle' });
  await lPage.evaluate(() => window.scrollTo(0, 0));
  await lPage.waitForTimeout(300);
  await lPage.screenshot({ path: `${OUT_DIR}/verify_laptop_score.png` });

  await laptop.close();

  // 2. Desktop 1440x900 HiDPI
  console.log('2. Testing Desktop 1440x900 HiDPI viewports...');
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const dPage = await desktop.newPage();

  // Blog Step 2
  await dPage.goto('http://localhost:5173/blog', { waitUntil: 'networkidle' });
  await dPage.click('button:has-text("Next: Settings")');
  await dPage.evaluate(() => window.scrollTo(0, 0));
  await dPage.waitForTimeout(250);
  await dPage.screenshot({ path: `${OUT_DIR}/verify_desktop_blog_step2.png` });

  // Affiliate Step 2
  await dPage.goto('http://localhost:5173/affiliate', { waitUntil: 'networkidle' });
  await dPage.click('button:has-text("Next: Strategy")');
  await dPage.evaluate(() => window.scrollTo(0, 0));
  await dPage.waitForTimeout(250);
  await dPage.screenshot({ path: `${OUT_DIR}/verify_desktop_affiliate_step2.png` });

  // Auth modal
  await dPage.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await dPage.click('button:has-text("Sign In")');
  await dPage.waitForTimeout(300);
  await dPage.screenshot({ path: `${OUT_DIR}/verify_desktop_auth.png` });

  await desktop.close();

  // 3. Mobile (390x844)
  console.log('3. Testing Mobile viewports...');
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const mPage = await mobile.newPage();

  // Mobile Blog
  await mPage.goto('http://localhost:5173/blog', { waitUntil: 'networkidle' });
  await mPage.evaluate(() => window.scrollTo(0, 0));
  await mPage.waitForTimeout(250);
  await mPage.screenshot({ path: `${OUT_DIR}/verify_mobile_blog.png` });

  // Mobile Affiliate
  await mPage.goto('http://localhost:5173/affiliate', { waitUntil: 'networkidle' });
  await mPage.evaluate(() => window.scrollTo(0, 0));
  await mPage.waitForTimeout(250);
  await mPage.screenshot({ path: `${OUT_DIR}/verify_mobile_affiliate.png` });

  // Mobile Score
  await mPage.goto('http://localhost:5173/score', { waitUntil: 'networkidle' });
  await mPage.evaluate(() => window.scrollTo(0, 0));
  await mPage.waitForTimeout(250);
  await mPage.screenshot({ path: `${OUT_DIR}/verify_mobile_score.png` });

  // Mobile Drawer Open
  await mPage.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await mPage.click('button[aria-label="Toggle menu"]');
  await mPage.waitForTimeout(350);
  await mPage.screenshot({ path: `${OUT_DIR}/verify_mobile_drawer.png` });

  await mobile.close();
  await browser.close();
  console.log('All verification screenshots captured successfully!');
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});
