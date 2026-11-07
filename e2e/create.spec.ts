import { test, expect, type Page } from '@playwright/test';

async function openCreate(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?mock');
  await expect(page.getByTestId('lineup-card').first()).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Create' }).click();
  await expect(page.getByTestId('wizard-setup')).toBeVisible();
}
async function hotkey(page: Page, action: string) {
  await page.evaluate(a => (window as unknown as { __LL_MOCK_EMIT__(e: string, p: unknown): void }).__LL_MOCK_EMIT__('lineuplab://hotkey', a), action);
  await page.waitForTimeout(250);
}
async function setupSova(page: Page) {
  const setup = page.getByTestId('wizard-setup');
  await setup.getByRole('listbox', { name: 'Map' }).getByRole('option', { name: 'Abyss' }).click();
  await setup.getByRole('listbox', { name: 'Agent' }).getByRole('option', { name: 'Sova' }).click();
  await setup.getByRole('listbox', { name: 'Ability' }).getByRole('option', { name: /Recon Bolt/ }).click();
  await setup.getByRole('radio', { name: /Recon · 1 bounce · full charge/ }).click();
}

test.describe('desktop create wizard', () => {
  test('five-step flow with hotkeys, annotations, pins, validation and save', async ({ page }) => {
    await openCreate(page);
    await page.screenshot({ path: 'docs/screenshots/20-create-setup-empty.png' });
    await setupSova(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/screenshots/21-create-setup.png' });
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByTestId('wizard-capture')).toBeVisible();
    await expect(page.getByText('0/3 required')).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/22-create-capture-empty.png' });
    await hotkey(page, 'capture');
    await expect(page.getByTestId('slot-stand1')).toHaveClass(/is-done/);
    await expect(page.getByTestId('slot-aim1')).toHaveClass(/is-active/);
    await hotkey(page, 'capture');
    await hotkey(page, 'crosshair_circle');
    await expect(page.getByTestId('slot-aim1')).toHaveClass(/is-active/);
    await hotkey(page, 'slot_landing');
    await hotkey(page, 'capture');
    await expect(page.getByText('3/3 required')).toBeVisible();
    await page.getByTestId('slot-aim1').click();
    await page.getByRole('button', { name: 'Annotate', exact: true }).click();
    await expect(page.getByTestId('annotation-editor')).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/screenshots/23-create-annotate.png' });
    await page.getByRole('button', { name: 'Done annotating' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByTestId('wizard-pins')).toBeVisible();
    const stage = page.getByTestId('wizard-pins').locator('.ll-minimap__stage');
    const box = (await stage.boundingBox())!;
    await stage.click({ position: { x: box.width * 0.3, y: box.height * 0.6 } });
    await page.getByRole('radio', { name: 'Landing *' }).click();
    await stage.click({ position: { x: box.width * 0.6, y: box.height * 0.3 } });
    await page.getByRole('radio', { name: 'Bounce', exact: true }).click();
    await stage.click({ position: { x: box.width * 0.45, y: box.height * 0.45 } });
    await expect(page.locator('.ll-pin-list code').first()).toHaveText(/^0\.\d+, 0\.\d+$/);
    await expect(page.locator('.ll-pins__map img')).toHaveAttribute('src', /fixture-art\/minimap\//);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'docs/screenshots/24-create-pins.png' });
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByTestId('wizard-details')).toBeVisible();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(/Sova Recon Bolt · Abyss/);
    await page.getByRole('button', { name: 'Attack', exact: true }).click();
    await page.getByRole('button', { name: 'B', exact: true }).click();
    await page.getByLabel('Notes').fill('Fixture notes for the redesigned wizard.');
    await page.getByRole('button', { name: 'Generate from captures' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'docs/screenshots/25-create-details.png' });
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByTestId('wizard-review')).toBeVisible();
    await expect(page.getByText('Ready to save.')).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/screenshots/26-create-review.png' });
    await hotkey(page, 'save');
    await expect(page.getByTestId('browse')).toBeVisible();
    await expect(page.getByText('Lineup saved.')).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/screenshots/27-create-saved.png' });
  });
  test('inline validation blocks an incomplete setup and review lists fixes', async ({ page }) => {
    await openCreate(page);
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByTestId('wizard-setup').getByText('Choose the map this lineup is on.')).toBeVisible();
    await expect(page.getByTestId('wizard-setup')).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/28-create-validation.png' });
    await page.getByRole('button', { name: /Review/ }).click();
    await expect(page.getByTestId('wizard-review')).toBeVisible();
    await expect(page.locator('.ll-review__actions button').first()).toBeDisabled();
    await expect(page.locator('.ll-issues li').first()).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/29-create-review-issues.png' });
  });
  test('autosaves a draft and offers recovery', async ({ page }) => {
    await openCreate(page);
    await page.getByTestId('wizard-setup').getByRole('listbox', { name: 'Map' }).getByRole('option', { name: 'Bind' }).click();
    await expect(page.getByText(/Draft saved/)).toBeVisible();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Browse' }).click();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(/An unsaved draft from/)).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/30-create-draft-recovery.png' });
    await page.getByRole('button', { name: 'Restore draft' }).click();
    await expect(page.getByTestId('wizard-capture')).toBeVisible();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Discard draft' }).click();
    await expect(page.getByTestId('wizard-setup')).toBeVisible();
  });
});
