import { test, expect } from '@playwright/test';

test.describe('desktop overlay', () => {
  test('create checklist, capture fade, view navigation and flip', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 320 });
    await page.goto('/?mock#overlay');
    await expect(page.getByTestId('overlay-content')).toBeVisible();
    await expect(page.getByTestId('overlay-checklist-stand1')).toContainText('Captured');
    await expect(page.getByTestId('overlay-checklist-landing')).toContainText('Required');
    await page.screenshot({ path: 'docs/screenshots/60-overlay-create.png' });
    await page.evaluate(() => window.__LL_MOCK_EMIT__('lineuplab://hotkey', 'capture'));
    await expect(page.getByTestId('overlay-view')).toHaveAttribute('data-fading', 'true');
    await expect(page.getByTestId('overlay-view')).not.toHaveAttribute('data-fading', 'true', { timeout: 2000 });
    await page.getByRole('button', { name: 'Hide checklist' }).click();
    await expect(page.getByTestId('overlay-checklist-stand1')).toHaveCount(0);
    await page.getByRole('button', { name: 'Show checklist' }).click();
    await expect(page.getByTestId('overlay-checklist-stand1')).toBeVisible();
    await page.getByRole('button', { name: 'Switch to learn mode' }).click();
    await page.setViewportSize({ width: 420, height: 360 });
    await expect(page.getByTestId('overlay-content')).toHaveAttribute('data-mode', 'view');
    await expect(page.locator('.ll-ov__nav-label')).toContainText('Aim · 2/3');
    await expect(page.locator('.ll-ov__image svg').first()).toHaveCSS('z-index', '2');
    await expect(page.locator('.ll-ov__image svg circle')).not.toHaveCount(0);
    await page.mouse.move(0, 0); await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.screenshot({ path: 'docs/screenshots/61-overlay-view.png' });
    await page.getByRole('button', { name: 'Next image' }).click();
    await expect(page.locator('.ll-ov__nav-label')).toContainText('Landing · 3/3');
    await page.getByRole('button', { name: 'Show steps and map' }).click();
    await expect(page.locator('.ll-ov__notes')).toContainText('Stand on the marked corner');
    await page.mouse.move(0, 0); await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.screenshot({ path: 'docs/screenshots/62-overlay-notes.png' });
    await page.evaluate(() => window.__LL_MOCK_EMIT__('lineuplab://hotkey', 'view_flip'));
    await expect(page.getByRole('button', { name: 'Show steps and map' })).toBeVisible();
  });

  test('minimal and outline prefs sync to an open overlay window', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?mock&overlayMode=view');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('tab', { name: 'Overlay' }).click();
    const preview = page.locator('.ll-overlay-actual').getByTestId('overlay-content-preview');
    await expect(preview).toBeVisible();
    const overlay = await context.newPage();
    await overlay.setViewportSize({ width: 420, height: 236 });
    await overlay.goto('/?mock&overlayMode=view#overlay');
    await expect(overlay.getByTestId('overlay-content')).toBeVisible();
    await page.getByRole('switch', { name: 'Outline' }).click();
    await page.getByRole('slider', { name: 'Outline thickness' }).fill('6');
    await page.getByRole('switch', { name: 'Minimal mode' }).click();
    await expect(overlay.locator('.ll-ov--minimal')).toHaveClass(/has-outline/);
    await expect(overlay.locator('.ll-ov__head')).toHaveCount(0);
    await overlay.screenshot({ path: 'docs/screenshots/63-overlay-minimal-outline.png' });
    await page.mouse.move(0, 0); await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.screenshot({ path: 'docs/screenshots/64-settings-overlay-live.png', fullPage: true });
    await overlay.close();
  });

  test('editor publishes the live draft to the overlay', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?mock');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Create' }).click();
    await expect(page.getByTestId('editor')).toBeVisible();
    const overlay = await context.newPage();
    await overlay.setViewportSize({ width: 420, height: 320 });
    await overlay.goto('/?mock#overlay');
    await expect(overlay.getByTestId('overlay-checklist-stand1')).toHaveAttribute('aria-current', 'step');
    await expect(overlay.getByTestId('overlay-checklist-stand1')).toContainText('Current slot');
    await page.evaluate(() => window.__LL_MOCK_EMIT__('lineuplab://hotkey', 'slot_landing'));
    await expect(overlay.getByTestId('overlay-checklist-landing')).toHaveAttribute('aria-current', 'step');
    await overlay.screenshot({ path: 'docs/screenshots/65-overlay-live-draft.png' });
    await overlay.close();
  });
});

  test('overlay settings use the detected 1440p monitor and logical DPI placement', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?mock');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('tab', { name: 'Overlay' }).click();
    await expect(page.getByTestId('overlay-monitor-summary')).toContainText('2560×1440 physical');
    await page.getByRole('radio', { name: 'bottom right' }).click();
    await expect(page.getByTestId('overlay-monitor-summary')).toContainText(/position 2116,\d+ logical/);
    await page.screenshot({ path: 'docs/screenshots/66-settings-overlay-1440p.png', fullPage: true });
    await page.getByLabel('Monitor').selectOption('1');
    await expect(page.getByTestId('overlay-monitor-summary')).toContainText('1920×1080 physical');
    await expect(page.getByTestId('overlay-monitor-summary')).toContainText(/position 1476,\d+ logical/);
    await page.getByRole('button', { name: 'Reapply placement' }).click();
    await expect(page.getByText('Overlay placement reapplied to the selected monitor.')).toBeVisible();
  });

