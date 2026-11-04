import { test, expect, type Page } from '@playwright/test';
async function more(page: Page, name: string) {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: new RegExp('^' + name) }).click();
}
test('prayer report keeps unknown entries separate and previous Qaza outside period totals', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Prayer', exact: true }).click();
  await page.getByRole('button', { name: 'Prayer Report', exact: true }).click();
  await page.locator('summary').filter({ hasText: 'Tracking period' }).click();
  await page.getByLabel('Tracking start date', { exact: true }).fill('2026-10-01');
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: 'Fajr', exact: true }) });
  const total = await row.locator('td').first().innerText();
  await page.getByRole('button', { name: 'Add Previous Qaza', exact: true }).click();
  await page.getByLabel('Quantity', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Pending Qaza', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pending Qaza: 10', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Prayer Report', exact: true }).click();
  await expect(row.locator('td').first()).toHaveText(total);
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!));
  expect(snapshot.records.filter((r: any) => r.entity === 'qaza_history')).toHaveLength(1);
  expect(snapshot.records.filter((r: any) => r.entity === 'prayer_records')).toHaveLength(0);
  await page.screenshot({ path: '.tools/v03/prayer-report.png', fullPage: true });
});
test('Secrets creates one public penalty without persisting private admissions', async ({
  page,
}) => {
  await page.goto('/');
  await more(page, 'Secrets');
  await page.getByRole('button', { name: 'Add secret', exact: true }).click();
  await page.getByLabel('Secret name', { exact: true }).fill('Personal habit');
  await page.getByLabel('Tasbih text', { exact: true }).fill('Chosen dhikr');
  await page.getByRole('button', { name: 'Save secret', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, I did', exact: true }).click();
  await expect(
    page.getByText('Penalty added. A fresh start is possible.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Correct today’s answer', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, I did', exact: true }).click();
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!));
  expect(
    snapshot.records.filter(
      (r: any) => r.entity === 'routines' && r.data.secretPenalty && !r.deleted,
    ),
  ).toHaveLength(1);
  expect(JSON.stringify(snapshot)).not.toContain('Personal habit');
});
test('learning completion persists and Guidance requires the full notice', async ({ page }) => {
  await page.goto('/');
  await more(page, 'Islamic Learning');
  await page.getByRole('button', { name: /^Prayer and remembrance/ }).click();
  await page.getByRole('button', { name: 'Mark lesson complete', exact: true }).click();
  await page.getByRole('button', { name: 'Ask Guidance a follow-up', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Islamic Guidance Notice', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'I understand', exact: true }).click();
  await expect(page.getByLabel('Your question', { exact: true })).toHaveValue(/20:14/);
  await page.getByRole('button', { name: 'AI connection & privacy', exact: true }).click();
  await expect(page.getByText(/Google Sign-In alone/)).toBeVisible();
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!));
  expect(snapshot.records.some((r: any) => r.entity === 'learning_progress')).toBe(true);
  await page.screenshot({ path: '.tools/v03/guidance.png', fullPage: true });
});
test('calendar and Qibla use honest no-sensor fallback at 320px and in dark mode', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await more(page, 'Qibla Compass');
  await expect(page.getByText(/No live compass here/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.tools/v03/qibla-dark.png', fullPage: true });
  await more(page, 'Hijri Calendar');
  await page.getByRole('button', { name: /Next month/ }).click();
  expect([29, 30]).toContain(await page.locator('.dp-calendar button').count());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
