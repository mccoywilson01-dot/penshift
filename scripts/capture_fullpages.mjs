import { chromium } from 'playwright';

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 80);
    });
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const pages = [
    { url: 'http://localhost:5173/', name: 'full_home.png' },
    { url: 'http://localhost:5173/humanizer', name: 'full_humanizer.png' },
    { url: 'http://localhost:5173/blog', name: 'full_blog.png' },
    { url: 'http://localhost:5173/affiliate', name: 'full_affiliate.png' },
    { url: 'http://localhost:5173/score', name: 'full_score.png' }
  ];

  for (const pageInfo of pages) {
    console.log(`Capturing full page with scroll: ${pageInfo.name}...`);
    const page = await context.newPage();
    await page.goto(pageInfo.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await autoScroll(page);
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `/Users/satyajishu/.gemini/antigravity-ide/brain/95817c17-2338-45dc-ab10-459f8abd00a7/${pageInfo.name}`,
      fullPage: true,
    });
    await page.close();
  }

  await browser.close();
  console.log('All full pages captured with scroll!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
