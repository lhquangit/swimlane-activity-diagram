import type { UseCaseDraft, UseCaseFlowStep } from './types';

export type UseCaseContractIssue = {
  path: string;
  message: string;
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function validateUseCaseContract(useCase: UseCaseDraft): UseCaseContractIssue[] {
  const issues: UseCaseContractIssue[] = [];
  const actors = new Set(
    [useCase.primary_actor, ...useCase.supporting_actors].filter(hasText),
  );
  const allStepIds = [
    ...useCase.main_flow_steps.map((step) => step.step_id),
    ...useCase.alternate_flows.flatMap((flow) => flow.steps.map((step) => step.step_id)),
  ];
  const mainStepIds = new Set(useCase.main_flow_steps.map((step) => step.step_id));

  for (const [path, value] of [
    ['use_case_id', useCase.use_case_id],
    ['title', useCase.title],
    ['objective', useCase.objective],
    ['primary_actor', useCase.primary_actor],
    ['success_outcome', useCase.success_outcome],
  ] as const) {
    if (!hasText(value)) {
      issues.push({ path, message: `${path} không được để trống.` });
    }
  }

  if (useCase.main_flow_steps.length === 0) {
    issues.push({
      path: 'main_flow_steps',
      message: 'Use case cần ít nhất một bước trong luồng chính.',
    });
  }

  if (new Set(allStepIds).size !== allStepIds.length) {
    issues.push({
      path: 'steps',
      message: 'Mọi step_id trong luồng chính và luồng thay thế phải duy nhất.',
    });
  }

  validateSteps(useCase.main_flow_steps, 'main_flow_steps', actors, issues);

  const flowIds = useCase.alternate_flows.map((flow) => flow.flow_id);
  if (new Set(flowIds).size !== flowIds.length) {
    issues.push({
      path: 'alternate_flows',
      message: 'Mọi flow_id phải duy nhất.',
    });
  }

  useCase.alternate_flows.forEach((flow, flowIndex) => {
    const path = `alternate_flows.${flowIndex}`;
    if (!hasText(flow.flow_id)) {
      issues.push({ path: `${path}.flow_id`, message: 'flow_id không được để trống.' });
    }
    if (!hasText(flow.condition)) {
      issues.push({ path: `${path}.condition`, message: 'Điều kiện rẽ nhánh không được để trống.' });
    }
    if (!mainStepIds.has(flow.source_step_id)) {
      issues.push({
        path: `${path}.source_step_id`,
        message: `Không tìm thấy bước nguồn ${flow.source_step_id || '(trống)'}.`,
      });
    }
    if (flow.rejoin_step_id && !mainStepIds.has(flow.rejoin_step_id)) {
      issues.push({
        path: `${path}.rejoin_step_id`,
        message: `Không tìm thấy bước quay lại ${flow.rejoin_step_id}.`,
      });
    }
    const hasRejoin = hasText(flow.rejoin_step_id);
    const hasTerminal = hasText(flow.terminal_outcome);
    if (hasRejoin === hasTerminal) {
      issues.push({
        path: `${path}.outcome`,
        message: 'Luồng thay thế phải có đúng một kết quả: quay lại hoặc kết thúc.',
      });
    }
    if (flow.steps.length === 0) {
      issues.push({
        path: `${path}.steps`,
        message: 'Luồng thay thế cần ít nhất một bước xử lý.',
      });
    }
    validateSteps(flow.steps, `${path}.steps`, actors, issues);
  });

  return issues;
}

function validateSteps(
  steps: UseCaseFlowStep[],
  path: string,
  actors: Set<string>,
  issues: UseCaseContractIssue[],
) {
  steps.forEach((step, index) => {
    const stepPath = `${path}.${index}`;
    if (!hasText(step.step_id)) {
      issues.push({ path: `${stepPath}.step_id`, message: 'step_id không được để trống.' });
    }
    if (!actors.has(step.actor_ref)) {
      issues.push({
        path: `${stepPath}.actor_ref`,
        message: `Actor "${step.actor_ref || '(trống)'}" không còn trong use case.`,
      });
    }
    if (!hasText(step.action)) {
      issues.push({ path: `${stepPath}.action`, message: 'Hành động không được để trống.' });
    }
    if (!hasText(step.expected_result)) {
      issues.push({
        path: `${stepPath}.expected_result`,
        message: 'Kết quả mong đợi không được để trống.',
      });
    }
  });
}

export function migratePrimaryActor(
  useCase: UseCaseDraft,
  nextPrimaryActor: string,
): UseCaseDraft {
  const previousPrimaryActor = useCase.primary_actor;
  const migrateStep = (step: UseCaseFlowStep): UseCaseFlowStep =>
    step.actor_ref === previousPrimaryActor
      ? { ...step, actor_ref: nextPrimaryActor }
      : step;

  return {
    ...useCase,
    primary_actor: nextPrimaryActor,
    supporting_actors: useCase.supporting_actors.filter(
      (actor) => actor !== nextPrimaryActor,
    ),
    main_flow_steps: useCase.main_flow_steps.map(migrateStep),
    alternate_flows: useCase.alternate_flows.map((flow) => ({
      ...flow,
      steps: flow.steps.map(migrateStep),
    })),
  };
}
