import { test, expect } from '@playwright/test';

type OverlayView = { state: { mode: string; visible: boolean; lineupOrder: string[]; viewSlots: string[] }; lineup: { id: string; title: string } | null };
const overlayView = (page: import('@playwright/test').Page) => page.evaluate(() => window.__TAURI_INTERNALS__.invoke('get_overlay_view')) as Promise<OverlayView>;

test.describe('preview 8 overlay learn flow', () => {
  test.beforeEach(async ({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'desktop overlay'); });

  test('learn mode skips a second stand that is missing or repeats the first picture', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 360 });
    await page.goto('/?mock&dupe-stand&overlayMode=view#overlay');
    await expect(page.getByTestId('overlay-content')).toHaveAttribute('data-mode', 'view');
    const labels = new Set<string>();
    for (let i = 0; i < 4; i++) {
      labels.add((await page.locator('.ll-ov__nav-label').innerText()).split('·')[0].trim());
      await page.getByRole('button', { name: 'Next image' }).click();
    }
    expect([...labels].sort()).toEqual(['Aim', 'Landing', 'Stand']);
    // A real double shock keeps its distinct second aim, but not a copied stand.
    await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('set_overlay_lineup', { id: 'fixture-1', order: null, reveal: true }));
    await expect(page.locator('.ll-ov__nav-label')).toContainText('1/4');
    const doubleLabels = new Set<string>();
    for (let i = 0; i < 4; i++) {
      doubleLabels.add((await page.locator('.ll-ov__nav-label').innerText()).split('·')[0].trim());
      await page.getByRole('button', { name: 'Next image' }).click();
    }
    expect([...doubleLabels].sort()).toEqual(['Aim', 'Landing', 'Second aim', 'Stand']);
  });

  test('Alt+Down and Alt+Up step through lineups in the overlay', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 360 });
    await page.goto('/?mock&overlayMode=view#overlay');
    const title = page.locator('.ll-ov__title');
    await expect(title).toHaveText('Mid Bend → B Site');
    await page.keyboard.press('Alt+ArrowDown');
    await expect(title).toHaveText('A Main double shock');
    await expect(page.getByTestId('overlay-lineup-position')).toHaveText('2/12');
    await page.keyboard.press('Alt+ArrowDown');
    await expect(title).toHaveText('Mid one-way smoke');
    await page.keyboard.press('Alt+ArrowUp');
    await expect(title).toHaveText('A Main double shock');
    await page.keyboard.press('Alt+ArrowUp');
    await expect(title).toHaveText('Mid Bend → B Site');
    // Wraps backwards from the first entry to the last one.
    await page.keyboard.press('Alt+ArrowUp');
    await expect(title).toHaveText('Mid barrier orb');
    await expect(page.getByTestId('overlay-hotkey-hints')).toContainText('lineup');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('the header stepper buttons move between lineups', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 360 });
    await page.goto('/?mock&overlayMode=view#overlay');
    await page.getByRole('button', { name: 'Next lineup' }).click();
    await expect(page.locator('.ll-ov__title')).toHaveText('A Main double shock');
    await page.getByRole('button', { name: 'Previous lineup' }).click();
    await expect(page.locator('.ll-ov__title')).toHaveText('Mid Bend → B Site');
  });

  test('viewing a lineup in Browse shows it in the overlay without clicking Learn', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?mock');
    await expect(page.getByTestId('browse')).toBeVisible();
    // Nothing is open yet: the overlay keeps its mode but learns the Browse order.
    const initial = await overlayView(page);
    expect(initial.state.lineupOrder.length).toBeGreaterThan(0);
    await page.getByTestId('lineup-card').first().getByRole('button', { name: /^Open / }).click();
    await expect(page.getByTestId('lineup-detail')).toBeVisible();
    const opened = await overlayView(page);
    expect(opened.state.mode).toBe('view');
    expect(opened.lineup?.title).toBe('Mid Bend → B Site');
    expect(opened.state.lineupOrder[0]).toBe(opened.lineup?.id);
    // Opening Create brings the capture checklist back.
    await page.getByRole('dialog').getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByTestId('editor')).toBeVisible();
    expect((await overlayView(page)).state.mode).toBe('create');
  });

  test('a hidden overlay is not forced back on by browsing', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?mock');
    await expect(page.getByTestId('browse')).toBeVisible();
    await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('overlay_action', { action: 'overlay_toggle' }));
    await page.getByTestId('lineup-card').first().getByRole('button', { name: /^Open / }).click();
    await expect(page.getByTestId('lineup-detail')).toBeVisible();
    const view = await overlayView(page);
    // The lineup is remembered, but a hidden overlay stays hidden and in Create mode.
    expect(view.lineup?.id).toBe('fixture-0');
    expect(view.state.mode).toBe('create');
    expect(view.state.visible).toBe(false);
  });

  test('the lineup viewer rail uses the same real-step rule', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?mock&dupe-stand');
    await page.getByTestId('lineup-card').first().getByRole('button', { name: /^Open / }).click();
    const rail = page.getByRole('tablist', { name: 'Image slots' });
    await expect(rail.getByRole('tab')).toHaveCount(3);
    await expect(rail).not.toContainText('Second stand');
  });
});
