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
}

test.describe('Visual Regression - Static Pages', () => {
  for (const vp of VIEWPORTS) {
    for (const p of PAGES) {
      test(`${p.name} - ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(p.path);
        await stabilizePage(page);

        await expect(page).toHaveScreenshot(`${p.name}-${vp.name}.png`, {
          maxDiffPixelRatio: 0.02,
          animations: 'disabled',
          mask: [page.locator('.animate-pulse'), page.locator('.spin')],
        });
      });
    }
  }
});

test.describe('Visual Regression - Humanizer States', () => {
  for (const vp of VIEWPORTS) {
    test(`humanizer-empty - ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/humanizer');
      await stabilizePage(page);
      await expect(page.locator('textarea#input-text')).toBeVisible();

      await expect(page).toHaveScreenshot(`humanizer-empty-${vp.name}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
        mask: [page.locator('.animate-pulse'), page.locator('.spin')],
      });
    });

    test(`humanizer-populated - ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/humanizer');
      await stabilizePage(page);
      const textarea = page.locator('textarea#input-text');
      await expect(textarea).toBeVisible();

      await textarea.fill(
        'Artificial intelligence systems leverage deep neural networks to synthesize, transform, and evaluate unstructured natural language datasets with high semantic fidelity across corporate domains.'
      );
      // Wait for debounce update
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot(`humanizer-populated-${vp.name}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
        mask: [page.locator('.animate-pulse'), page.locator('.spin')],
      });
    });

    test(`humanizer-generating - ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      let releaseStream;
      const holdStream = new Promise((resolve) => { releaseStream = resolve; });

      // Mock generate API to keep it in active generating state
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

        // Hold the response so it stays in generating/humanizing state while screenshot is captured
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

      // Wait for the active generating / loading UI to appear
      await expect(page.getByRole('button', { name: /Humanizing/i })).toBeVisible({ timeout: 5000 });
      await stabilizePage(page);

      await expect(page).toHaveScreenshot(`humanizer-generating-${vp.name}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
        mask: [page.locator('.animate-pulse'), page.locator('.spin')],
      });

      // Release the stream to clean up the request
      releaseStream();
      await page.waitForTimeout(300);
    });

    test(`humanizer-completed - ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/humanizer');
      await stabilizePage(page);

      // Mock generate API for deterministic output and scoring
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

      const textarea = page.locator('textarea#input-text');
      await expect(textarea).toBeVisible();
      await textarea.fill(
        'Artificial intelligence systems leverage deep neural networks to synthesize natural language with high semantic fidelity across corporate domains.'
      );
      await page.waitForTimeout(400);

      const humanizeBtn = page.getByRole('button', { name: /Humanize/i }).filter({ hasText: 'Humanize' });
      await expect(humanizeBtn).toBeEnabled();
      await humanizeBtn.click();

      // Wait for output box to render
      await expect(page.locator('text=When we analyze deep learning systems')).toBeVisible({ timeout: 10000 });
      await stabilizePage(page);

      await expect(page).toHaveScreenshot(`humanizer-completed-${vp.name}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
        mask: [page.locator('.animate-pulse'), page.locator('.spin')],
      });
    });
  }
});
