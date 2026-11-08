import { test, expect, type Page } from '@playwright/test';

async function noErrors(page: Page) { const errors: string[] = []; page.on('pageerror', e => errors.push(String(e))); return errors; }

test.describe('Preview 5 minimap and viewer', () => {
  test('populated minimap clicks open a full-screen viewer with content on desktop', async ({ page }) => {
    const errors = await noErrors(page);
    await page.goto('/?mock');
    const map = page.getByTestId('minimap').first();
    await expect(map).toBeVisible();
    const paths = page.getByTestId('throw-path');
    expect(await paths.count()).toBeGreaterThan(1);
    await page.getByRole('button', { name: 'Toggle throw lines' }).first().click();
    await expect(paths).toHaveCount(0);
    await page.getByRole('button', { name: 'Toggle throw lines' }).first().click();
    expect(await paths.count()).toBeGreaterThan(1);
    const mapBox = await map.boundingBox();
    await page.mouse.click(mapBox!.x + 8, mapBox!.y + 8);
    await expect(page.getByTestId('lineup-popup')).toHaveCount(0);
    await page.getByTestId('minimap').first().getByRole('button', { name: /Open Mid Bend/ }).getByTestId('stand-marker').locator('circle').first().click();
    await expect(page.getByTestId('lineup-popup')).toBeVisible();
    await expect(page.getByTestId('lineup-detail')).toBeVisible();
    await expect(page.getByTestId('lineup-transform')).toBeVisible();
    const popup = await page.getByTestId('lineup-popup').boundingBox();
    expect(popup!.width).toBeGreaterThan(1300); expect(popup!.height).toBeGreaterThan(800);
    await page.getByTestId('lineup-popup').getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByTestId('zoom-level')).not.toHaveText('100%');
    const stage = page.getByTestId('lineup-stage'); const sb = await stage.boundingBox();
    await page.mouse.move(sb!.x + sb!.width / 2, sb!.y + sb!.height / 2); await page.mouse.down(); await page.mouse.move(sb!.x + sb!.width / 2 - 80, sb!.y + sb!.height / 2 - 40, { steps: 4 }); await page.mouse.up();
    const transform = await page.getByTestId('lineup-transform').evaluate(el => getComputedStyle(el).transform);
    expect(transform).not.toBe('none');
    await page.getByTestId('lineup-popup').getByRole('button', { name: 'Reset image view' }).click();
    await expect(page.getByTestId('zoom-level')).toHaveText('100%');
    await expect(page.getByRole('tab', { name: 'Second stand' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Second aim' })).toHaveCount(0);
    await page.getByTestId('lineup-popup').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('browse')).toBeVisible();
    await expect(page.getByTestId('lineup-popup')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('legacy malformed lineup does not blank the screen when a marker is opened', async ({ page }) => {
    const errors = await noErrors(page);
    await page.goto('/?mock&malformed');
    await page.getByTestId('minimap').first().getByRole('button', { name: /Open Mid Bend/ }).getByTestId('stand-marker').locator('circle').first().click();
    await expect(page.getByTestId('lineup-detail')).toBeVisible();
    await expect(page.getByTestId('render-error')).toHaveCount(0);
    await page.getByTestId('lineup-popup').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('browse')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('TDM maps never appear in Browse or Create selectors', async ({ page }) => {
    await page.goto('/?mock');
    await page.getByRole('button', { name: 'Choose map' }).click();
    const dialog = page.getByRole('dialog', { name: 'Choose map' });
    for (const name of ['District', 'Kasbah', 'Piazza', 'Drift', 'Glitch']) await expect(dialog.getByRole('option', { name })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Create' }).click();
    await page.getByTestId('wizard-setup').getByRole('button', { name: 'Choose map' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Choose map' });
    for (const name of ['District', 'Kasbah', 'Piazza', 'Drift', 'Glitch']) await expect(createDialog.getByRole('option', { name })).toHaveCount(0);
  });

  test('square selectors use large artwork and three adjacent columns', async ({ page }) => {
    await page.goto('/?mock');
    const pickers = page.locator('.ll-browse__pickers .ll-browse-picker--square');
    await expect(pickers).toHaveCount(3);
    const boxes = await Promise.all([0, 1, 2].map(i => pickers.nth(i).boundingBox()));
    expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThan(2);
    expect(Math.abs(boxes[1]!.y - boxes[2]!.y)).toBeLessThan(2);
    const img = pickers.first().locator('img').first();
    const ib = await img.boundingBox(); const tb = boxes[0]!;
    expect(ib!.width / tb.width).toBeGreaterThan(0.7);
    expect(ib!.height / tb.height).toBeGreaterThan(0.6);
  });

  test('minimap toolbar tooltip stays inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto('/?mock');
    await page.getByRole('button', { name: 'Toggle throw lines' }).first().hover();
    const tip = page.getByRole('tooltip').last();
    await expect(tip).toBeVisible();
    const b = await tip.boundingBox();
    expect(b!.x).toBeGreaterThanOrEqual(0); expect(b!.x + b!.width).toBeLessThanOrEqual(900);
    expect(b!.y).toBeGreaterThanOrEqual(0);
  });

  test('cards omit throw/charge/bounce details', async ({ page }) => {
    await page.goto('/?mock');
    const card = page.getByTestId('lineup-card').first();
    await expect(card).not.toContainText(/jump-throw|normal|charge|bounce/i);
  });
});

test.describe('Preview 5 Create', () => {
  test('charge/bounces are per aim capture and double shocks stay independent', async ({ page }) => {
    await page.goto('/?mock');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Create' }).click();
    const setup = page.getByTestId('wizard-setup');
    await setup.getByRole('button', { name: 'Choose map' }).click();
    await page.getByRole('dialog', { name: 'Choose map' }).getByRole('option', { name: 'Abyss' }).click();
    await setup.getByRole('button', { name: 'Choose agent' }).click();
    await page.getByRole('dialog', { name: 'Choose agent' }).getByRole('option', { name: 'Sova' }).click();
    await setup.getByRole('button', { name: 'Choose ability' }).click();
    await page.getByRole('dialog', { name: 'Choose ability' }).getByRole('option', { name: /Shock Bolt/ }).click();
    await setup.getByRole('switch', { name: 'Double shock' }).click();
    await expect(setup.getByTestId('dart-controls')).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Create sections' }).getByRole('button', { name: 'Capture' }).click();
    const capture = page.getByTestId('wizard-capture');
    await expect(capture.getByTestId('slot-stand2')).toBeVisible();
    await expect(capture.getByTestId('slot-aim2')).toBeVisible();
    await capture.getByTestId('slot-aim1').click();
    await capture.getByRole('radio', { name: 'Full', exact: true }).click();
    await capture.getByRole('radio', { name: '2', exact: true }).click();
    await capture.getByTestId('slot-aim2').click();
    await expect(capture.getByRole('radio', { name: 'Full', exact: true })).toHaveAttribute('aria-checked', 'false');
    await capture.getByRole('radio', { name: '1st', exact: true }).click();
    await capture.getByRole('radio', { name: '0', exact: true }).click();
    await capture.getByTestId('slot-aim1').click();
    await expect(capture.getByRole('radio', { name: 'Full', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(capture.getByRole('radio', { name: '2', exact: true })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Setup', exact: true }).click();
    await page.getByTestId('wizard-setup').getByRole('switch', { name: 'Double shock' }).click();
    await page.getByRole('navigation', { name: 'Create sections' }).getByRole('button', { name: 'Capture' }).click();
    await expect(capture.getByTestId('slot-stand2')).toHaveCount(0);
    await expect(capture.getByTestId('slot-aim2')).toHaveCount(0);
  });

  test('sidebar navigation replaces the old top progress/Back/Next bar', async ({ page }) => {
    await page.goto('/?mock');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Create' }).click();
    await expect(page.locator('.ll-wizard__top')).toHaveCount(0);
    await expect(page.locator('.ll-wizard__foot')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Create sections' })).toBeVisible();
  });
});
