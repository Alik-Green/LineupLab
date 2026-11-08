import { test, expect } from '@playwright/test';

test('minimap gestures, resize, cancel and unmount never crash or select text', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?mock');
  const map = page.getByTestId('minimap').first(); const stage = page.getByTestId('minimap-stage').first();
  await expect(map).toBeVisible();
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .3, { steps: 8 });
  await page.dispatchEvent('[data-testid="minimap-stage"]', 'pointercancel', { pointerId: 1 });
  await page.mouse.up();
  await page.mouse.click(box.x + 10, box.y + 10);
  await page.getByRole('button', { name: 'Zoom in' }).first().click();
  await page.setViewportSize({ width: 900, height: 620 }); await page.waitForTimeout(150);
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(150);
  await expect(map).toBeVisible();
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
  await expect(stage).toHaveCSS('user-select', 'none');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByTestId('minimap')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('minimap callout names toggle and settings stay reachable in a short window', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 }); await page.goto('/?mock');
  await page.getByRole('button', { name: 'Toggle callout names' }).first().click();
  await expect(page.getByTestId('map-callouts')).toBeVisible();
  await page.getByLabel('Map display settings').first().click();
  await expect(page.getByRole('button', { name: 'Toggle stand positions' })).toBeVisible();
  const panel = await page.locator('.ll-minimap__settings-panel').first().boundingBox();
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(600);
});
