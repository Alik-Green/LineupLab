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

  test('map/agent/ability triggers show the current value and open full pickers', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?mock');
    await page.getByRole('button', { name: 'Choose map' }).click();
    const mapDialog = page.getByRole('dialog', { name: 'Choose map' });
    await expect(mapDialog).toBeVisible();
    await mapDialog.getByLabel('Search map').fill('Bind');
    await mapDialog.getByRole('option', { name: /Bind/ }).click();
    await expect(page.getByRole('button', { name: 'Choose map' })).toContainText('Bind');
    await page.getByRole('button', { name: 'Choose agent' }).click();
    const agentDialog = page.getByRole('dialog', { name: 'Choose agent' });
    await expect(agentDialog.getByRole('option').nth(1)).toBeVisible();
    await agentDialog.getByLabel('Search agent').fill('Jett');
    await page.screenshot({ path: 'docs/screenshots/14-browse-agent-picker.png' });
    await agentDialog.getByRole('option', { name: /Jett/ }).click();
    await expect(page.getByRole('button', { name: 'Choose agent' })).toContainText('Jett');
    await page.getByRole('button', { name: 'Choose ability' }).click();
    const abilityDialog = page.getByRole('dialog', { name: 'Choose ability' });
    await expect(abilityDialog).toBeVisible();
    await abilityDialog.getByRole('option').nth(1).click();
    await expect(page.getByRole('button', { name: 'Choose ability' })).not.toContainText('All abilities');
  });
