import { test, expect } from '@playwright/test';
test('yesterday Qaza and daily Nafl stay in separate stacks across reload and completion', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-30T15:00Z'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Routines', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add routine', exact: true }).click();
  const f = page.getByRole('dialog');
  await f.getByLabel('Routine name').fill('Nafl practice');
  await f.locator('select[name="kind"]').selectOption('nafl');
  await f.locator('input[name="startDate"]').fill('2026-10-28');
  await f.locator('input[name="time"]').fill('08:00');
  await f.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Prayer', exact: true }).click();
  await page.getByLabel('Include prayers from', { exact: true }).fill('2026-10-29');
  const q = page.getByRole('region', { name: 'Qaza prayer stack', exact: true }),
    n = page.getByRole('region', { name: 'Nafl prayer stack', exact: true });
  await expect(q).toContainText('2026-10-29');
  await q.getByRole('button', { name: 'Complete Qaza', exact: true }).click();
  await page.getByRole('button', { name: 'Routines', exact: true }).first().click();
  await page.getByRole('button', { name: 'Nafl Salah', exact: true }).click();
  await n.getByRole('button', { name: 'Complete Nafl', exact: true }).click();
  await expect(n).toContainText('2 remaining');
  await page.reload();
  await page.getByRole('button', { name: 'Prayer', exact: true }).click();
  await page.getByRole('button', { name: 'Routines', exact: true }).first().click();
  await page.getByRole('button', { name: 'Nafl Salah', exact: true }).click();
  await expect(n).toContainText('2 remaining');
  const snap = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!));
  expect(snap.records.filter((r: any) => r.entity === 'qaza_records' && !r.deleted)).toHaveLength(
    1,
  );
  expect(
    snap.records.filter((r: any) => r.entity === 'routine_completions' && !r.deleted),
  ).toHaveLength(1);
  await page.clock.setFixedTime(new Date('2026-10-31T15:00Z'));
  await page.reload();
  await page.getByRole('button', { name: 'Prayer', exact: true }).click();
  await page.getByRole('button', { name: 'Routines', exact: true }).first().click();
  await page.getByRole('button', { name: 'Nafl Salah', exact: true }).click();
  await expect(n).toContainText('3 remaining');
  await page.getByRole('button', { name: 'Prayer', exact: true }).click();
  await expect(q).toContainText('2026-10-29');
});

test('location detection refreshes the visible fields and preserves the saved city on failure', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 31.5204, longitude: 74.3587 });
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /^Settings/ }).click();
  await page.getByRole('button', { name: /^Location/ }).click();
  await page.getByRole('button', { name: 'Use current location', exact: true }).click();
  await expect(page.locator('input[name="lat"]')).toHaveValue('31.5204');
  await expect(page.locator('input[name="lng"]')).toHaveValue('74.3587');
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (_ok: any, error: any) => error({ message: 'unavailable' }) },
    }),
  );
  await page.getByRole('button', { name: 'Use current location', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Your saved city is unchanged' }),
  ).toBeVisible();
  await expect(page.locator('input[name="lat"]')).toHaveValue('31.5204');
});
