import { expect, test, type Page } from '@playwright/test';

async function addSupportingParticipant(page: Page) {
  await page
    .getByLabel('Actors / swimlanes (mỗi dòng một actor)')
    .fill('BA / Solution Engineer\nHệ thống nghiệp vụ');
}

async function dragActivityTo(page: Page, target: { x: number; y: number }) {
  const activity = page.locator('.dnd-item', { hasText: 'Activity' });
  const source = await activity.boundingBox();
  expect(source).not.toBeNull();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 10 });
  await page.mouse.up();
}

async function getActivityBoxes(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('foreignObject'))
      .map((el) => {
        const text = el.textContent ?? '';
        const rect = el.getBoundingClientRect();
        return {
          text,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((item) => item.text.includes('Activity')),
  );
}

test('Dragging from node text moves the whole shape', async ({ page }) => {
  await page.goto('/');

  const label = page.locator('foreignObject', { hasText: 'Mở nhật ký sự cố' }).first();
  await expect(label).toBeVisible();
  const before = await label.boundingBox();
  expect(before).not.toBeNull();

  const start = {
    x: before!.x + before!.width / 2,
    y: before!.y + before!.height / 2,
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 80, start.y + 40, { steps: 10 });
  await page.mouse.up();

  const after = await label.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.x - before!.x).toBeGreaterThan(40);
  expect(after!.y - before!.y).toBeGreaterThan(20);
});

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

test('Dragged shapes keep horizontal placement inside lane instead of recentering', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Xoá nội dung' }).click();

  const canvas = await page.locator('.lf-graph').boundingBox();
  expect(canvas).not.toBeNull();

  await dragActivityTo(page, { x: canvas!.x + 520, y: canvas!.y + 180 });
  await dragActivityTo(page, { x: canvas!.x + 670, y: canvas!.y + 260 });

  const dropped = await getActivityBoxes(page);
  expect(dropped).toHaveLength(2);
  expect(Math.abs(dropped[0].x - dropped[1].x)).toBeGreaterThan(80);

  await page.mouse.move(
    dropped[0].x + dropped[0].width / 2,
    dropped[0].y + dropped[0].height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    dropped[0].x + dropped[0].width / 2 + 90,
    dropped[0].y + dropped[0].height / 2 + 25,
    { steps: 10 },
  );
  await page.mouse.up();

  const moved = await getActivityBoxes(page);
  expect(moved).toHaveLength(2);
  expect(moved[0].x - dropped[0].x).toBeGreaterThan(50);
});

test('Import XML fixture and export XML from toolbar', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('input[accept=".xml,text/xml,application/xml"]')
    .setInputFiles('examples/bomb.drawio.xml');

  await expect(page.getByText('Nhân sự vận hành CCTV')).toBeVisible();
  await expect(page.getByText('Có vị trí nghi vấn cụ thể?')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export XML' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('diagram.drawio.xml');
});

