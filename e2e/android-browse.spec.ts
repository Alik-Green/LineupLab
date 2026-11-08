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
    await page.getByRole('button', { name: 'Choose agent' }).click();
    const agentDialog = page.getByRole('dialog', { name: 'Choose agent' });
    await expect(agentDialog).toBeVisible();
    await agentDialog.getByRole('option', { name: /Sova/ }).click();
    await expect(page.getByRole('button', { name: 'Choose agent' })).toContainText('Sova');
    await page.getByRole('button', { name: 'Choose ability' }).click();
    const abilityDialog = page.getByRole('dialog', { name: 'Choose ability' });
    await abilityDialog.getByRole('option', { name: /Recon Bolt/ }).click();
    await page.getByRole('button', { name: /^Filters/ }).click();
    const drawer = page.getByRole('dialog', { name: 'Filters' });
    await expect(drawer).toBeVisible();
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
    await nav.getByRole('button', { name: 'Download' }).click();
    await expect(page.getByTestId('sync-settings')).toBeVisible();
    await page.getByRole('button', { name: 'Find desktop' }).click();
    await page.locator('.ll-discovered button').first().click();
    await page.getByRole('button', { name: 'Connect & download' }).click();
    await expect(page.getByTestId('sync-settings').getByText(/12 already on this device/)).toBeVisible();
    while (await page.locator('.ll-toast button[aria-label="Dismiss"]').count()) await page.locator('.ll-toast button[aria-label="Dismiss"]').first().click();
    await page.screenshot({ path: 'docs/screenshots/74-android-download.png' });
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

test('empty map no-match action recovers instead of opening a grey screen', async ({ page }) => {
  await page.goto('/?mock&empty');
  await expect(page.getByTestId('browse')).toBeVisible();
  await page.getByRole('button', { name: 'Map view' }).click();
  await expect(page.getByText('No lineups match')).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.getByTestId('browse')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Download' })).toBeVisible();
  await expect(page.getByTestId('lineup-grid')).toBeVisible();
});

test('empty phone downloads, persists and refreshes Browse after relaunch', async ({ page }) => {
  await page.goto('/?mock&empty'); await page.getByRole('button', { name: 'Download' }).click();
  await expect(page.getByLabel('Access code')).toHaveCount(0);
  await page.getByRole('button', { name: 'Find desktop' }).click();
  await page.locator('.ll-discovered button').first().click();
  await page.getByRole('button', { name: 'Connect & download' }).click();
  await expect(page.getByText(/Saved 12 new lineups/)).toBeVisible();
  await page.getByRole('button', { name: 'Browse' }).click();
  await expect(page.getByRole('button', { name: /Open Mid Bend/ }).first()).toBeVisible();
  await page.reload(); await expect(page.getByRole('button', { name: /Open Mid Bend/ }).first()).toBeVisible();
});

test('stopped desktop sharing is not shown as live', async ({ page }) => {
  await page.goto('/?mock&offline'); await page.getByRole('button', { name: 'Download' }).click();
  await page.getByRole('button', { name: 'Find desktop' }).click();
  await expect(page.getByText('No desktop is sharing right now. Start sharing on the desktop and try again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect & download' })).toBeDisabled();
  await expect(page.locator('.ll-discovered button')).toHaveCount(0);
});

test('Android data settings tables stay inside a 360px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/?mock');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Data' }).click();
  await expect(page.getByText('Cache by asset type')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(361);
});

test('download finishes and Browse stays usable when the native catalog is offline', async ({ page }) => {
  await page.goto('/?mock&platform=android&empty&catalog-error');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Download' }).click();
  await expect(page.getByLabel('Access code')).toHaveCount(0);
  await page.getByRole('button', { name: 'Find desktop' }).click();
  await page.locator('.ll-discovered button').first().click();
  await page.getByRole('button', { name: 'Connect & download' }).click();
  await expect(page.getByText(/Saved 12 new lineups and \d+ new images/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect & download' })).toBeEnabled();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Browse' }).click();
  await expect(page.getByTestId('lineup-card').first()).toBeVisible();
  expect(await page.getByTestId('lineup-card').count()).toBeGreaterThan(0);
});
