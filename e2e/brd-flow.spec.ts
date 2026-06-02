import { expect, test } from '@playwright/test';

test('Generate BRD -> close -> reopen -> reload -> outdated -> discard -> export', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByText('Tiếp nhận tín hiệu ban đầu')).toBeVisible();

  await page.getByRole('button', { name: 'Generate BRD' }).click();

  await expect(page.getByRole('heading', { name: 'AI BRD Draft' })).toBeVisible();
  await page.getByRole('button', { name: 'BRD Draft', exact: true }).click();

  const textarea = page.getByPlaceholder('BRD draft sẽ xuất hiện ở đây sau khi generate.');
  await expect(textarea).not.toHaveValue('', { timeout: 10_000 });
  await textarea.fill('# BRD da sua\n\nNoi dung da duoc chinh sua.');
  await expect(textarea).toHaveValue('# BRD da sua\n\nNoi dung da duoc chinh sua.');

  await page.getByRole('button', { name: 'Đóng panel' }).click();
  await expect(page.getByRole('heading', { name: 'AI BRD Draft' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Open last BRD draft' }).click();
  await expect(textarea).toHaveValue('# BRD da sua\n\nNoi dung da duoc chinh sua.');

  await page.reload();
  await page.getByRole('button', { name: 'Open last BRD draft' }).click();
  await page.getByRole('button', { name: 'BRD Draft', exact: true }).click();
  await expect(textarea).toHaveValue('# BRD da sua\n\nNoi dung da duoc chinh sua.');

  await page.getByRole('button', { name: 'Reset mẫu' }).click();
  await expect(page.getByText('Outdated', { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export markdown' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('diagram-brd-draft.md');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Discard cached BRD' }).click();
  await expect(page.getByRole('button', { name: 'Open last BRD draft' })).toBeDisabled();
});

test('Local pre-validation blocks invalid diagram before backend validation', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  let validateRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/brd/validate')) {
      validateRequests += 1;
    }
  });

  await page.getByRole('button', { name: 'Xoá nội dung' }).click();
  await page.getByRole('button', { name: 'Generate BRD' }).click();

  await expect(page.getByText('START_REQUIRED')).toBeVisible();
  await expect(page.getByText('END_REQUIRED')).toBeVisible();
  expect(validateRequests).toBe(0);
});
