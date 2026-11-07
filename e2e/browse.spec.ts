import { test, expect } from '@playwright/test';
test.describe('desktop browse', () => {
  test('populated, filtered, selection and drawer', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?mock');
    await expect(page.getByTestId('lineup-card').first()).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'docs/screenshots/10-browse-populated.png' });
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByRole('button', { name: 'Attack', exact: true }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'docs/screenshots/11-browse-filtered.png' });
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByTestId('lineup-card').first().getByRole('button', { name: /Open/ }).click();
    await expect(page.getByTestId('lineup-detail')).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/screenshots/12-browse-detail.png' });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('lineup-detail')).not.toBeVisible();
  });
  test('empty state', async ({ page }) => {
    await page.goto('/?mock&empty');
    await expect(page.getByText('No lineups found')).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/13-browse-empty.png' });
  });
  test('no horizontal overflow at 1100 and 1920', async ({ page }) => {
    for (const width of [1100, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/?mock');
      await expect(page.getByTestId('lineup-card').first()).toBeVisible();
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });
});
