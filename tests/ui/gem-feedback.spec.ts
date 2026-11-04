import { test, expect } from '@playwright/test';
test('Qaza and on-time prayer receipts show real Gems; snooze never earns', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-30T07:30:00Z') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Prayer', exact: true }).click();
  await page
    .locator('.today-prayer')
    .first()
    .getByRole('button', { name: 'Complete Qaza', exact: true })
    .click();
  await expect(page.getByText('Qaza Completed ✓ +8 Gems', { exact: true })).toBeVisible();
  await expect(page.locator('.gem-balance')).toContainText('8');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  const current = page
    .locator('.prayer-card')
    .filter({ has: page.getByRole('heading', { name: 'Jummah', exact: true }) });
  await current.getByRole('button', { name: 'Record prayer', exact: true }).click();
  await page.getByRole('button', { name: 'Remind me later', exact: true }).click();
  await expect(page.locator('.gem-balance')).toContainText('8');
  await current.getByRole('button', { name: 'Record prayer', exact: true }).click();
  await page.getByRole('button', { name: 'I prayed', exact: true }).click();
  await expect(page.getByText('Dhuhr Completed ✓ +10 Gems', { exact: true })).toBeVisible();
  await expect(page.locator('.gem-balance')).toContainText('18');
});
test('Gems controls stay separate at narrow widths and large text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.locator('.gem-balance').click();
  await page.addStyleTag({ content: 'html {font-size: 200%}' });
  const studio = page.getByRole('button', { name: 'Open Theme Studio', exact: true }),
    history = page.getByRole('button', { name: 'History', exact: true });
  await expect(studio).toBeVisible();
  await expect(history).toBeVisible();
  const a = (await studio.boundingBox())!,
    b = (await history.boundingBox())!;
  expect(a.x + a.width).toBeLessThanOrEqual(b.x - 8);
  expect(Math.abs(a.y + a.height / 2 - (b.y + b.height / 2))).toBeLessThan(2);
  expect(b.x + b.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: '.tools/gems-narrow-large-text.png' });
});
