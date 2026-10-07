const { chromium } = require('@playwright/test');
const path = require('path');

const PAGES = [
  { name: 'home', url: 'http://localhost:5173/' },
  { name: 'humanizer', url: 'http://localhost:5173/humanizer' },
  { name: 'blog', url: 'http://localhost:5173/blog' },
  { name: 'affiliate', url: 'http://localhost:5173/affiliate' },
  { name: 'score', url: 'http://localhost:5173/score' },
];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();
  const consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[${page.url()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(`[PAGE ERROR] ${err.message}`);
  });

  for (const p of PAGES) {
    console.log(`Navigating to ${p.url}...`);
    await page.goto(p.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500); // Allow react state, word rotator, animations to stabilize

    const outPath = path.join(__dirname, `${p.name}_screen.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Saved screenshot: ${outPath}`);
  }

  // Mobile screenshot capture
  console.log('Capturing mobile view...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const mobilePath = path.join(__dirname, 'mobile_home.png');
  await page.screenshot({ path: mobilePath, fullPage: false });
  console.log(`Saved mobile screenshot: ${mobilePath}`);

  await browser.close();

  if (consoleErrors.length > 0) {
    console.log('CONSOLE ERRORS FOUND:');
    consoleErrors.forEach(err => console.log(err));
  } else {
    console.log('NO CONSOLE ERRORS FOUND ACROSS ALL 5 PAGES!');
  }
})();
