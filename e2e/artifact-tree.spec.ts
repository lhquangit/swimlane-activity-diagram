import { expect, test, type Locator, type Page, type APIRequestContext } from '@playwright/test';

test('persisted artifact tree drives the real Project -> BRD chain without sample leakage', async ({
  page,
  request,
}) => {
  const fixture = await createGeneratedFeatureFixture(request, `Smart Diagram E2E ${Date.now()}`);

  await page.goto(`/projects/${fixture.projectId}/spec`);

  await expect(page.getByRole('heading', { name: 'Project Spec' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('tree', { name: 'Cấu trúc project' })).toBeVisible();
  await expect(page.getByText('Tiếp nhận tín hiệu ban đầu')).toHaveCount(0);
  await expect(page.getByText('Mở nhật ký sự cố')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset mẫu' })).toHaveCount(0);

  await page.goto(`/projects/${fixture.projectId}/features/${fixture.featureId}`);
  await page.getByRole('button', { name: 'Use Cases' }).click();
  await expect(page.getByRole('heading', { name: 'Use Cases', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Không gian use case', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sinh use case' })).toBeVisible();

  await page.getByRole('button', { name: 'Sinh use case' }).click();
  await expect(page.getByRole('button', { name: 'Sửa Use Case' }).first()).toBeVisible();
  await expect(page.locator('.artifact-tree__item').filter({ hasText: 'UC-' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Sửa Use Case' }).first().click();
  await expect(page.getByRole('heading', { name: 'Use Case', exact: true })).toBeVisible();
  const useCaseTitle = await page.getByLabel('Tên Use Case').inputValue();
  const useCaseKey = await page.locator('.persisted-usecase__id').textContent();
  await page.getByRole('button', { name: 'Đánh dấu đã rà soát' }).click();
  await page.getByRole('button', { name: 'Phê duyệt' }).click();
  await page.getByRole('button', { name: 'Lưu Use Case' }).click();
  await expect(page.getByRole('button', { name: 'Đã lưu' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Tạo diagram' }).click();
  await expect(page.getByRole('button', { name: 'Mở diagram' })).toBeVisible({ timeout: 15_000 });

  const useCaseChildren = treeChildrenForUseCase(page, useCaseTitle, useCaseKey ?? '');
  await expect(
    useCaseChildren.getByRole('treeitem', {
      name: new RegExp(`^${escapeRegex(useCaseTitle)} Diagram`),
    }),
  ).toBeVisible();
  await expect(
    useCaseChildren.getByRole('treeitem', { name: /^BRD chưa tạo/ }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Mở diagram' }).click();
  await expect(page.getByLabel('Use case đang gắn với canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Lưu diagram' }).click();

  await useCaseChildren.getByRole('treeitem', { name: /^BRD chưa tạo/ }).click();
  await expect(page.getByRole('heading', { name: 'AI BRD Draft' })).toBeVisible();
  await page.getByRole('button', { name: 'Generate BRD' }).click();
  await expect(page.locator('.toolbar-status')).toContainText('Đã sinh BRD draft từ diagram đã lưu.', {
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'BRD Draft', exact: true }).click();
  await expect(
    page.getByPlaceholder('BRD draft sẽ xuất hiện ở đây sau khi generate.'),
  ).not.toHaveValue('', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Lưu BRD' }).click();

  const brdTreeItem = useCaseChildren.getByRole('treeitem', { name: /BRD/i });
  await expect(brdTreeItem).toBeVisible();
  await brdTreeItem.click();
  await expect(page.getByRole('heading', { name: 'AI BRD Draft' })).toBeVisible();
  await expect(
    page.getByPlaceholder('BRD draft sẽ xuất hiện ở đây sau khi generate.'),
  ).not.toHaveValue('', { timeout: 15_000 });
});

test('persisted use-case route stays readable across desktop and mobile with long AI content', async ({
  page,
  request,
}) => {
  const fixture = await createLongUseCaseFixture(request, `Smart Diagram Layout ${Date.now()}`);

  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto(`/projects/${fixture.projectId}/features/${fixture.featureId}`);
  await page.getByRole('button', { name: 'Use Cases' }).click();
  await page.getByRole('button', { name: 'Sửa Use Case' }).click();
  await expectPersistedUseCaseLayout(page);

  await page.setViewportSize({ width: 430, height: 1100 });
  await page.getByRole('button', { name: 'Về Use Cases' }).click();
  await page.getByRole('button', { name: 'Sửa Use Case' }).click();
  await expectPersistedUseCaseLayout(page);
});

async function createGeneratedFeatureFixture(request: APIRequestContext, name: string) {
  const project = await createProject(request, name, 'Quản lý định danh thú nuôi OCP2.');
  await upsertFeatureSpec(request, project.id);
  const feature = await createFeature(request, project.specId, {
    name: 'Gửi yêu cầu định danh thú nuôi',
    feature_summary: 'Cư dân gửi yêu cầu và Ban quản lý tiếp nhận xác minh.',
    actors: ['Cư dân OCP2', 'Ban quản lý OCP2'],
    trigger: 'Cư dân cần định danh thú nuôi',
    inputs: [],
    outputs: [],
    constraints: [],
    assumptions: [],
    systems_involved: [],
    success_outcome: 'Yêu cầu được tiếp nhận để xác minh.',
  });
  return { projectId: project.id, featureId: feature.id };
}

async function createLongUseCaseFixture(request: APIRequestContext, name: string) {
  const project = await createProject(request, name, 'Nền tảng vận hành giao tiếp giữa cư dân và ban quản lý.');
  await upsertFeatureSpec(request, project.id);
  const feature = await createFeature(request, project.specId, {
    name: 'Điều phối tiếp nhận và phản hồi yêu cầu cư dân',
    feature_summary: 'Ban quản lý tiếp nhận, xác minh, điều phối và phản hồi yêu cầu có nhiều nhánh xử lý.',
    actors: ['Ban quản lý / Portal', 'Hệ thống liên quan', 'Cư dân OCP2'],
    trigger: 'Yêu cầu mới được gửi lên hệ thống',
    inputs: ['Biểu mẫu yêu cầu', 'Thông tin cư dân', 'Tệp đính kèm'],
    outputs: ['Trạng thái xử lý', 'Phản hồi chính thức'],
    constraints: ['Cần lưu dấu vết xử lý'],
    assumptions: ['Dữ liệu đầu vào hợp lệ'],
    systems_involved: ['Portal', 'CRM nội bộ'],
    success_outcome: 'Yêu cầu được tiếp nhận, theo dõi và phản hồi minh bạch.',
  });

  const useCase = {
    use_case_id: 'UC-LONG-001',
    title: 'Tiếp nhận, xác minh và điều phối yêu cầu cư dân có nhiều nhánh xử lý',
    objective:
      'Bảo đảm actor hỗ trợ, hệ thống liên quan và đầu ra phụ đều được mô tả rõ ràng để người dùng có thể đọc nhanh trước khi chỉnh sửa sâu.',
    primary_actor: 'Ban quản lý / Portal',
    supporting_actors: ['Hệ thống liên quan', 'Cư dân OCP2'],
    preconditions: [
      'Đã có bối cảnh dự án và V-PetSafe hoặc portal nội bộ được xác định.',
      'Yêu cầu cư dân đã có tối thiểu thông tin định danh và mô tả rõ vấn đề.',
    ],
    happy_path_summary: [
      'Tiếp nhận yêu cầu',
      'Xác minh dữ liệu',
      'Điều phối xử lý',
      'Phản hồi kết quả',
    ],
    key_exceptions: ['Thiếu dữ liệu', 'Yêu cầu trùng lặp'],
    main_flow_steps: [
      {
        step_id: 'UC-LONG-001-S01',
        actor_ref: 'Ban quản lý / Portal',
        action:
          'Phối hợp với các bộ phận liên quan để tiếp nhận và chuẩn hóa toàn bộ thông tin ban đầu do cư dân gửi lên, bao gồm mô tả, tệp đính kèm và tín hiệu ưu tiên.',
        input_or_trigger: 'Yêu cầu mới xuất hiện trong hàng chờ tiếp nhận.',
        expected_result: 'Yêu cầu được ghi nhận với trạng thái sẵn sàng xác minh.',
      },
      {
        step_id: 'UC-LONG-001-S02',
        actor_ref: 'Hệ thống liên quan',
        action:
          'Đối chiếu dữ liệu cư dân, kiểm tra tệp đính kèm và gợi ý các trường hợp cần bổ sung để ban quản lý có thể ra quyết định nhanh hơn.',
        input_or_trigger: 'Hồ sơ đã được chuẩn hóa.',
        expected_result: 'Các điểm thiếu hoặc mâu thuẫn được nêu rõ cho người xử lý.',
      },
      {
        step_id: 'UC-LONG-001-S03',
        actor_ref: 'Ban quản lý / Portal',
        action:
          'Điều phối yêu cầu sang nhóm chịu trách nhiệm, ghi rõ SLA nội bộ và các bước theo dõi tiếp theo để cư dân có thể biết trạng thái đang ở đâu.',
        input_or_trigger: 'Kết quả xác minh ban đầu.',
        expected_result: 'Yêu cầu được giao đúng đầu mối và có lịch theo dõi minh bạch.',
      },
      {
        step_id: 'UC-LONG-001-S04',
        actor_ref: 'Ban quản lý / Portal',
        action:
          'Tổng hợp kết quả cuối cùng, phản hồi lại cho cư dân bằng ngôn ngữ dễ hiểu và chốt trạng thái xử lý trong hệ thống.',
        input_or_trigger: 'Đầu mối phụ trách đã trả kết quả.',
        expected_result: 'Cư dân nhận được phản hồi rõ ràng, còn hệ thống lưu được dấu vết hoàn chỉnh.',
      },
    ],
    alternate_flows: [
      {
        flow_id: 'ALT-001',
        source_step_id: 'UC-LONG-001-S02',
        condition: 'Thiếu thông tin định danh quan trọng hoặc tệp đính kèm không đọc được.',
        steps: [
          {
            step_id: 'ALT-001-S01',
            actor_ref: 'Ban quản lý / Portal',
            action:
              'Yêu cầu cư dân bổ sung thông tin còn thiếu và nêu rõ lý do để tránh việc gửi lại nhiều lần.',
            input_or_trigger: 'Kết quả xác minh báo thiếu dữ liệu.',
            expected_result: 'Cư dân hiểu cần bổ sung gì và vì sao.',
          },
          {
            step_id: 'ALT-001-S02',
            actor_ref: 'Cư dân OCP2',
            action:
              'Gửi lại thông tin, tài liệu hoặc hình ảnh thay thế giúp hồ sơ có thể quay lại luồng chính.',
            input_or_trigger: 'Thông báo yêu cầu bổ sung.',
            expected_result: 'Hồ sơ có thể được xác minh lại.',
          },
        ],
        rejoin_step_id: 'UC-LONG-001-S03',
        terminal_outcome: null,
      },
      {
        flow_id: 'ALT-002',
        source_step_id: 'UC-LONG-001-S03',
        condition: 'Yêu cầu bị xác định là trùng lặp hoặc không thuộc phạm vi hỗ trợ hiện tại.',
        steps: [
          {
            step_id: 'ALT-002-S01',
            actor_ref: 'Ban quản lý / Portal',
            action:
              'Đánh dấu hồ sơ là ngoài phạm vi hoặc trùng lặp, sau đó phản hồi ngay cho cư dân kèm hướng dẫn phù hợp.',
            input_or_trigger: 'Bộ phận phụ trách trả về kết luận ngoài phạm vi.',
            expected_result: 'Yêu cầu được kết thúc có giải thích rõ ràng.',
          },
        ],
        rejoin_step_id: null,
        terminal_outcome: 'Quy trình kết thúc mà không cần tiếp tục điều phối thêm.',
      },
    ],
    success_outcome:
      'Yêu cầu được xử lý theo đúng nhánh phù hợp và mọi quyết định quan trọng đều được trình bày lại rõ ràng cho cư dân.',
    review_status: 'approved',
  } as const;

  const saved = await request.put(`http://127.0.0.1:18000/api/feature-intents/${feature.id}/use-cases`, {
    data: { items: [{ id: null, content: useCase }] },
  });
  expect(saved.ok()).toBe(true);
  const savedUseCase = (await saved.json()) as Array<{ id: string }>;

  return {
    projectId: project.id,
    featureId: feature.id,
    useCaseId: savedUseCase[0].id,
  };
}

async function createProject(request: APIRequestContext, name: string, description: string) {
  const created = await request.post('http://127.0.0.1:18000/api/projects', {
    data: { name, description },
  });
  expect(created.ok()).toBe(true);
  const project = (await created.json()) as { id: string };
  const spec = await request.get(`http://127.0.0.1:18000/api/projects/${project.id}/spec`);
  expect(spec.ok()).toBe(true);
  const specPayload = (await spec.json()) as { id: string };
  return { id: project.id, specId: specPayload.id };
}

async function upsertFeatureSpec(request: APIRequestContext, projectId: string) {
  const response = await request.put(`http://127.0.0.1:18000/api/projects/${projectId}/spec`, {
    data: {
      project_summary: 'Hệ thống điều phối quy trình giữa cư dân và ban quản lý.',
      business_context: 'Mọi yêu cầu đều cần được lưu dấu và phản hồi minh bạch.',
      target_users: ['Ban quản lý', 'Cư dân OCP2'],
      business_rules: ['Mọi yêu cầu cần có trạng thái xử lý'],
      glossary: [],
    },
  });
  expect(response.ok()).toBe(true);
}

async function createFeature(
  request: APIRequestContext,
  specId: string,
  payload: Record<string, unknown>,
) {
  const response = await request.post(`http://127.0.0.1:18000/api/specs/${specId}/feature-intents`, {
    data: payload,
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
}

function treeChildrenForUseCase(page: Page, title: string, useCaseKey: string) {
  const treeItem = page.getByRole('treeitem', {
    name: new RegExp(`${escapeRegex(title)} ${escapeRegex(useCaseKey)}`),
  });
  return treeItem.locator('xpath=following-sibling::div[@role="group"][1]');
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function expectPersistedUseCaseLayout(page: Page) {
  await expect(page.getByRole('heading', { name: 'Use Case', exact: true })).toBeVisible();
  await expect(page.getByText('Tác nhân', { exact: true })).toBeVisible();
  await expect(page.getByText('Thông tin chung', { exact: true })).toBeVisible();
  await expect(page.getByText('Luồng chính', { exact: true })).toBeVisible();
  await expect(page.getByText('Luồng thay thế', { exact: true })).toBeVisible();
  await expect(page.getByText('Kết quả và bước tiếp theo', { exact: true })).toBeVisible();

  const stepAction = page.locator('.persisted-usecase__step-action').first();
  const stepRail = page.locator('.persisted-usecase__step-rail').first();
  await expect(stepAction).toBeVisible();
  await expect(stepRail).toBeVisible();
  await expectNoOverlap(stepAction, stepRail);
}

async function expectNoOverlap(left: Locator, right: Locator) {
  const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()]);
  expect(leftBox).not.toBeNull();
  expect(rightBox).not.toBeNull();
  if (!leftBox || !rightBox) return;
  const intersects =
    leftBox.x < rightBox.x + rightBox.width &&
    leftBox.x + leftBox.width > rightBox.x &&
    leftBox.y < rightBox.y + rightBox.height &&
    leftBox.y + leftBox.height > rightBox.y;
  expect(intersects).toBe(false);
}
