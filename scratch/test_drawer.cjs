const { chromium } = require('playwright-core');

async function testDrawer() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }
  });

  const page = await context.newPage();
  await page.goto('http://localhost:5173/humanizer', { waitUntil: 'networkidle' });
  
  // Click history FAB
  const fab = await page.$('button[aria-label="Open generation history"]');
  if (fab) {
    await fab.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'scratch/mobile_history_drawer.png' });
    console.log('Captured scratch/mobile_history_drawer.png');
  }

  // Also test Auth modal
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  const menuBtn = await page.$('button[aria-label="Toggle menu"]');
  if (menuBtn) {
    await menuBtn.click();
    await page.waitForTimeout(300);
    // Click Sign In
    const signInBtn = await page.$('button:has-text("Sign In")');
    if (signInBtn) {
      await signInBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'scratch/mobile_auth_modal.png' });
      console.log('Captured scratch/mobile_auth_modal.png');
    }
  }

  await browser.close();
}

testDrawer().catch(err => {
  console.error(err);
  process.exit(1);
});