test('Generate use case drafts -> approve -> close -> reopen', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Không gian use case' }).click();
  await expect(page.getByRole('heading', { name: 'Không gian use case', exact: true })).toBeVisible();

  await page.getByLabel('Không gian use case').getByRole('button', {
    name: 'Sinh use case',
  }).click();

  await expect(page.getByText('Use case đã sẵn sàng để rà soát và đi tiếp sang sơ đồ')).toBeVisible();
  await expect(page.getByRole('button', { name: /Use case/ })).toBeVisible();
  await expect(page.getByText('Danh sách use case đã sinh')).toBeVisible();
  await expect(page.getByText('Bản nháp theo rule')).toBeVisible();
  await expect(
    page.getByText('Kết quả được tạo theo rule và cần được rà soát trước khi phê duyệt.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Phê duyệt tất cả' })).toBeVisible();

  await page.getByRole('button', { name: 'Phê duyệt tất cả' }).click();
  await expect(page.getByRole('button', { name: 'Mở ở vùng sơ đồ' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Mở ở vùng sơ đồ' }).first().click();
  await expect(page.getByText('Sơ đồ theo từng use case')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo sơ đồ' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Tạo sơ đồ' }).first().click();
  await expect(page.getByRole('heading', { name: 'Không gian use case', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Use case đang gắn với canvas')).toBeVisible();
  await expect(page.getByText('Canvas hiện tại đang gắn với use case này')).toBeVisible();
  await expect(page.getByText('Tiếp nhận tín hiệu ban đầu')).toHaveCount(0);

  await page.getByRole('button', { name: 'Mở vùng sơ đồ' }).click();
  await expect(page.getByText('Use case đã sẵn sàng để rà soát và đi tiếp sang sơ đồ')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở canvas' }).first()).toBeVisible();
});

test('Use-case generation controls and source label fit a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Không gian use case' }).click();

  await expect(page.getByRole('button', { name: 'Theo hệ thống' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ưu tiên AI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Theo rule' })).toBeVisible();
  await page.getByRole('button', { name: 'Sinh use case' }).click();
  await expect(page.getByText('Bản nháp theo rule')).toBeVisible();

  const horizontalOverflow = await page
    .getByRole('complementary', { name: 'Không gian use case' })
    .evaluate((panel) => panel.scrollWidth > panel.clientWidth);
  expect(horizontalOverflow).toBe(false);
});

test('Use case intake keeps advanced and deprecated fields out of the primary flow', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Không gian use case' }).click();

  await expect(page.getByLabel('Tên chức năng')).toBeVisible();
  await expect(page.getByLabel('Mô tả chức năng')).toBeVisible();
  await expect(page.getByLabel('Actors / swimlanes (mỗi dòng một actor)')).toBeVisible();
  await expect(page.getByLabel('Kết quả mong muốn')).toBeVisible();
  await expect(page.getByText('Tên function')).toHaveCount(0);
  await expect(page.getByText(/Thuật ngữ/)).toHaveCount(0);
  await expect(page.getByText('Thông tin bổ sung')).toHaveCount(0);

  await page.getByRole('button', { name: 'Sinh use case' }).click();
  await expect(page.getByText('Danh sách use case đã sinh')).toBeVisible();
});

test('Structured step edits become the generated diagram source', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Không gian use case' }).click();
  await page.getByRole('button', { name: 'Sinh use case' }).click();

  const firstCard = page.locator('.usecase-card').first();
  await firstCard.getByRole('button', { name: 'Thêm bước', exact: true }).click();
  await firstCard
    .locator('.usecase-card__flow-list .usecase-card__flow-step')
    .last()
    .getByLabel('Hành động')
    .fill('Lưu kết quả bổ sung');
  await page.getByRole('button', { name: 'Phê duyệt tất cả' }).click();
  const useCaseId = await firstCard.getAttribute('data-use-case-id');
  await firstCard.getByRole('button', { name: 'Mở ở vùng sơ đồ' }).click();

  await page
    .getByLabel(`Sơ đồ ${useCaseId}`)
    .getByRole('button', { name: 'Tạo sơ đồ' })
    .click();

  await expect(page.getByText('Lưu kết quả bổ sung')).toBeVisible();
});

test('Diagram inventory keeps focused use case separate from active canvas binding', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Không gian use case' }).click();
  await addSupportingParticipant(page);
  await page.getByRole('button', { name: 'Sinh use case' }).click();
  await page.getByRole('button', { name: 'Phê duyệt tất cả' }).click();

  const useCaseCards = page.locator('.usecase-card');
  await expect(useCaseCards.nth(1)).toBeVisible();
  const useCaseAId = await useCaseCards.nth(0).getAttribute('data-use-case-id');
  const useCaseBId = await useCaseCards.nth(1).getAttribute('data-use-case-id');
  expect(useCaseAId).toBeTruthy();
  expect(useCaseBId).toBeTruthy();

  await useCaseCards.nth(0).getByRole('button', { name: 'Mở ở vùng sơ đồ' }).click();
  const useCaseARow = page.getByLabel(`Sơ đồ ${useCaseAId}`);
  await useCaseARow.getByRole('button', { name: 'Tạo sơ đồ' }).click();

  const canvasContext = page.getByLabel('Use case đang gắn với canvas');
  await expect(canvasContext).toContainText(useCaseAId!);

  await canvasContext.getByRole('button', { name: 'Mở vùng sơ đồ' }).click();
  await page.getByRole('button', { name: /Use case/ }).click();
  await useCaseCards.nth(1).getByRole('button', { name: 'Mở ở vùng sơ đồ' }).click();

  const focusedUseCaseBRow = page.getByLabel(`Sơ đồ ${useCaseBId}`);
  await expect(focusedUseCaseBRow).toHaveAttribute('aria-current', 'true');
  await expect(focusedUseCaseBRow).toContainText('Đang xem trong danh sách');
  await expect(focusedUseCaseBRow).toContainText('Chưa tạo sơ đồ');
  await expect(page.getByLabel(`Sơ đồ ${useCaseAId}`)).toContainText('Đang gắn với canvas');
  await expect(canvasContext).toContainText(useCaseAId!);

  await focusedUseCaseBRow.getByRole('button', { name: 'Tạo sơ đồ' }).click();
  await expect(canvasContext).toContainText(useCaseBId!);
});

test('Semantic diagram edits are preserved as diverged when switching use cases', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Không gian use case' }).click();
  await addSupportingParticipant(page);
  await page.getByRole('button', { name: 'Sinh use case' }).click();
  await page.getByRole('button', { name: 'Phê duyệt tất cả' }).click();

  const useCaseCards = page.locator('.usecase-card');
  await expect(useCaseCards.nth(1)).toBeVisible();
  const useCaseAId = await useCaseCards.nth(0).getAttribute('data-use-case-id');
  const useCaseBId = await useCaseCards.nth(1).getAttribute('data-use-case-id');
  expect(useCaseAId).toBeTruthy();
  expect(useCaseBId).toBeTruthy();

  await useCaseCards.nth(0).getByRole('button', { name: 'Mở ở vùng sơ đồ' }).click();
  await page
    .getByLabel(`Sơ đồ ${useCaseAId}`)
    .getByRole('button', { name: 'Tạo sơ đồ' })
    .click();
  await page.getByRole('button', { name: 'Xoá nội dung' }).click();
  await expect(page.getByLabel('Use case đang gắn với canvas')).toContainText('Sơ đồ đã phân kỳ');

  await page.getByRole('button', { name: 'Mở vùng sơ đồ' }).click();
  const useCaseARow = page.getByLabel(`Sơ đồ ${useCaseAId}`);
  await expect(useCaseARow.getByRole('button', { name: 'Mở bản hiện tại' })).toBeVisible();
  await expect(useCaseARow.getByRole('button', { name: 'Tạo lại sơ đồ' })).toBeVisible();

  await page.getByRole('button', { name: /Use case/ }).click();
  await useCaseCards.nth(1).getByRole('button', { name: 'Mở ở vùng sơ đồ' }).click();
  await page
    .getByLabel(`Sơ đồ ${useCaseBId}`)
    .getByRole('button', { name: 'Tạo sơ đồ' })
    .click();
  await expect(page.getByLabel('Use case đang gắn với canvas')).toContainText(useCaseBId!);

  await page.getByRole('button', { name: 'Mở vùng sơ đồ' }).click();
  await page
    .getByLabel(`Sơ đồ ${useCaseAId}`)
    .getByRole('button', { name: 'Mở bản hiện tại' })
    .click();
  await expect(page.getByLabel('Use case đang gắn với canvas')).toContainText(useCaseAId!);
  await expect(page.getByLabel('Use case đang gắn với canvas')).toContainText('Sơ đồ đã phân kỳ');
});

