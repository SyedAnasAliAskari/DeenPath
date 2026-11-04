import { test, expect, type Page } from '@playwright/test';
const back = (page: Page) =>
  page.evaluate(() => window.dispatchEvent(new CustomEvent('deenpath:back', { cancelable: true })));
async function openMore(page: Page, name: string) {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: new RegExp('^' + name) }).click();
}

test('Back closes a modal, backs out of a settings category, then returns to its originating More screen', async ({
  page,
}) => {
  await page.goto('/');
  await openMore(page, 'Settings');
  await page.getByRole('button', { name: 'Your account', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await back(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.settings-card:visible')).toHaveCount(1);
  await back(page);
  await expect(page.locator('.settings-menu')).toBeVisible();
  await back(page);
  await expect(page.getByRole('heading', { name: 'More', exact: true })).toBeVisible();
});

test('Dua text and a new attachment save together and can be read after reload', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Routines', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add routine', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Routine name').fill('My evening Dua');
  await dialog.locator('select[name="kind"]').selectOption('dua');
  await dialog.getByLabel('Write your Dua').fill('My own daily Dua\nA second line');
  await dialog.getByLabel('Add PDF or image').setInputFiles({
    name: 'dua.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF'),
  });
  await expect(dialog.locator('input[name="fileId"]')).not.toHaveValue('');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Routines', exact: true }).first().click();
  const card = page.locator('.routine').filter({ hasText: 'My evening Dua' });
  await card.getByRole('button', { name: 'Read', exact: true }).click();
  await expect(page.locator('.dua-reading')).toHaveText('My own daily Dua\nA second line');
  await expect(page.getByRole('button', { name: 'Open attached file' })).toBeVisible();
  await back(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await card.getByLabel('Routine options').click();
  await card.getByRole('button', { name: 'Edit routine', exact: true }).click();
  await expect(page.getByLabel('Write your Dua')).toHaveValue('My own daily Dua\nA second line');
  await expect(page.locator('.attachment-chip')).toContainText('dua.pdf');
});

test('Secrets opens security separately and Back returns to Secrets', async ({ page }) => {
  await page.goto('/');
  await openMore(page, 'Secrets');
  await page.getByRole('button', { name: 'Security', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Security and recovery', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add activity', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Secrets', exact: true })).toBeVisible();
});

test('Friday Home and prayer report show Jummah with five daily obligations', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-30T07:00:00Z'));
  await page.goto('/');
  await expect(page.locator('.prayer-card h3').filter({ hasText: 'Jummah' })).toHaveCount(1);
  await expect(page.locator('.prayer-card')).toHaveCount(5);
  await page.getByRole('button', { name: 'Prayer', exact: true }).click();
  await page.getByRole('button', { name: 'Prayer Report', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Jummah', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Jummah', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Jummah', exact: true })).toBeVisible();
  await back(page);
  await expect(page.getByRole('button', { name: 'Jummah', exact: true })).toBeVisible();
});

test('Qibla and Travel controls remain spaced at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  for (const name of ['Qibla Compass', 'Travel Mode']) {
    await openMore(page, name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const boxes = await page.locator('.tool-actions > button').evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      }),
    );
    expect(boxes).toHaveLength(2);
    const [a, b] = boxes;
    expect(b.top >= a.bottom + 12 || b.left >= a.right + 12).toBe(true);
  }
});
