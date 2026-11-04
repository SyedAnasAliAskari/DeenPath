import { test, expect } from '@playwright/test';

test('settings shows a short menu and only opens the chosen category', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /^Settings/ }).click();
  await expect(page.locator('.settings-menu-row')).toHaveCount(6);
  await expect(page.locator('.settings-card:visible')).toHaveCount(0);
  await page.getByRole('button', { name: /^Reminders & sound$/i }).click();
  await expect(page.locator('.settings-card:visible')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Test notification', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Gentle')).not.toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.settings-menu')).toBeVisible();
});

test('routine form exposes only relevant fields without losing typed text', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Routines', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add routine', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Routine name').fill('A peaceful reading');
  await expect(dialog.locator('input[name="weekday"]')).toHaveCount(0);
  await expect(dialog.locator('textarea[name="dhikr"]')).toHaveCount(0);
  await dialog.getByLabel('Frequency', { exact: true }).selectOption('weekly');
  await expect(dialog.locator('input[name="weekday"]')).toBeVisible();
  await expect(dialog.getByLabel('Routine name')).toHaveValue('A peaceful reading');
  await dialog.getByLabel('Frequency', { exact: true }).selectOption('weekdays');
  await expect(dialog.getByLabel('Monday', { exact: true })).toBeChecked();
});

test('small RTL dialogs keep a 44px close control on the physical right with no collisions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(() =>
    localStorage.setItem(
      'salahguard',
      JSON.stringify({
        schema: 1,
        records: [],
        queue: [],
        settings: { lang: 'ar', appearance: 'dark' },
      }),
    ),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'الأوراد', exact: true }).click();
  await page.getByRole('button', { name: 'إضافة ورد', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect((await dialog.locator('input[name="startDate"]').boundingBox())!.width).toBeGreaterThan(
    200,
  );
  const boxes = await dialog.evaluate((n) => {
    const d = n.getBoundingClientRect(),
      c = n.querySelector('.close')!.getBoundingClientRect(),
      title = n.querySelector('h2')!.getBoundingClientRect();
    return {
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      gap: d.right - c.right,
      closeWidth: c.width,
      closeBottom: c.bottom,
      titleTop: title.top,
    };
  });
  expect(boxes.scroll).toBeLessThanOrEqual(boxes.width);
  expect(boxes.gap).toBeGreaterThanOrEqual(8);
  expect(boxes.gap).toBeLessThanOrEqual(16);
  expect(boxes.closeWidth).toBeGreaterThanOrEqual(44);
  expect(boxes.closeBottom).toBeLessThanOrEqual(boxes.titleTop);
  await page.screenshot({ path: '.tools/v031/review/after-05-dialog-rtl-dark.png' });
  await dialog.locator('.close').click();
  await expect(dialog).toHaveCount(0);
});

test('prayer rows fit badges and actions at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  const bounds = await page.locator('.prayer-card').evaluateAll((cards) =>
    cards.map((n) => {
      const p = n.getBoundingClientRect(),
        s = n.querySelector('.prayer-status')!.getBoundingClientRect(),
        b = n.querySelector('.prayer-action')!.getBoundingClientRect();
      return {
        inside: s.left >= p.left && s.right <= p.right,
        overlap: b.width > 0 && s.right > b.left && s.bottom > b.top && s.top < b.bottom,
      };
    }),
  );
  expect(bounds.every((b) => b.inside && !b.overlap)).toBe(true);
});