test('Use case regenerate warns before replacing reviewed drafts', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Không gian use case' }).click();
  await page.getByRole('button', { name: 'Sinh use case' }).click();
  await page.getByRole('button', { name: 'Phê duyệt tất cả' }).click();
  await expect(page.getByRole('button', { name: 'Mở ở vùng sơ đồ' }).first()).toBeVisible();

  await page.getByRole('button', { name: /Đầu vào/ }).click();
  await page.getByText(/Bối cảnh dự án:/).click();
  await page.getByLabel('Mô tả dự án').fill(
    'Nen tang quan ly cu dan va dich vu noi khu, bo sung xu ly tai san.',
  );

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Sinh use case' }).click();
  await page.getByRole('button', { name: /Use case/ }).click();
  await expect(page.getByRole('button', { name: 'Mở ở vùng sơ đồ' }).first()).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Đầu vào/ }).click();
  await page.getByRole('button', { name: 'Sinh use case' }).click();
  await expect(page.getByRole('button', { name: 'Đánh dấu đã rà soát' }).first()).toBeVisible();
});

test('Use case regenerate does not warn after spec is reverted to the generated snapshot', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Không gian use case' }).click();
  await page.getByRole('button', { name: 'Sinh use case' }).click();
  await expect(page.getByRole('button', { name: 'Đánh dấu đã rà soát' }).first()).toBeVisible();

  await page.getByRole('button', { name: /Đầu vào/ }).click();
  await page.getByText(/Bối cảnh dự án:/).click();
  const projectSummary = page.getByLabel('Mô tả dự án');
  const originalSummary = await projectSummary.inputValue();
  await projectSummary.fill(`${originalSummary} Bo sung tam thoi.`);
  await projectSummary.fill(originalSummary);

  let dialogCount = 0;
  page.on('dialog', async (dialog) => {
    dialogCount += 1;
    await dialog.dismiss();
  });

  await page.getByRole('button', { name: 'Sinh use case' }).click();
  await expect(page.getByRole('button', { name: 'Đánh dấu đã rà soát' }).first()).toBeVisible();
  expect(dialogCount).toBe(0);
});

