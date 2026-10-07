import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const sections = await page.$$('section');
  console.log(`Found ${sections.length} sections in new home page`);

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    await sec.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const filename = `scripts/new_home_sec_${i + 1}.png`;
    await sec.screenshot({ path: filename });
    console.log(`Captured ${filename}`);
  }

  // Full page screenshot
  await page.screenshot({ path: 'scripts/new_home_full.png', fullPage: true });
  console.log('Captured full page: scripts/new_home_full.png');

  await browser.close();
})();
