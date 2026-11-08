import { test, expect, type Page } from '@playwright/test';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
async function pick(page: Page, label: string, option: string | RegExp) {
  await page.getByRole('button', { name: `Choose ${label}` }).click();
  await page.getByRole('dialog', { name: `Choose ${label}` }).getByRole('option', { name: option }).click();
}
async function setup(page: Page, agent = 'Sova', ability: string | RegExp = /Recon Bolt/) {
  await page.goto('/?mock');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Create', exact: true }).click();
  await pick(page, 'map', 'Ascent'); await pick(page, 'agent', agent); await pick(page, 'ability', ability);
}
async function pin(page: Page, label: string, x: number, y: number) {
  await page.getByRole('radio', { name: label, exact: true }).click();
  const box = await page.locator('.ll-minimap').first().boundingBox();
  await page.mouse.click(box!.x + box!.width * x, box!.y + box!.height * y);
}
async function attach(page: Page, slot: string) {
  await page.getByTestId(`slot-${slot}`).click();
  await page.locator('.ll-stage-card__tools').getByRole('button', { name: 'Choose image' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG });
}
async function pins(page: Page) {
  await page.getByRole('navigation', { name: 'Create sections' }).getByRole('button', { name: 'Pins' }).click();
  await expect(page.getByText('Clear pins')).toHaveCount(0); await expect(page.locator('.ll-pin-list code')).toHaveCount(0);
  await pin(page, 'Start', .3, .7); await pin(page, 'End', .65, .3);
  await expect(page.locator('[data-pin]')).toHaveCount(2);
}
async function finish(page: Page, title: string) {
  await page.getByRole('navigation', { name: 'Create sections' }).getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByTestId('wizard-details')).toBeVisible();
  await expect(page.getByLabel('Notes')).toHaveCount(0); await expect(page.getByLabel('Author')).toHaveCount(0); await expect(page.getByLabel('Tags')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByRole('button', { name: 'A', exact: true }).click();
}
test('four-stage sidebar flow: clean pins, annotation and save', async ({ page }) => {
  await setup(page);
  await expect(page.locator('.ll-wizard__top')).toHaveCount(0);
  await expect(page.getByText('0/3 required')).toHaveCount(0);
  await pins(page);
  await expect(page.getByRole('radio', { name: 'Second start' })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Create sections' }).getByRole('button', { name: 'Capture' }).click();
  await attach(page, 'stand1'); await attach(page, 'aim1'); await attach(page, 'landing');
  await page.getByTestId('slot-landing').click();
  await page.getByRole('button', { name: 'Annotate', exact: true }).click();
  await page.getByLabel('Circle', { exact: true }).click();
  await page.getByTestId('annotated-image').click({ position: { x: 400, y: 200 } });
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await finish(page, 'Recon A default');
  await page.getByRole('button', { name: 'Save lineup', exact: true }).click();
  await page.getByRole('button', { name: 'Choose map' }).click(); await page.getByRole('dialog', { name: 'Choose map' }).getByRole('option', { name: 'Ascent' }).click();
  await expect(page.getByText('Recon A default').first()).toBeVisible();
});
test('two stands keep separate Sova charge and bounce choices', async ({ page }) => {
  await setup(page, 'Sova', /Shock Bolt/);
  await page.getByRole('switch', { name: 'Double shock' }).click();
  await pins(page); await expect(page.getByRole('radio', { name: 'Second start' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Create sections' }).getByRole('button', { name: 'Capture' }).click();
  await attach(page, 'stand1'); await attach(page, 'aim1');
  await page.getByTestId('slot-aim1').click();
  await page.getByRole('radio', { name: 'Full', exact: true }).click();
  await page.getByRole('radio', { name: '2', exact: true }).click();
  await attach(page, 'stand2'); await attach(page, 'aim2');
  await page.getByTestId('slot-aim2').click();
  await page.getByRole('radio', { name: '2nd', exact: true }).click();
  await page.getByRole('radio', { name: '1', exact: true }).click();
  await attach(page, 'landing');
  await finish(page, 'Independent shock aims');
  await page.getByRole('button', { name: 'Save lineup', exact: true }).click();
  await page.getByRole('button', { name: 'Choose map' }).click(); await page.getByRole('dialog', { name: 'Choose map' }).getByRole('option', { name: 'Ascent' }).click();
  await page.getByPlaceholder('Search title, notes, tags…').fill('Independent shock aims');
  await page.getByRole('button', { name: 'Edit lineup' }).click();
  await page.getByRole('navigation', { name: 'Create sections' }).getByRole('button', { name: 'Capture' }).click();
  await page.getByTestId('slot-aim1').click();
  await expect(page.getByRole('radio', { name: 'Full', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('slot-aim2').click();
  await expect(page.getByRole('radio', { name: '2nd', exact: true })).toHaveAttribute('aria-checked', 'true');
});
test('save and create another retains setup; site choices exclude Custom', async ({ page }) => {
  await setup(page);
  await pins(page);
  await page.getByRole('navigation', { name: 'Create sections' }).getByRole('button', { name: 'Capture' }).click();
  await attach(page, 'stand1'); await attach(page, 'aim1'); await attach(page, 'landing');
  await finish(page, 'Retained setup');
  await expect(page.getByRole('button', { name: 'Custom', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save & create another' }).click();
  await expect(page.getByTestId('wizard-capture')).toBeVisible();
  await page.getByRole('navigation', { name: 'Create sections' }).getByRole('button', { name: 'Setup' }).click();
  await expect(page.getByTestId('wizard-setup')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose map' })).toContainText('Ascent');
  await expect(page.getByRole('button', { name: 'Choose agent' })).toContainText('Sova');
});

test('compact Create rail keeps save reachable in a half-size window', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto('/?mock');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Create', exact: true }).click();
  const save = page.getByRole('button', { name: 'Save lineup', exact: true });
  await expect(save).toBeVisible();
  const box = (await save.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(450);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(721);
  await page.locator('.ll-create-checks summary').click();
  await expect(page.getByRole('button', { name: 'Choose the map this lineup is on.' })).toBeVisible();
});
