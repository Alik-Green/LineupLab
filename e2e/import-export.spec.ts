import { test, expect } from '@playwright/test';

test.describe('desktop import/export', () => {
  test('preview table, policy, import, undo and export', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?mock');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Import / Export' }).click();
    await expect(page.getByTestId('import-export')).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/50-import-export.png' });
    await page.locator('input[type="file"]').setInputFiles({ name: 'legacy-pack.zip', mimeType: 'application/zip', buffer: Buffer.from([80, 75, 3, 4]) });
    await expect(page.locator('.ll-import-table tbody tr')).toHaveCount(4);
    await expect(page.locator('.ll-import-table')).toContainText('Missing landing image');
    await page.getByRole('checkbox', { name: 'Select all entries' }).check();
    await page.getByRole('button', { name: 'Import as copy' }).click();
    await page.screenshot({ path: 'docs/screenshots/51-import-preview.png' });
    await page.getByRole('button', { name: /^Import \d+/ }).click();
    await expect(page.getByText('Import finished')).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/52-import-report.png' });
    await page.getByRole('button', { name: 'Undo batch' }).click();
    await expect(page.getByText('Import undone.')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export all' }).click();
    const d = await download;
    expect(d.suggestedFilename()).toBe('lineuplab-all.zip');
  });
});

  test('slow legacy import exposes staged progress and persistent errors', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?mock&slow-import');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Import / Export' }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: 'old-pack.zip', mimeType: 'application/zip', buffer: Buffer.from([80, 75, 3, 4]) });
    await expect(page.getByTestId('import-progress')).toBeVisible();
    await expect(page.getByTestId('import-progress')).toContainText(/Reading media|Validating/);
    await page.screenshot({ path: 'docs/screenshots/53-import-progress.png' });
    await expect(page.locator('.ll-import-table tbody tr')).toHaveCount(4);
    await page.getByRole('checkbox', { name: 'Select all entries' }).check();
    await page.getByRole('button', { name: 'Import as copy' }).click();
    await page.getByRole('button', { name: /^Import \d+/ }).click();
    await expect(page.getByTestId('import-progress')).toContainText(/Copying pack media|Writing lineups/);
    await expect(page.getByText('Import finished')).toBeVisible();
    await page.goto('/?mock&import-error');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Import / Export' }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: 'broken-pack.zip', mimeType: 'application/zip', buffer: Buffer.from([80, 75, 3, 4]) });
    await expect(page.getByRole('alert')).toContainText('Import failed');
    await expect(page.getByRole('alert')).toContainText('manifest.json');
    await page.screenshot({ path: 'docs/screenshots/54-import-error.png' });
  });
