import { test, expect } from '@playwright/test';
test('avoidance rewards once, corrects honestly and sends Nafl to Routines', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /^Secrets/ }).click();
  await page.getByRole('button', { name: 'Add secret', exact: true }).click();
  const f = page.locator('.secret-form');
  await f.getByLabel('Secret name').fill('Avoid a habit');
  await f.getByLabel('Penalty', { exact: true }).selectOption('nafl');
  await f.getByLabel('Number of Rak’ahs').fill('4');
  await f.getByRole('button', { name: 'Save secret' }).click();
  await page.getByRole('button', { name: 'No, I avoided it', exact: true }).click();
  await expect(
    page.locator('.secrets-summary').getByText('1', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator('.secret-card-stats')).toContainText('1 day streak');
  await page.getByRole('button', { name: 'Correct today’s answer', exact: true }).click();
  await page.getByRole('button', { name: 'No, I avoided it', exact: true }).click();
  await expect(page.locator('.secret-card-stats')).toContainText('1 avoided days');
  await page.getByRole('button', { name: 'Correct today’s answer', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, I did', exact: true }).click();
  await expect(page.locator('.secret-card-stats')).toContainText('0 avoided days');
  await page.getByRole('button', { name: 'Routines', exact: true }).first().click();
  await page.getByRole('button', { name: 'Nafl Salah', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nafl penalty', exact: true })).toBeVisible();
});
test('image reading belongs to its routine card and is deleted with it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Routines', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add routine', exact: true }).click();
  const f = page.getByRole('dialog');
  await f.getByLabel('Routine name').fill('Attached ayat');
  await f.locator('select[name="kind"]').selectOption('quran');
  await expect(f.locator('option[value="quran"]')).toHaveText('Ayat');
  await f.getByLabel('Add PDF or image').setInputFiles({
    name: 'reading.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await f.getByRole('button', { name: 'Save', exact: true }).click();
  const card = page.locator('.routine');
  await expect(card.getByRole('img', { name: 'reading.png', exact: true })).toBeVisible();
  await expect(page.locator('.routine-library')).toHaveCount(0);
  await page.screenshot({ path: '.tools/v035-inline.png', fullPage: true });
  await card.getByLabel('Routine options').click();
  await card.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(card).toHaveCount(0);
  const snap = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!));
  expect(snap.localFiles).toHaveLength(0);
});
