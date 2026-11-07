import { test, expect } from '@playwright/test';
import fs from 'node:fs';
fs.mkdirSync('docs/screenshots', { recursive: true });

test('first-run download progress is visible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop first-run screen');
  await page.goto('/?mock&slow-assets');
  await expect(page.getByTestId('first-run-progress')).toBeVisible();
  await expect(page.getByText(/Downloading game data 34\/120/)).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/01-first-run-progress.png' });
});

test('catalog images render and diagnostics self-test passes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop diagnostics');
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?mock');
  await expect(page.getByTestId('browse')).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Data' }).click();
  await expect(page.getByTestId('data-settings')).toBeVisible();
  await page.getByRole('tab', { name: 'Diagnostics' }).click();
  await expect(page.getByTestId('asset-diagnostics')).toBeVisible();
  await page.getByRole('button', { name: 'Run image self-test' }).click();
  await expect(page.getByText(/All \d+ catalog images rendered successfully/)).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('asset-diagnostics')).toContainText('No image errors recorded');
  await page.screenshot({ path: 'docs/screenshots/02-data-diagnostics.png' });
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Browse' }).click();
  await page.waitForTimeout(1200);
  const broken = await page.locator('[data-image-state="error"]').count();
  expect(broken).toBe(0);
  const imgErrors = await page.evaluate(() => Array.from(document.images).filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src));
  expect(imgErrors).toEqual([]);
  await page.screenshot({ path: 'docs/screenshots/03-browse-images.png' });
  expect(errors.filter(e => /CSP|asset|image/i.test(e))).toEqual([]);
});
