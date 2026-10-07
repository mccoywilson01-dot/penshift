import { chromium } from 'playwright';

async function diagnose() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('--- Diagnosing /affiliate ---');
  await page.goto('http://localhost:5173/affiliate', { waitUntil: 'networkidle' });
  const affLayout = await page.evaluate(() => {
    const grid = document.querySelector('.grid.grid-cols-1.xl\\:grid-cols-3') || document.querySelector('.max-w-7xl .grid');
    const form = grid?.children[0];
    const out = grid?.children[1];
    return {
      gridClass: grid?.className,
      gridRect: grid?.getBoundingClientRect(),
      formRect: form?.getBoundingClientRect(),
      outRect: out?.getBoundingClientRect(),
      windowWidth: window.innerWidth,
    };
  });
  console.log('Affiliate layout:', JSON.stringify(affLayout, null, 2));

  console.log('--- Diagnosing /blog ---');
  await page.goto('http://localhost:5173/blog', { waitUntil: 'networkidle' });
  const blogLayout = await page.evaluate(() => {
    const grid = document.querySelector('.max-w-7xl .grid') || document.querySelector('.max-w-6xl.mx-auto.items-start');
    const form = grid?.children[0];
    const out = grid?.children[1];
    return {
      gridClass: grid?.className,
      gridRect: grid?.getBoundingClientRect(),
      formRect: form?.getBoundingClientRect(),
      outRect: out?.getBoundingClientRect(),
    };
  });
  console.log('Blog layout:', JSON.stringify(blogLayout, null, 2));

  await browser.close();
}

diagnose().catch(console.error);
