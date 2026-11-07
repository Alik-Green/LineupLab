import { test, expect } from '@playwright/test';

test.describe('android companion', () => {
  test('browse list, filter drawer, detail, map, sync and settings', async ({ page }) => {
    await page.goto('/?mock');
    await expect(page.getByTestId('browse')).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('button', { name: 'Browse' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Create' })).toHaveCount(0);
    await expect(page.locator('.ll-lineup-card__annot img').first()).toHaveJSProperty('complete', true);
    await page.waitForTimeout(250);
    await page.screenshot({ path: 'docs/screenshots/70-android-browse.png' });
    await page.getByRole('button', { name: /^Filters/ }).click();
    const drawer = page.getByRole('dialog', { name: 'Filters' });
    await expect(drawer).toBeVisible();
    await drawer.getByLabel('Agent').selectOption({ label: 'Sova' });
    await drawer.getByLabel('Ability').selectOption({ label: 'Recon Bolt' });
    await drawer.getByRole('button', { name: 'Attack', exact: true }).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: 'docs/screenshots/71-android-filters.png' });
    await drawer.getByRole('button', { name: /Show \d+ lineups/ }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.getByTestId('lineup-card').first()).toBeVisible();
    await page.getByTestId('lineup-card').first().getByRole('button', { name: /^Open / }).click();
    await expect(page.getByTestId('lineup-detail')).toBeVisible();
    await page.waitForTimeout(250);
    await page.screenshot({ path: 'docs/screenshots/72-android-detail.png' });
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Map view' }).click();
    await expect(page.getByTestId('minimap')).toBeVisible();
    await expect(page.locator('.ll-mbrowse__map img.ll-minimap__img').first()).toHaveJSProperty('complete', true);
    await page.screenshot({ path: 'docs/screenshots/73-android-map.png' });
    await page.locator('.ll-minimap__marker').first().locator('image').first().click();
    await expect(page.getByTestId('lineup-detail')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await nav.getByRole('button', { name: 'Sync' }).click();
    await expect(page.getByTestId('sync-settings')).toBeVisible();
    await page.getByRole('button', { name: 'Discover (mDNS)' }).click();
    await page.locator('.ll-discovered button').first().click();
    await page.getByLabel('Pairing code').fill('482913');
    await page.getByRole('button', { name: 'Pair', exact: true }).click();
    await expect(page.getByTestId('sync-settings').getByText('Paired with Desktop library.')).toBeVisible();
    await page.getByRole('button', { name: 'Sync now' }).click();
    await expect(page.getByTestId('sync-settings').getByText(/Synced: 0 pushed, 12 pulled/)).toBeVisible();
    while (await page.locator('.ll-toast button[aria-label="Dismiss"]').count()) await page.locator('.ll-toast button[aria-label="Dismiss"]').first().click();
    await page.screenshot({ path: 'docs/screenshots/74-android-sync.png' });
    await nav.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByTestId('settings')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Hotkeys' })).toHaveCount(0);
    await page.screenshot({ path: 'docs/screenshots/75-android-settings.png' });
    await page.getByRole('tab', { name: 'Data' }).click();
    await expect(page.getByTestId('data-settings')).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/76-android-data.png' });
    await page.getByRole('tab', { name: 'Diagnostics' }).click();
    await page.getByRole('button', { name: 'Run image self-test' }).click();
    await expect(page.getByText(/All \d+ catalog images rendered successfully/)).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: 'docs/screenshots/77-android-diagnostics.png' });
    await page.getByRole('tab', { name: 'About' }).click();
    await page.screenshot({ path: 'docs/screenshots/78-android-about.png' });
  });

  test('no horizontal overflow at 390 and 360', async ({ page }) => {
    await page.goto('/?mock');
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.getByTestId('browse')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });
});
