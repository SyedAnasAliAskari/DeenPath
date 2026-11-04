import { test, expect } from '@playwright/test';
async function setup(page: any, draft = false) {
  await page.addInitScript(
    ({ draft }: any) => {
      if (localStorage.getItem('salahguard')) return;
      const library: any = {};
      for (const [r, rarity] of ['common', 'uncommon', 'rare', 'ultra'].entries())
        for (let i = 0; i < 3; i++) {
          const id = '00000000-0000-0000-0000-' + String(r * 3 + i).padStart(12, '0');
          library[id] = {
            id,
            title: 'Synthetic story ' + r + ' ' + i,
            category: 'fixture',
            rarity,
            story:
              'This is a synthetic test card. It makes no historical or religious claim. The third sentence tests the reading view.',
            references: [{ title: 'Fixture source', url: 'https://example.invalid/fixture' }],
            verification: draft ? 'draft' : 'verified',
            status: 'published',
            generationDate: '2026-11-01T00:00:00Z',
            version: 1,
            artId: '11111111-1111-1111-1111-111111111111',
            artVerified: true,
            edition: 2,
            englishReviewed: true,
            urduReviewed: true,
            english:
              'This is a synthetic test card. It makes no historical or religious claim. The third sentence tests the reading view.',
            urdu: 'یہ آزمائشی کہانی ہے۔ اس میں کوئی تاریخی یا مذہبی دعویٰ نہیں ہے۔ یہ صرف زبان اور قاری کی جانچ کے لیے ہے۔',
            titleUrdu: 'آزمائشی کہانی',
          };
        }
      localStorage.setItem(
        'salahguard',
        JSON.stringify({
          schema: 1,
          owner: null,
          records: [],
          queue: [],
          settings: { lang: 'en' },
          economy: { version: 1, balance: 1500, claims: {}, transactions: {} },
          collectibles: {
            version: 1,
            library,
            copies: {},
            packs: {},
            artwork: {
              '11111111-1111-1111-1111-111111111111': {
                mime: 'image/png',
                base64:
                  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
              },
            },
          },
        }),
      );
    },
    { draft },
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /^My Collection/ }).click();
}
test('pack saves before reveal and resumes after closing/reloading without another charge', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Open pack · 500 Gems', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Your three cards', exact: true })).toBeVisible();
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!));
  const ids = Object.keys(snapshot.collectibles.copies);
  expect(ids).toHaveLength(3);
  expect(snapshot.economy.balance).toBe(1000);
  expect(ids.every((id) => !snapshot.collectibles.copies[id].revealed)).toBe(true);
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /^My Collection/ }).click();
  await page.getByRole('button', { name: 'Continue pack · 0 / 3 revealed' }).click();
  await page.getByRole('button', { name: 'Skip Animation', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal card 1', exact: true }).click();
  await page.getByRole('button', { name: 'Read story', exact: true }).click();
  await expect(page.locator('.story-prose')).toContainText('This is a synthetic test card.');
  await page.getByRole('button', { name: 'اردو', exact: true }).click();
  await expect(page.locator('.story-reader-page')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.story-prose')).toContainText('آزمائشی');
  await page.screenshot({ path: '.tools/reader-urdu.png' });
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal card 2', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal card 3', exact: true }).click();
  await page.getByRole('button', { name: 'View collection', exact: true }).click();
  await expect(page.locator('.collectible-tile')).toHaveCount(3);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!));
  expect(Object.keys(after.collectibles.copies)).toEqual(ids);
  expect(after.economy.balance).toBe(1000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.tools/collectibles-shelf.png', fullPage: true });
});
test('unverified cards never enable a pack purchase', async ({ page }) => {
  await setup(page, true);
  await expect(
    page.getByRole('button', { name: 'Open pack · 500 Gems', exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!).economy.balance),
  ).toBe(1500);
});

test('tap and swipe packet opening preserve ownership and nested Back returns to the pack', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Open pack · 500 Gems', exact: true }).click();
  const packet = page.getByRole('button', { name: 'Tear open DeenPath packet' }),
    box = (await packet.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 20, box.y + 30, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Reveal card 1', exact: true }).click();
  await page.getByRole('button', { name: 'Read story', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('deenpath:back', { cancelable: true })));
  await expect(page.getByRole('dialog', { name: 'Your three cards', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tear open DeenPath packet' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open pack · 500 Gems', exact: true }).click();
  await page.getByRole('button', { name: 'Tear open DeenPath packet' }).click();
  await expect(page.getByRole('button', { name: 'Reveal card 1', exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!));
  expect(saved.economy.balance).toBe(500);
  expect(Object.keys(saved.collectibles.copies)).toHaveLength(6);
});
test('owned stories remain readable offline, searchable and adjustable on a narrow screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await page.getByRole('button', { name: 'Open pack · 500 Gems', exact: true }).click();
  await page.getByRole('button', { name: 'Skip Animation', exact: true }).click();
  await page.getByRole('button', { name: 'View collection', exact: true }).click();
  await page.context().setOffline(true);
  const first = page.locator('.collectible-tile').first(),
    title = await first.locator('h3').innerText();
  await page.getByLabel('Search stories', { exact: true }).fill(title);
  await expect(page.locator('.collectible-tile')).toHaveCount(1);
  await page.getByLabel('Category', { exact: true }).selectOption('fixture');
  await first.getByRole('button', { name: 'Read story: ' + title, exact: true }).click();
  await expect(page.locator('.story-prose')).toContainText('synthetic test card');
  for (let i = 0; i < 11; i++)
    await page.getByRole('button', { name: 'Larger text', exact: true }).click();
  await expect(page.locator('.story-reader-page')).toHaveCSS('font-size', '30px');
  await page.getByRole('button', { name: 'اردو', exact: true }).click();
  await expect(page.locator('.story-reader-page')).toHaveAttribute('lang', 'ur');
  await page.getByRole('button', { name: 'Play narration', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Android app');
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  await expect(page.getByLabel('Search stories', { exact: true })).toHaveValue(title);
  await first.getByRole('button', { name: 'Read story: ' + title, exact: true }).click();
  await expect(page.locator('.story-reader-page')).toHaveAttribute('lang', 'ur');
  await expect(page.locator('.story-reader-page')).toHaveCSS('font-size', '30px');
  expect(await page.locator('.story-reader').evaluate((el) => el.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '.tools/reader-narrow-large-text.png' });
});
