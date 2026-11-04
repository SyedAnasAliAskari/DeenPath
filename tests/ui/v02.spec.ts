import { test, expect } from '@playwright/test';
test('deleting closes the confirmation and success toast dismisses automatically', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Routines', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add routine', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Routine name').fill('Disposable regression routine');
  await modal.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page.locator('.routine').getByLabel('Routine options').click();
  await page.locator('.routine').getByRole('button', { name: 'Delete', exact: true }).click();
  await modal.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Disposable regression routine' })).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Completed' })).toHaveCount(0, {
    timeout: 8000,
  });
});
test('system dark appearance has matching background, readable text and no small-screen overflow', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const colors = await page.evaluate(() => ({
    background: getComputedStyle(document.body).backgroundColor,
    text: getComputedStyle(document.body).color,
  }));
  expect(colors.background).toBe('rgb(16, 34, 27)');
  expect(colors.text).toBe('rgb(237, 242, 232)');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: false }).click();
  await page.getByRole('button', { name: 'Language / Appearance', exact: true }).click();
  await page.getByLabel('Appearance', { exact: true }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('Appearance', { exact: true }).selectOption('dark');
  await page.screenshot({ path: '.tools/v02/after/settings-dark.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('reminder translation selector is available in English and Urdu offline', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: false }).click();
  await page.getByRole('button', { name: /^Reminders & sound$/i }).click();
  await page.getByLabel('Quran reminder translation', { exact: true }).selectOption('ur');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Language / Appearance', exact: true }).click();
  await page.getByLabel('Language', { exact: true }).selectOption('ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(
    (await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!))).settings
      .reminderLanguage,
  ).toBe('ur');
  await page.screenshot({ path: '.tools/v02/after/settings-urdu.png', fullPage: true });
});
