import { test, expect } from '@playwright/test';
async function more(page: any, name: string) {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: new RegExp('^' + name) }).click();
}
test('production navigation removes debugging and duplicate destinations', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-31T07:00Z'));
  await page.addInitScript(() =>
    localStorage.setItem(
      'salahguard',
      JSON.stringify({
        schema: 1,
        owner: null,
        records: [],
        queue: [],
        settings: { hijriAdjustment: 1, lang: 'en' },
      }),
    ),
  );
  await page.goto('/');
  await expect(page.getByText('20 Jumada al-Awwal 1448 AH', { exact: true })).toBeVisible();
  const avatar = page.locator('button.avatar');
  await expect(avatar.locator('svg')).toBeVisible();
  await page.getByRole('button', { name: 'Prayer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nafl Salah', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await page.getByRole('button', { name: 'My Collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Collection', exact: true })).toBeVisible();
  await more(page, 'Settings');
  await page.getByRole('button', { name: /^Reminders & sound$/ }).click();
  await expect(
    page.getByRole('button', { name: /Test notification|Test Enforcer|Cancel test/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /sync/i }).click();
  await expect(page.locator('input[name="api"]')).toHaveCount(0);
});
test('routine upload is linked directly without reference or file dropdowns', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Routines', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add routine', exact: true }).click();
  const form = page.getByRole('dialog');
  await expect(form.locator('select[name="fileId"]')).toHaveCount(0);
  await expect(form.locator('select[name="contentRef"]')).toHaveCount(0);
  await expect(form.getByLabel('Add PDF or image')).toBeVisible();
  await expect(
    form.locator('summary').filter({ hasText: 'Repeat, end date & reminders' }),
  ).toBeVisible();
});
test('Secrets can be deleted along with private history', async ({ page }) => {
  await page.goto('/');
  await more(page, 'Secrets');
  await expect(page.getByRole('button', { name: 'Preview Secrets Enforcer' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add secret', exact: true }).click();
  await page.getByLabel('Secret name', { exact: true }).fill('Temporary private habit');
  await page.getByRole('button', { name: 'Save secret', exact: true }).click();
  await page.getByRole('button', { name: 'No, I avoided it', exact: true }).click();
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete secret', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Temporary private habit' })).toHaveCount(0);
  await expect(page.locator('.secret-card')).toHaveCount(0);
});
test('Qibla current location updates the displayed coordinates and bearing', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 31.5204, longitude: 74.3587 });
  await page.goto('/');
  await more(page, 'Qibla Compass');
  await page.getByRole('button', { name: 'Use current location', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Qibla direction recalculated' }),
  ).toBeVisible();
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!));
  expect(snapshot.settings.lat).toBe(31.5204);
  expect(snapshot.settings.lng).toBe(74.3587);
});

test('About and Contact names the author and opens an email draft', async ({ page }) => {
  await page.goto('/');
  await more(page, 'Settings');
  await page.getByRole('button', { name: 'Help & About', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Help & About' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Syed Anas Ali Askari', exact: true }),
  ).toHaveAttribute('href', 'mailto:syedanasaliaskarivu@gmail.com?subject=DeenPath%20feedback');
  await expect(page.locator('.about-app p')).toHaveCount(9);
  await expect(page.locator('.about-help>section').nth(1)).toContainText('Reminders and Widgets');
  await expect(page.locator('.about-help>section').nth(2)).toContainText('About the app');
  await expect(page.getByRole('link', { name: 'Email Syed Anas' })).toHaveAttribute(
    'href',
    'mailto:syedanasaliaskarivu@gmail.com?subject=DeenPath%20feedback',
  );
});

test('bundled ayat show English and Urdu together inside their routine card', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'salahguard',
      JSON.stringify({
        schema: 1,
        owner: null,
        queue: [],
        settings: { lang: 'en' },
        records: [
          {
            entity: 'routines',
            id: '11111111-1111-4111-8111-111111111111',
            version: 0,
            data: {
              kind: 'quran',
              title: 'Prayer ayah',
              contentRef: '20:14',
              frequency: 'daily',
              startDate: '2026-01-01',
              timezone: 'Asia/Karachi',
              time: '08:00',
              target: 1,
              reminders: false,
            },
          },
        ],
      }),
    ),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Routines', exact: true }).first().click();
  const card = page
    .locator('.practice-card')
    .filter({ has: page.getByRole('heading', { name: 'Prayer ayah', exact: true }) });
  await expect(card.locator('[lang="en"]')).toContainText('establish prayer for My remembrance');
  await expect(card.locator('[lang="ur"]')).toContainText('نماز');
  await expect(card.locator('[lang="en"] small')).toContainText('Saheeh International');
  await page.screenshot({ path: '.tools/v038-bilingual.png', fullPage: true });
});
