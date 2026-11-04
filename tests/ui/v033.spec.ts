import { test, expect } from '@playwright/test';

test('due reminder opens and snoozes without a completion or report change', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-30T07:30:00Z') });
  await page.goto('/');
  const row = page
    .locator('.prayer-card')
    .filter({ has: page.getByRole('heading', { name: 'Jummah', exact: true }) });
  await row.getByRole('button', { name: 'Record prayer', exact: true }).click();
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('salahguard') || '{"records":[],"queue":[]}'),
  );
  await expect(page.getByRole('dialog')).toBeVisible();
  const box = await page.getByRole('dialog').boundingBox();
  expect(box!.x).toBe(0); expect(box!.y).toBe(0);
  expect(box!.width).toBe(page.viewportSize()!.width); expect(box!.height).toBe(page.viewportSize()!.height);
  await page.getByRole('button', { name: 'Remind me later', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('salahguard') || '{"records":[],"queue":[]}'),
  );
  expect(after.records).toEqual(before.records);
  expect(after.queue).toEqual(before.queue);
  await page.getByRole('button', { name: 'Prayer', exact: true }).click();
  await expect(page.locator('.today-prayer.pending')).toHaveCount(1);
  await expect(page.locator('.today-prayer.pending .live-time')).toHaveText(/\d{2}:\d{2}:\d{2}/);
});

test('specific Qaza completes once offline, survives reload and appears in actual calendar records', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-30T07:30:00Z') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Prayer', exact: true }).click();
  await page
    .locator('.today-prayer')
    .first()
    .getByRole('button', { name: 'Complete Qaza', exact: true })
    .click();
  await expect(page.locator('.today-prayer').first()).toContainText('Qaza Done');
  let data = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!));
  expect(data.records.filter((r: any) => r.entity === 'qaza_records')).toHaveLength(1);
  expect(
    data.records.find((r: any) => r.id === '2026-10-30:Fajr' && r.entity === 'prayer_records').data
      .completedAt,
  ).toBeUndefined();
  await page.reload();
  await page.getByRole('button', { name: 'Prayer', exact: true }).click();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.locator('.prayer-calendar button').filter({ hasText: /^30$/ }).click();
  await expect(page.locator('.today-prayer').first()).toContainText('Qaza Done');
  data = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!));
  expect(data.records.filter((r: any) => r.entity === 'qaza_records')).toHaveLength(1);
});

test('window expiration changes the display without completing worship', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-30T07:30:00Z') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Prayer', exact: true }).click();
  await expect(page.locator('.today-prayer.pending')).toHaveCount(1);
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('salahguard') || '{"records":[]}').records,
  );
  await page.clock.fastForward(10 * 3600000);
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem('salahguard') || '{"records":[]}').records,
  );
  expect(after).toEqual(before);
  await expect(page.locator('.today-prayer').first()).toContainText('Unrecorded');
});

for (const lang of ['en', 'ur', 'ar'])
  test('five tabs, large text and responsive report: ' + lang, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.addInitScript(
      (lang) =>
        localStorage.setItem(
          'salahguard',
          JSON.stringify({
            schema: 1,
            records: [],
            queue: [],
            settings: { lang, appearance: 'dark' },
          }),
        ),
      lang,
    );
    await page.goto('/');
    await page.evaluate(() => (document.documentElement.style.fontSize = '22px'));
    for (const tab of ['home', 'prayer', 'routines', 'progress', 'more']) {
      await page
        .locator('.sidebar nav button')
        .nth(['home', 'prayer', 'routines', 'progress', 'more'].indexOf(tab))
        .click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
    }
    await page.locator('.sidebar nav button').nth(1).click();
    await page.locator('.dp-tabs > button').nth(2).click();
    await expect(page.locator('.dp-table tbody tr')).toHaveCount(7);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: 'docs/review-v0.3.3/report-' + lang + '-320.png',
      fullPage: true,
    });
  });

test('saved prayer window survives location changes and explicit completion after the new calculated end', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-30T12:00:00Z') });
  await page.addInitScript(() =>
    localStorage.setItem(
      'salahguard',
      JSON.stringify({
        schema: 1,
        owner: null,
        records: [
          {
            id: '2026-10-30:Dhuhr',
            entity: 'prayer_records',
            version: 0,
            data: {
              day: '2026-10-30',
              prayer: 'Dhuhr',
              windowStart: '2026-10-30T07:00:00.000Z',
              windowEnd: '2026-10-30T15:00:00.000Z',
              timezone: 'Asia/Karachi',
            },
          },
        ],
        queue: [],
        settings: { lang: 'en', trackingStart: '2026-10-30' },
      }),
    ),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Prayer', exact: true }).click();
  const row = page
    .locator('.today-prayer')
    .filter({ has: page.getByRole('heading', { name: 'Jummah', exact: true }) });
  await expect(row).toContainText('8:00 PM');
  await row.getByRole('button', { name: 'I Prayed', exact: true }).click();
  await expect(row).toContainText('On Time');
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('salahguard')!).records.find(
        (r: any) => r.id === '2026-10-30:Dhuhr',
      ).data,
  );
  expect(saved.windowEnd).toBe('2026-10-30T15:00:00.000Z');
  expect(saved.completedAt).toBeDefined();
  expect(saved.qazaAt).toBeUndefined();
});

test('changing a primary tab resets its scroll position and Back from Today returns Home', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
  );
  await page.getByRole('button', { name: 'Prayer', exact: true }).click();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('deenpath:back', { cancelable: true })),
  );
  await expect(page.locator('.prayer-hero')).toBeVisible();
});
