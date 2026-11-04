import { test, expect } from '@playwright/test';
const back = (page: any) =>
  page.evaluate(() => window.dispatchEvent(new CustomEvent('deenpath:back', { cancelable: true })));
async function routines(page: any) {
  await page.getByRole('button', { name: 'Routines', exact: true }).first().click();
}
test('Tasbih accepts a PDF and selected prayer times reset its period without deleting the earlier count', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-30T00:10:00Z'));
  await page.goto('/');
  await routines(page);
  await page.getByRole('button', { name: 'Add routine', exact: true }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Routine name').fill('After prayer practice');
  await form.locator('select[name="kind"]').selectOption('tasbih');
  await form.getByLabel('Target', { exact: true }).fill('2');
  await form.getByLabel('Frequency', { exact: true }).selectOption('after_prayer');
  await form.locator('input[name="resetPrayers"][value="Isha"]').check();
  await form.getByLabel('Add PDF or image').setInputFiles({
    name: 'practice.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF'),
  });
  await expect(form.locator('input[name="fileId"]')).not.toHaveValue('');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  const counter = page.getByRole('button', { name: 'Tap to count', exact: true });
  await counter.click();
  await counter.click();
  await expect(counter.locator('strong')).toHaveText('2');
  await expect(page.getByRole('button', { name: 'Open attachment', exact: true })).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-10-30T00:45:00Z'));
  await expect(counter.locator('strong')).toHaveText('0');
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('salahguard')!).records.filter(
        (r: any) => r.entity === 'prayer_records',
      ),
    ),
  ).toHaveLength(0);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!));
  const r = state.records.find((r: any) => r.entity === 'routines');
  expect(r.data.resetPrayers).toEqual(['Fajr', 'Isha']);
  expect(r.data.fileId).toBeTruthy();
  expect(state.records.find((r: any) => r.entity === 'tasbih_progress').data.count).toBe(2);
  expect(state.records.filter((r: any) => r.entity === 'routine_completions')).toHaveLength(1);
});
test('completed cards swipe to the next item in the same category only', async ({ page }) => {
  await page.goto('/');
  await routines(page);
  for (const name of ['First dhikr', 'Second dhikr']) {
    await page.getByRole('button', { name: 'Add routine', exact: true }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Routine name').fill(name);
    await form.locator('select[name="kind"]').selectOption('tasbih');
    await form.getByLabel('Target', { exact: true }).fill('1');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
  }
  const group = page.getByRole('region', { name: 'Tasbih', exact: true });
  await group.getByRole('button', { name: 'Tap to count', exact: true }).click();
  const title = group.getByRole('heading', { name: 'First dhikr' });
  const box = (await title.boundingBox())!;
  await page.mouse.move(box.x + box.width - 20, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + 10, { steps: 8 });
  await page.mouse.up();
  await expect(group.getByRole('heading', { name: 'Second dhikr' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'Tap to count' }).locator('strong')).toHaveText(
    '0',
  );
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!));
  expect(state.records.filter((r: any) => r.entity === 'routine_completions')).toHaveLength(1);
});
test('Collection and tools return to the previous screen with visible and system Back', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await page.locator('.collection-door').click();
  await expect(page.getByRole('heading', { name: 'My Collection', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Activity trends' })).toBeVisible();
  await back(page);
  await expect(page.locator('.collection-door')).toBeVisible();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /^Qibla Compass/ }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'More', exact: true })).toBeVisible();
});
test('Secrets form chooses a penalty and keeps descriptions private', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /^Secrets/ }).click();
  await page.getByRole('button', { name: 'Add secret', exact: true }).click();
  const editor = page.locator('.secret-form');
  await editor.getByLabel('Secret name', { exact: true }).fill('My intention');
  await editor.getByLabel('Description', { exact: true }).fill('Work patiently on this intention.');
  await editor.getByLabel('Penalty', { exact: true }).selectOption('nafl');
  await expect(editor.locator('input[name="time"]')).toBeVisible();
  await editor.getByRole('button', { name: 'Save secret', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'My intention', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('salahguard'))).not.toContain(
    'Work patiently on this intention.',
  );
});

test('Back restores the actual prior Prayer subview', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Prayer', exact: true }).click();
  await page.getByRole('button', { name: 'Prayer Report', exact: true }).click();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await back(page);
  await expect(page.getByRole('button', { name: 'Overall', exact: true })).toBeVisible();
  await back(page);
  await expect(page.locator('.today-prayer')).toHaveCount(5);
});
