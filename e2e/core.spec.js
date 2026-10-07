import { test, expect } from '@playwright/test';

test('has title and can render humanizer', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/PenShift/i);
  
  // Click on Humanizer link in nav (assuming there is one)
  const humanizerLink = page.locator('a[href="/humanizer"]').first();
  await humanizerLink.click();
  
  await expect(page.locator('h1').first()).toContainText(/Humanizer/i);
});

test('can type in the input and click humanize', async ({ page }) => {
  await page.goto('/humanizer');
  
  // Wait for the textarea
  const textarea = page.locator('textarea#input-text');
  await expect(textarea).toBeVisible();
  
  // Type a sample text
  const sampleText = "The utilization of advanced artificial intelligence algorithms facilitates the profound augmentation of textual assets.";
  await textarea.fill(sampleText);
  
  // Wait for the button to become enabled
  const humanizeBtn = page.getByRole('button', { name: /Humanize/i }).filter({ hasText: 'Humanize' });
  await expect(humanizeBtn).toBeEnabled();

  // Mock the API response to avoid hitting real endpoints in E2E
  await page.route('/api/generate', async route => {
    // Write SSE mock data
    const mockStream = 'data: {"text": "This is a mocked humanized response. "}\n\ndata: {"text": "It works perfectly."}\n\ndata: [DONE]\n\n';
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: mockStream
    });
  });

  // Click and verify the output appears
  await humanizeBtn.click();
  
  // The output text area should eventually contain our mock text
  await expect(page.locator('text="This is a mocked humanized response. It works perfectly."')).toBeVisible({ timeout: 10000 });
});
