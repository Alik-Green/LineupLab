import { test } from '@playwright/test';
import { auditTargets } from './audit';

test('desktop controls meet 40px targets across screens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?mock');
  await auditTargets(page, 40, 'browse');
  await page.getByRole('button', { name: 'Choose agent' }).click();
  await auditTargets(page, 40, 'agent picker');
  await page.getByRole('dialog', { name: 'Choose agent' }).getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: /^Filters/ }).click();
  await auditTargets(page, 40, 'browse filters');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Create' }).click();
  await auditTargets(page, 40, 'create setup');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Import / Export' }).click();
  await auditTargets(page, 40, 'import/export');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click();
  for (const tab of ['General', 'Hotkeys', 'Overlay', 'Capture', 'Sync', 'Data', 'Diagnostics', 'About']) {
    await page.getByRole('tab', { name: tab }).click();
    await auditTargets(page, 40, `settings ${tab}`);
  }
  await page.goto('/?mock#overlay');
  await page.reload();
  await auditTargets(page, 40, 'overlay create');
  await page.getByRole('button', { name: 'Switch to view mode' }).click();
  await auditTargets(page, 40, 'overlay view');
});
