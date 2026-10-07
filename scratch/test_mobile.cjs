const { chromium } = require('playwright-core');

async function testMobile() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });

  const page = await context.newPage();
  
  const pages = [
    { url: 'http://localhost:5173/', name: 'scratch/mobile_home.png' },
    { url: 'http://localhost:5173/humanizer', name: 'scratch/mobile_humanizer.png' },
    { url: 'http://localhost:5173/blog', name: 'scratch/mobile_blog.png' },
    { url: 'http://localhost:5173/affiliate', name: 'scratch/mobile_affiliate.png' },
    { url: 'http://localhost:5173/score', name: 'scratch/mobile_score.png' },
  ];

  for (const p of pages) {
    await page.goto(p.url, { waitUntil: 'networkidle' });
    await page.screenshot({ path: p.name, fullPage: false });
    console.log(`Captured ${p.name}`);
  }

  // Also test opening the mobile navigation
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  const menuButton = await page.$('button[aria-label="Toggle menu"]');
  if (menuButton) {
    await menuButton.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'scratch/mobile_nav_open.png', fullPage: false });
    console.log('Captured scratch/mobile_nav_open.png');
  }

  await browser.close();
}

testMobile().catch(err => {
  console.error(err);
  process.exit(1);
});
