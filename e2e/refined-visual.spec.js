import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'score', path: '/score' },
  { name: 'blog', path: '/blog' },
  { name: 'affiliate', path: '/affiliate' },
];

async function stabilizePage(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        caret-color: transparent !important;
        transition-duration: 0s !important;
        animation-duration: 0s !important;
      }
    `,
  });
  await page.waitForTimeout(300);
}

test.describe('Refined Visual Comparison - Static Pages', () => {
  for (const vp of VIEWPORTS) {
    for (const p of PAGES) {
      test(`compare ${p.name} - ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(p.path);
        await stabilizePage(page);

        await expect(page).toHaveScreenshot(`${p.name}-${vp.name}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.02,
          animations: 'disabled',
        });
      });
    }
  }
});

test.describe('Refined Visual Comparison - Humanizer States', () => {
  for (const vp of VIEWPORTS) {
    test(`compare humanizer-empty - ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/humanizer');
      await stabilizePage(page);
      await expect(page.locator('textarea#input-text')).toBeVisible();

      await expect(page).toHaveScreenshot(`humanizer-empty-${vp.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });

    test(`compare humanizer-populated - ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/humanizer');
      await stabilizePage(page);
      const textarea = page.locator('textarea#input-text');
      await expect(textarea).toBeVisible();

      await textarea.fill(
        'Artificial intelligence systems leverage deep neural networks to synthesize, transform, and evaluate unstructured natural language datasets with high semantic fidelity across corporate domains.'
      );
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot(`humanizer-populated-${vp.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });

    test(`compare humanizer-generating - ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      let releaseStream;
      const holdStream = new Promise((resolve) => { releaseStream = resolve; });

      await page.route('/api/generate', async (route) => {
        const req = route.request();
        const postData = req.postDataJSON() || {};

        if (postData.task === 'score') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ score: { aiScore: 4, humanScore: 96 } }),
          });
          return;
        }

        await holdStream;
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: 'data: {"text": "Done."}\n\ndata: [DONE]\n\n',
        });
      });

      await page.goto('/humanizer');
      await stabilizePage(page);

      const textarea = page.locator('textarea#input-text');
      await expect(textarea).toBeVisible();
      await textarea.fill(
        'Artificial intelligence systems leverage deep neural networks to synthesize natural language with high semantic fidelity across corporate domains.'
      );
      await page.waitForTimeout(400);

      const humanizeBtn = page.getByRole('button', { name: /Humanize/i }).filter({ hasText: 'Humanize' });
      await expect(humanizeBtn).toBeEnabled();
      await humanizeBtn.click();

      await expect(page.getByRole('button', { name: /Humanizing/i })).toBeVisible({ timeout: 5000 });
      await stabilizePage(page);

      await expect(page).toHaveScreenshot(`humanizer-generating-${vp.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });

      releaseStream();
      await page.waitForTimeout(300);
    });

    test(`compare humanizer-completed - ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await page.route('/api/generate', async (route) => {
        const req = route.request();
        const postData = req.postDataJSON() || {};

        if (postData.task === 'score') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              score: {
                aiScore: 4,
                humanScore: 96,
                breakdown: {
                  burstiness: 19,
                  perplexity: 19,
                  predictability: 19,
                  repetition: 20,
                  formality: 19,
                },
              },
            }),
          });
          return;
        }

        const scorePayload = {
          aiScore: 4,
          humanScore: 96,
          breakdown: {
            burstiness: 19,
            perplexity: 19,
            predictability: 19,
            repetition: 20,
            formality: 19,
          },
        };
        const sseBody =
          `data: ${JSON.stringify({ inputScore: 96, inputScores: scorePayload })}\n\n` +
          'data: {"text": "When we analyze deep learning systems, the real breakthrough isn\'t raw scale—it\'s how naturally language now flows."}\n\n' +
          `data: ${JSON.stringify({ outputScore: 96, outputScores: scorePayload })}\n\n` +
          'data: [DONE]\n\n';
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: sseBody,
        });
      });

      await page.goto('/humanizer');
      await stabilizePage(page);

      const textarea = page.locator('textarea#input-text');
      await expect(textarea).toBeVisible();
      await textarea.fill(
        'Artificial intelligence systems leverage deep neural networks to synthesize natural language with high semantic fidelity across corporate domains.'
      );
      await page.waitForTimeout(400);

      const humanizeBtn = page.getByRole('button', { name: /Humanize/i }).filter({ hasText: 'Humanize' });
      await expect(humanizeBtn).toBeEnabled();
      await humanizeBtn.click();

      await expect(page.locator('text=When we analyze deep learning systems')).toBeVisible({ timeout: 10000 });
      await stabilizePage(page);

      await expect(page).toHaveScreenshot(`humanizer-completed-${vp.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });
  }
});
