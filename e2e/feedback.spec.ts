import { test, expect } from '@playwright/test';

test.describe('feedback batch regressions', () => {
  test('minimap zoom transforms map art and markers together', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?mock');
    const canvas = page.getByTestId('minimap-canvas').first();
    await expect(canvas).toBeVisible();
    const before = await canvas.evaluate(el => getComputedStyle(el).transform);
    await page.getByRole('button', { name: 'Zoom in' }).first().click();
    const after = await canvas.evaluate(el => getComputedStyle(el).transform);
    expect(after).not.toBe(before);
    await expect(canvas.locator('img.ll-minimap__img')).toBeVisible();
    await expect(canvas.locator('svg.ll-minimap__svg')).toBeVisible();
    await page.getByRole('button', { name: 'Toggle stand positions' }).first().click();
    await expect(page.getByTestId('stand-marker')).toHaveCount(0);
    await page.getByRole('button', { name: 'Toggle stand positions' }).first().click();
    await expect(page.getByTestId('stand-marker').first()).toBeVisible();
  });

  test('short desktop window keeps the minimap reachable', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto('/?mock');
    const map = page.getByTestId('minimap').first();
    await map.scrollIntoViewIfNeeded();
    await expect(map).toBeVisible();
    const box = await map.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(280);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test('overlay numeric fields allow empty editing and clamp on blur', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?mock');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('tab', { name: 'Overlay' }).click();
    const width = page.getByLabel('Width', { exact: true });
    await width.focus(); await width.fill('');
    await expect(width).toHaveValue('');
    await width.fill('1200');
    await expect(width).toHaveValue('1200');
    await width.blur();
    await expect(width).toHaveValue('1200');
    await width.focus(); await width.fill(''); await width.blur();
    await expect(width).toHaveValue('200');
  });

  test('minimal overlay shows only the image with optional outline', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 320 });
    await page.goto('/?mock&overlayMode=view#overlay');
    await page.evaluate(() => localStorage.setItem('lineuplab.overlayView', JSON.stringify({ scale: 1, hideAnnotations: false, fade: true, minimal: true, outline: true })));
    await page.reload();
    const overlay = page.getByTestId('overlay-content');
    await expect(overlay).toHaveClass(/ll-ov--minimal/);
    await expect(overlay).toHaveClass(/has-outline/);
    await expect(overlay.locator('.ll-ov__head')).toHaveCount(0);
    await expect(overlay.locator('.ll-ov__minimal-img')).toBeVisible();
  });
});
