import { chromium } from 'playwright';
import path from 'path';

const OUT_DIR = '/Users/satyajishu/.gemini/antigravity-ide/brain/95817c17-2338-45dc-ab10-459f8abd00a7';

async function captureSections() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('Navigating to Home...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Trigger all scroll reveals
  await page.evaluate(async () => {
    const distance = 400;
    const delay = 50;
    while (document.scrollingElement.scrollTop + window.innerHeight < document.scrollingElement.scrollHeight) {
      document.scrollingElement.scrollBy(0, distance);
      await new Promise(r => setTimeout(r, delay));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);

  const sections = await page.$$('main section');
  console.log(`Found ${sections.length} sections on Home page.`);

  const names = [
    'sec1_hero',
    'sec2_ticker',
    'sec3_stats',
    'sec4_tools_grid',
    'sec5_interactive_demo',
    'sec6_architecture',
    'sec7_how_it_works',
    'sec8_comparison_table',
    'sec9_affiliate_highlight',
    'sec10_blog_highlight',
    'sec11_fallback_chain',
    'sec12_final_cta',
  ];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const name = names[i] || `sec${i + 1}_unknown`;
    const filePath = path.join(OUT_DIR, `home_${name}.png`);
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await section.screenshot({ path: filePath });
    console.log(`Captured ${name} -> ${filePath}`);
  }

  await browser.close();
  console.log('All sections captured successfully!');
}

captureSections().catch(err => {
  console.error('Error capturing sections:', err);
  process.exit(1);
});
