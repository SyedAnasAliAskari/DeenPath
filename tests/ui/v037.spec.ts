import { test, expect } from '@playwright/test';
test('timed reminder phases have editable 15/10/1 defaults and no app-opening setup', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: /^Settings/ }).click();
  await page.getByRole('button', { name: 'Reminders & sound', exact: true }).click();
  await expect(page.getByLabel('Early interval (minutes)', { exact: true })).toHaveValue('15');
  await expect(page.getByLabel('Middle interval (minutes)', { exact: true })).toHaveValue('10');
  await expect(page.getByLabel('Final interval (minutes)', { exact: true })).toHaveValue('1');
  await page.getByLabel('Early interval (minutes)', { exact: true }).selectOption('5');
  await page.getByLabel('Middle phase starts at (%)', { exact: true }).fill('40');
  await page.getByLabel('Reminder theme', { exact: true }).selectOption('forgiveness');
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('salahguard')!).settings);
  expect(s.reminderRepeat.gentle).toBe(5);
  expect(s.reminderMiddlePercent).toBe(40);
  expect(s.reminderTheme).toBe('forgiveness');
  await expect(page.getByText('Allow Usage Access', { exact: true })).toHaveCount(0);
});
