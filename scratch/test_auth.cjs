const { chromium } = require('playwright-core');

async function testAuth() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  // Click Sign In on desktop
  const signInBtn = await page.$('header button:has-text("Sign In")');
  if (signInBtn) {
    await signInBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'scratch/auth_modal_desktop.png' });
    console.log('Captured scratch/auth_modal_desktop.png');
  }

  await browser.close();
}

testAuth().catch(err => {
  console.error(err);
  process.exit(1);
});