test('normal overlay shows discreet hotkeys and combined margin persists', async ({ page }) => {
  await page.goto('/?mock'); await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click(); await page.getByRole('tab', { name: 'Overlay' }).click();
  await page.getByRole('spinbutton', { name: 'Margin' }).fill('36'); await page.getByRole('spinbutton', { name: 'Margin' }).press('Enter');
  await page.goto('/?mock&overlay&overlayMode=view'); await expect(page.getByTestId('overlay-hotkey-hints')).toContainText('minimal');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mock.overlay') ?? '{}'));
  expect(stored.marginX).toBe(36); expect(stored.marginY).toBe(36);
});

test('minimal overlay preserves image proportions in a mismatched window and normal chrome does not clip the image', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('p6-overlay-init')) { localStorage.setItem('lineuplab.overlayView', JSON.stringify({ minimal: true, outline: true, outlineThickness: 4 })); sessionStorage.setItem('p6-overlay-init', '1'); } });
  await page.setViewportSize({ width: 420, height: 560 });
  await page.goto('/?mock&overlay&overlayMode=view');
  const image = page.locator('.ll-ov__minimal-img');
  await expect(image).toBeVisible();
  const box = (await image.boundingBox())!;
  expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.02);
  expect(box.width).toBeLessThanOrEqual(420); expect(box.height).toBeLessThanOrEqual(560);
  await expect(image).toHaveCSS('outline-width', '4px');
  await page.evaluate(() => localStorage.setItem('lineuplab.overlayView', JSON.stringify({ minimal: false })));
  await page.setViewportSize({ width: 800, height: 538 });
  await page.reload();
  const normal = (await page.locator('.ll-ov__image').boundingBox())!;
  const nav = (await page.locator('.ll-ov__nav').boundingBox())!;
  expect(normal.y + normal.height).toBeLessThanOrEqual(nav.y + 1);
});

test('rapid overlay setting changes are merged instead of overwriting each other', async ({ page }) => {
  await page.goto('/?mock'); await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click(); await page.getByRole('tab', { name: 'Overlay' }).click();
  await page.getByRole('switch', { name: 'Enabled' }).click();
  await page.getByRole('switch', { name: 'Click-through' }).click();
  await page.getByRole('spinbutton', { name: 'Size' }).fill('640'); await page.getByRole('spinbutton', { name: 'Size' }).press('Enter');
  await page.getByRole('spinbutton', { name: 'Margin' }).fill('40'); await page.getByRole('spinbutton', { name: 'Margin' }).press('Enter');
  await page.reload(); await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click(); await page.getByRole('tab', { name: 'Overlay' }).click();
  await expect(page.getByRole('switch', { name: 'Enabled' })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Click-through' })).not.toBeChecked();
  await expect(page.getByRole('spinbutton', { name: 'Size' })).toHaveValue('640');
  await expect(page.getByRole('spinbutton', { name: 'Margin' })).toHaveValue('40');
});
