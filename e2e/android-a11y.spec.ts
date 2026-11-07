import { test } from '@playwright/test';
import { auditTargets } from './audit';

test('android controls meet 48px targets', async ({ page }) => {
  await page.goto('/?mock');
  await auditTargets(page, 48, 'browse');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await auditTargets(page, 48, 'filter drawer');
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Map view' }).click();
  await auditTargets(page, 48, 'map');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Sync' }).click();
  await auditTargets(page, 48, 'sync');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click();
  for (const tab of ['General', 'Sync', 'Data', 'Diagnostics', 'About']) {
    await page.getByRole('tab', { name: tab }).click();
    await auditTargets(page, 48, `settings ${tab}`);
  }
});
