import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Preview 7 desktop regressions');
  await page.goto('/?mock');
});

test('minimap wheel zoom anchors on the cursor and pan reaches opposite edges', async ({ page }) => {
  const stage = page.getByTestId('minimap-stage').first();
  const canvas = page.getByTestId('minimap-canvas').first();
  await expect(canvas.locator('img.ll-minimap__img')).toBeVisible();
  const sb = (await stage.boundingBox())!;
  const cx = sb.x + sb.width * 0.5, cy = sb.y + sb.height * 0.5;
  const before = (await canvas.boundingBox())!;
  const ux = (cx - before.x) / before.width, uy = (cy - before.y) / before.height;
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -240);
  await expect(page.getByTestId('minimap').first()).not.toHaveAttribute('data-scale', '1.000');
  const after = (await canvas.boundingBox())!;
  expect(Math.abs((cx - after.x) / after.width - ux)).toBeLessThan(0.01);
  expect(Math.abs((cy - after.y) / after.height - uy)).toBeLessThan(0.01);
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom in' }).first().click();
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx - 1200, cy - 1200, { steps: 8 }); await page.mouse.up();
  const left = (await canvas.boundingBox())!;
  expect(left.x).toBeLessThanOrEqual(sb.x + 1);
  expect(left.y).toBeLessThanOrEqual(sb.y + 1);
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx + 1200, cy + 1200, { steps: 8 }); await page.mouse.up();
  const right = (await canvas.boundingBox())!;
  expect(right.x + right.width).toBeGreaterThanOrEqual(sb.x + sb.width - 1);
  expect(right.y + right.height).toBeGreaterThanOrEqual(sb.y + sb.height - 1);
});

test('square picker label and gradient are flush with the bottom edge', async ({ page }) => {
  const picker = page.locator('.ll-browse__pickers .ll-browse-picker--square').first();
  const trigger = picker.locator('.ll-browse-picker__trigger');
  const text = picker.locator('.ll-browse-picker__text');
  const thumb = picker.locator('.ll-browse-picker__thumb');
  const tb = (await trigger.boundingBox())!, xb = (await text.boundingBox())!, ib = (await thumb.boundingBox())!;
  expect(Math.abs(xb.y + xb.height - (tb.y + tb.height))).toBeLessThanOrEqual(2);
  expect(Math.abs(xb.width - tb.width)).toBeLessThanOrEqual(2);
  expect(ib.width / tb.width).toBeGreaterThan(0.98);
  expect(ib.height / tb.height).toBeGreaterThan(0.98);
  expect(await text.evaluate(el => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
});

test('annotation clicks land on the visible image at the rendered aspect ratio', async ({ page }) => {
  await page.getByTestId('lineup-card').first().getByRole('button', { name: 'Edit lineup' }).click();
  await page.getByTestId('slot-aim1').click();
  await page.getByRole('button', { name: 'Annotate', exact: true }).click();
  const layer = page.getByTestId('annotation-layer');
  await expect(layer).toBeVisible();
  const box = (await layer.boundingBox())!;
  const ratio = await layer.evaluate(el => { const vb = (el as SVGElement).viewBox.baseVal; return vb.width / vb.height; });
  expect(Math.abs(box.width / box.height - ratio)).toBeLessThan(0.01);
  await page.getByRole('toolbar', { name: 'Annotation tools' }).getByRole('button', { name: 'Circle', exact: true }).click();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const vb = await layer.evaluate(el => { const v = (el as SVGElement).viewBox.baseVal; return { w: v.width, h: v.height }; });
  const centers = await layer.locator('circle').evaluateAll(els => els.map(el => ({ cx: Number(el.getAttribute('cx')), cy: Number(el.getAttribute('cy')) })));
  expect(centers.some(c => Math.abs(c.cx - vb.w / 2) < 1 && Math.abs(c.cy - vb.h / 2) < 1)).toBe(true);
});

test('annotate workspace is usable at 720x450 and fills a 2560x1440 window', async ({ page }) => {
  await page.getByTestId('lineup-card').first().getByRole('button', { name: 'Edit lineup' }).click();
  await page.getByTestId('slot-aim1').click();
  await page.getByRole('button', { name: 'Annotate', exact: true }).click();
  for (const size of [{ width: 720, height: 450 }, { width: 2560, height: 1440 }]) {
    await page.setViewportSize(size);
    const editor = page.getByTestId('annotation-editor');
    await expect(editor).toBeVisible();
    await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Annotation tools' })).toBeVisible();
    await expect(page.getByLabel('Tool properties')).toBeVisible();
    const eb = (await editor.boundingBox())!;
    expect(eb.x).toBeGreaterThanOrEqual(0);
    expect(eb.y + eb.height).toBeLessThanOrEqual(size.height + 1);
    expect(eb.width).toBeGreaterThan(size.width * 0.95);
    const cb = (await page.getByTestId('annotation-layer').boundingBox())!;
    expect(cb.width).toBeGreaterThan(200); expect(cb.height).toBeGreaterThan(120);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  }
});

test('Browse and Create fill large screens without a centered page cap', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  const browse = (await page.getByTestId('browse').boundingBox())!;
  expect(browse.x).toBeLessThanOrEqual(32);
  expect(browse.width).toBeGreaterThan(2490);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Create' }).click();
  const setup = (await page.getByTestId('wizard-setup').boundingBox())!;
  expect(setup.width).toBeGreaterThan(2200);
});

test('capture settings survive rapid edits and overlay click-through defaults on', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Overlay' }).click();
  await expect(page.getByRole('switch', { name: 'Click-through' })).toBeChecked();
  await page.getByRole('tab', { name: 'Capture' }).click();
  await page.getByLabel('Max width (px)').fill('1200');
  await page.getByLabel('Target time (ms)').fill('200');
  await page.getByRole('switch', { name: 'WebP (otherwise JPEG)' }).uncheck();
  await page.reload();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Capture' }).click();
  await expect(page.getByLabel('Max width (px)')).toHaveValue('1200');
  await expect(page.getByLabel('Target time (ms)')).toHaveValue('200');
  await expect(page.getByRole('switch', { name: 'WebP (otherwise JPEG)' })).not.toBeChecked();
});
