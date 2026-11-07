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
    await expect(page.getByText('Checklist hidden')).toBeVisible();
    await page.getByRole('button', { name: 'Show checklist' }).click();
    await page.getByRole('button', { name: 'Switch to view mode' }).click();
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

  test('reading comfort prefs apply and sync to an open overlay window', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?mock&overlayMode=view');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('tab', { name: 'Overlay' }).click();
    const preview = page.locator('.ll-overlay-actual').getByTestId('overlay-content-preview');
    await expect(preview).toBeVisible();
    await expect(preview.locator('.ll-ov__image svg circle').first()).toBeVisible();
    const overlay = await context.newPage();
    await overlay.setViewportSize({ width: 420, height: 360 });
    await overlay.goto('/?mock&overlayMode=view#overlay');
    await expect(overlay.getByTestId('overlay-content')).toBeVisible();
    await page.getByRole('switch', { name: 'Hide annotations in overlay' }).click();
    await expect(preview.locator('.ll-ov__image svg circle')).toHaveCount(0);
    await expect(overlay.locator('.ll-ov__image svg circle')).toHaveCount(0);
    const scale = page.getByRole('slider', { name: /Content scale/ });
    await scale.focus(); await scale.press('End'); for (let i = 0; i < 5; i++) await scale.press('ArrowLeft');
    await expect(page.locator('.ll-overlay-actual__label')).toContainText('150%');
    await expect(overlay.getByTestId('overlay-content')).toHaveCSS('font-size', '19.5px');
    await overlay.screenshot({ path: 'docs/screenshots/63-overlay-scaled.png' });
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