test('Editing an approved use case requires approval again before diagram handoff', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Không gian use case' }).click();
  await page.getByRole('button', { name: 'Sinh use case' }).click();
  await page.getByRole('button', { name: 'Đánh dấu đã rà soát' }).first().click();
  await page.getByRole('button', { name: 'Phê duyệt', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Mở ở vùng sơ đồ' })).toHaveCount(1);

  await page.locator('.usecase-card__title').first().fill('Use case da sua sau phe duyet');

  await expect(page.getByRole('button', { name: 'Mở ở vùng sơ đồ' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Phê duyệt', exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: /Sơ đồ/ }).click();
  await expect(page.getByText('Cần phê duyệt').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở canvas' })).toHaveCount(0);
});

test('Regenerating use cases keeps unmatched diagrams as saved drafts', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Không gian use case' }).click();
  await page.getByRole('button', { name: 'Sinh use case' }).click();
  await page.getByRole('button', { name: 'Phê duyệt tất cả' }).click();

  const firstCard = page.locator('.usecase-card').first();
  const oldUseCaseId = await firstCard.getAttribute('data-use-case-id');
  await firstCard.getByRole('button', { name: 'Mở ở vùng sơ đồ' }).click();
  await page
    .getByLabel(`Sơ đồ ${oldUseCaseId}`)
    .getByRole('button', { name: 'Tạo sơ đồ' })
    .click();
  await page.getByRole('button', { name: 'Xoá nội dung' }).click();

  await page.getByRole('button', { name: 'Mở vùng sơ đồ' }).click();
  await page.getByRole('button', { name: /Đầu vào/ }).click();
  await page.getByText(/Bối cảnh dự án:/).click();
  await page.getByLabel('Tên dự án').fill('Dự án thay thế hoàn toàn');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Sinh use case' }).click();
  await page.getByRole('button', { name: /Sơ đồ/ }).click();

  const orphanedSection = page.locator('.usecase-panel__orphaned');
  await expect(orphanedSection.getByText('Sơ đồ lưu tạm không còn use case nguồn')).toBeVisible();
  await expect(orphanedSection.getByText(oldUseCaseId!)).toBeVisible();
  await expect(orphanedSection.getByRole('button', { name: 'Mở bản lưu' })).toBeVisible();
});

test('Failed diagram regeneration keeps the current diverged workspace openable', async ({
  page,
}) => {
  let diagramRequests = 0;
  await page.route('**/api/diagrams/generate', async (route) => {
    diagramRequests += 1;
    if (diagramRequests === 2) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          request_id: 'req_failed_regenerate',
          status: 'failed',
          error: {
            code: 'TEMPORARY_FAILURE',
            message: 'Tạm thời không thể tạo lại sơ đồ.',
            retryable: true,
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Không gian use case' }).click();
  await page.getByRole('button', { name: 'Sinh use case' }).click();
  await page.getByRole('button', { name: 'Phê duyệt tất cả' }).click();
  const firstCard = page.locator('.usecase-card').first();
  const useCaseId = await firstCard.getAttribute('data-use-case-id');
  await firstCard.getByRole('button', { name: 'Mở ở vùng sơ đồ' }).click();
  await page
    .getByLabel(`Sơ đồ ${useCaseId}`)
    .getByRole('button', { name: 'Tạo sơ đồ' })
    .click();
  await page.getByRole('button', { name: 'Xoá nội dung' }).click();
  await page.getByRole('button', { name: 'Mở vùng sơ đồ' }).click();

  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByLabel(`Sơ đồ ${useCaseId}`)
    .getByRole('button', { name: 'Tạo lại sơ đồ' })
    .click();

  const row = page.getByLabel(`Sơ đồ ${useCaseId}`);
  await expect(row.getByRole('button', { name: 'Mở bản hiện tại' })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Thử tạo lại' })).toBeVisible();
});

test('Lane resize layout survives switching between use-case workspaces', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Không gian use case' }).click();
  await addSupportingParticipant(page);
  await page.getByRole('button', { name: 'Sinh use case' }).click();
  await page.getByRole('button', { name: 'Phê duyệt tất cả' }).click();

  const cards = page.locator('.usecase-card');
  const useCaseAId = await cards.nth(0).getAttribute('data-use-case-id');
  const useCaseBId = await cards.nth(1).getAttribute('data-use-case-id');
  await cards.nth(0).getByRole('button', { name: 'Mở ở vùng sơ đồ' }).click();
  await page
    .getByLabel(`Sơ đồ ${useCaseAId}`)
    .getByRole('button', { name: 'Tạo sơ đồ' })
    .click();

  const laneMeta = page.locator('.lane-toolbar__meta');
  const initialMeta = await laneMeta.textContent();
  const initialWidth = Number(initialMeta?.match(/^(\d+)/)?.[1]);
  const resizeHandle = page.locator('.lane-resize-handle');
  const box = await resizeHandle.boundingBox();
  expect(box).not.toBeNull();
  const startPoint = {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
  };
  await resizeHandle.dispatchEvent('mousedown', {
    button: 0,
    clientX: startPoint.x,
    clientY: startPoint.y,
  });
  await page.evaluate(({ x, y }) => {
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: x + 100,
        clientY: y + 20,
      }),
    );
    window.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        clientX: x + 100,
        clientY: y + 20,
      }),
    );
  }, startPoint);
  await expect(laneMeta).not.toHaveText(new RegExp(`^${initialWidth}\\s`));
  const resizedMeta = await laneMeta.textContent();

  await page.getByRole('button', { name: 'Mở vùng sơ đồ' }).click();
  await page.getByRole('button', { name: /Use case/ }).click();
  await cards.nth(1).getByRole('button', { name: 'Mở ở vùng sơ đồ' }).click();
  await page
    .getByLabel(`Sơ đồ ${useCaseBId}`)
    .getByRole('button', { name: 'Tạo sơ đồ' })
    .click();
  await page.getByRole('button', { name: 'Mở vùng sơ đồ' }).click();
  await page
    .getByLabel(`Sơ đồ ${useCaseAId}`)
    .getByRole('button', { name: 'Mở canvas' })
    .click();

  await expect(laneMeta).toHaveText(resizedMeta!);
});
