import { test, expect } from '@playwright/test';
test('Gems and Theme Studio persist; previews are free and each application is charged', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('salahguard')) return;
    localStorage.setItem(
      'salahguard',
      JSON.stringify({
        schema: 1,
        owner: null,
        records: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            entity: 'qaza_history',
            version: 0,
            deleted: false,
            data: {
              prayer: 'Fajr',
              quantity: 400,
              origin: 'previous',
              completed: [
                {
                  id: '22222222-2222-2222-2222-222222222222',
                  at: '2026-11-01T10:00:00Z',
                  quantity: 400,
                },
              ],
            },
          },
        ],
        queue: [],
        settings: { lang: 'en' },
      }),
    );
  });
  await page.goto('/');
  await expect(page.locator('.gem-balance')).toContainText('3,200');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /^Theme Studio/ }).click();
  await page.getByRole('button', { name: 'Unlock · 1,000 Gems', exact: true }).click();
  await expect(page.locator('.gem-balance')).toContainText('2,200');
  const colors = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Colors', exact: true }) });
  await colors.getByLabel('Primary color').fill('#ffff00');
  await colors.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Theme preview' })).toBeVisible();
  await expect(page.locator('.gem-balance')).toContainText('2,200');
  await page.getByRole('button', { name: 'Close preview' }).click();
  await colors.getByRole('button', { name: 'Apply · 50 Gems', exact: true }).click();
  await expect(page.locator('.gem-balance')).toContainText('2,150');
  await colors.getByRole('button', { name: 'Apply · 50 Gems', exact: true }).click();
  await expect(page.locator('.gem-balance')).toContainText('2,100');
  await page.getByRole('button', { name: 'Default dark · Free' }).click();
  await expect(page.locator('.gem-balance')).toContainText('2,100');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.tools/expansion-theme-studio.png', fullPage: true });
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!));
  expect(snapshot.economy.balance).toBe(2100);
  expect(Object.keys(snapshot.economy.orders)).toHaveLength(4);
  await page.reload();
  await expect(page.locator('.gem-balance')).toContainText('2,100');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /^Theme Studio/ }).click();
  await expect(page.getByRole('heading', { name: 'Colors', exact: true })).toBeVisible();
});

test('wallpaper selection previews, replaces and removes without spending or saving until Apply', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'salahguard',
      JSON.stringify({
        schema: 1,
        owner: null,
        records: [],
        queue: [],
        settings: { lang: 'en' },
        economy: { version: 1, balance: 1500, claims: {}, transactions: {}, studioUnlocked: true },
      }),
    ),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /^Theme Studio/ }).click();
  const wall = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Wallpapers', exact: true }) });
  const picker = wall.locator('input[type=file]');
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  await picker.setInputFiles({ name: 'First image.png', mimeType: 'image/png', buffer: bytes });
  await expect(wall.getByRole('img', { name: 'Selected wallpaper preview' })).toBeVisible();
  await expect(wall).toContainText('First image.png');
  await wall.getByRole('button', { name: 'Preview', exact: true }).click();
  expect(
    await page.locator('.theme-sample').evaluate((e) => getComputedStyle(e).backgroundImage),
  ).toContain('blob:');
  await page.getByRole('button', { name: 'Close preview' }).click();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!).localFiles || []),
  ).toHaveLength(0);
  await expect(page.locator('.gem-balance')).toContainText('1,500');
  await picker.setInputFiles({ name: 'Replacement.png', mimeType: 'image/png', buffer: bytes });
  await expect(wall).toContainText('Replacement.png');
  await expect(wall).not.toContainText('First image.png');
  await wall.getByRole('button', { name: 'Remove selection' }).click();
  await expect(wall.getByRole('img',{name:'Selected wallpaper preview'})).toHaveCount(0);
  await picker.setInputFiles({ name: 'Apply.png', mimeType: 'image/png', buffer: bytes });
  await wall.getByRole('button', { name: 'Apply · 100 Gems', exact: true }).click();
  await expect(page.locator('.gem-balance')).toContainText('1,400');
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!));
  expect(state.localFiles).toHaveLength(1);
  expect(state.economy.theme.wallpaper.fileId).toBe(state.localFiles[0].id);
  await page.screenshot({ path: '.tools/wallpaper-selection.png', fullPage: true });
});
