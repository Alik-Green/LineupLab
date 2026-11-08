import { test, expect } from '@playwright/test';

test('mobile map markers open the full-screen viewer without blanking', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?mock');
  await page.getByRole('button', { name: 'Map view' }).click();
  const map = page.getByTestId('minimap');
  await expect(map).toBeVisible();
  const c = page.getByTestId('minimap').first().getByRole('button', { name: /Open Mid Bend/ }).getByTestId('stand-marker').locator('circle').first(); const cb = await c.boundingBox(); await page.touchscreen.tap(cb!.x + cb!.width / 2, cb!.y + cb!.height / 2);
  await expect(page.getByTestId('lineup-popup')).toBeVisible();
  await expect(page.getByTestId('lineup-transform')).toBeVisible();
  const box = await page.getByTestId('lineup-popup').boundingBox();
  expect(box!.width).toBeGreaterThan(350); expect(box!.height).toBeGreaterThan(780);
  await page.getByTestId('lineup-popup').getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.getByTestId('zoom-level')).not.toHaveText('100%');
  await page.getByTestId('lineup-popup').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('browse')).toBeVisible();
  await page.getByTestId('minimap').first().getByRole('button', { name: /Open Mid Bend/ }).getByTestId('stand-marker').locator('circle').first().click();
  await expect(page.getByTestId('lineup-popup')).toBeVisible();
  await page.getByTestId('lineup-popup').getByRole('button', { name: 'Close' }).click();
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'docs/screenshots/79-android-preview5-map.png' });
});

test('mobile malformed legacy lineup recovers and pickers remain three squares', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?mock&malformed');
  const pickers = page.locator('.ll-mbrowse__pickers .ll-browse-picker--square');
  const boxes = await Promise.all([0, 1, 2].map(i => pickers.nth(i).boundingBox()));
  expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThan(2);
  expect(Math.abs(boxes[1]!.y - boxes[2]!.y)).toBeLessThan(2);
  await page.getByRole('button', { name: 'Map view' }).click();
  await page.getByTestId('minimap').first().getByRole('button', { name: /Open Mid Bend/ }).getByTestId('stand-marker').locator('circle').first().click();
  await expect(page.getByTestId('lineup-detail')).toBeVisible();
  await expect(page.getByTestId('render-error')).toHaveCount(0);
  await page.getByTestId('lineup-popup').getByRole('button', { name: 'Close' }).click();
  expect(errors).toEqual([]);
});
