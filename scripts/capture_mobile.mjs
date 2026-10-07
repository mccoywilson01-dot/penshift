import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  const pages = [
    { url: 'http://localhost:5173/', name: 'mobile_home.png' },
    { url: 'http://localhost:5173/humanizer', name: 'mobile_humanizer.png' },
    { url: 'http://localhost:5173/blog', name: 'mobile_blog.png' },
    { url: 'http://localhost:5173/affiliate', name: 'mobile_affiliate.png' },
    { url: 'http://localhost:5173/score', name: 'mobile_score.png' },
  ];

  for (const pageInfo of pages) {
    const page = await context.newPage();
    await page.goto(pageInfo.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `/Users/satyajishu/.gemini/antigravity-ide/brain/95817c17-2338-45dc-ab10-459f8abd00a7/${pageInfo.name}`,
    });
    await page.close();
  }

  await browser.close();
  console.log('Mobile screenshots captured!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
