import type {
  UseCaseAlternateFlow,
  UseCaseDraft,
  UseCaseFlowStep,
} from './types';

export function canonicalizeUseCaseDraft(useCase: UseCaseDraft): UseCaseDraft {
  return {
    ...useCase,
    happy_path_summary: useCase.main_flow_steps.map((step) => step.action),
    key_exceptions: useCase.alternate_flows.map((flow) => flow.condition),
  };
}

export function addMainStep(useCase: UseCaseDraft): UseCaseDraft {
  const stepId = nextStableId(
    `${useCase.use_case_id}-S`,
    useCase.main_flow_steps.map((step) => step.step_id),
  );
  return canonicalizeUseCaseDraft({
    ...useCase,
    main_flow_steps: [
      ...useCase.main_flow_steps,
      {
        step_id: stepId,
        actor_ref: useCase.primary_actor,
        action: 'Bước xử lý mới',
        input_or_trigger: null,
        expected_result: 'Bước xử lý được hoàn tất.',
      },
    ],
  });
}

export function updateMainStep(
  useCase: UseCaseDraft,
  stepId: string,
  update: Partial<Omit<UseCaseFlowStep, 'step_id'>>,
): UseCaseDraft {
  return canonicalizeUseCaseDraft({
    ...useCase,
    main_flow_steps: useCase.main_flow_steps.map((step) =>
      step.step_id === stepId ? { ...step, ...update } : step,
    ),
  });
}

export function moveMainStep(
  useCase: UseCaseDraft,
  stepId: string,
  direction: -1 | 1,
): UseCaseDraft {
  return canonicalizeUseCaseDraft({
    ...useCase,
    main_flow_steps: moveItem(useCase.main_flow_steps, stepId, direction, 'step_id'),
  });
}

export function getMainStepReferenceReason(
  useCase: UseCaseDraft,
  stepId: string,
): string | null {
  const flow = useCase.alternate_flows.find(
    (candidate) =>
      candidate.source_step_id === stepId || candidate.rejoin_step_id === stepId,
  );
  if (!flow) return null;
  return 'Bước đang được một luồng thay thế tham chiếu.';
}

export function removeMainStep(useCase: UseCaseDraft, stepId: string): UseCaseDraft {
  if (useCase.main_flow_steps.length <= 1 || getMainStepReferenceReason(useCase, stepId)) {
    return useCase;
  }
  return canonicalizeUseCaseDraft({
    ...useCase,
    main_flow_steps: useCase.main_flow_steps.filter((step) => step.step_id !== stepId),
  });
}

export function addAlternateFlow(useCase: UseCaseDraft): UseCaseDraft {
  const sourceStep =
    useCase.main_flow_steps[Math.max(0, useCase.main_flow_steps.length - 2)] ??
    useCase.main_flow_steps[0];
  if (!sourceStep) return useCase;
  const rejoinStep =
    useCase.main_flow_steps.find((step) => step.step_id !== sourceStep.step_id) ?? null;
  const flowId = nextStableId(
    `${useCase.use_case_id}-AF`,
    useCase.alternate_flows.map((flow) => flow.flow_id),
  );
  const flow: UseCaseAlternateFlow = {
    flow_id: flowId,
    source_step_id: sourceStep.step_id,
    condition: 'Điều kiện rẽ nhánh mới',
    steps: [
      {
        step_id: `${flowId}-S01`,
        actor_ref: useCase.primary_actor,
        action: 'Xử lý nhánh thay thế',
        input_or_trigger: null,
        expected_result: 'Nhánh thay thế được xử lý.',
      },
    ],
    rejoin_step_id: rejoinStep?.step_id ?? null,
    terminal_outcome: rejoinStep ? null : 'Kết thúc nhánh thay thế.',
  };
  return canonicalizeUseCaseDraft({
    ...useCase,
    alternate_flows: [...useCase.alternate_flows, flow],
  });
}

export function updateAlternateFlow(
  useCase: UseCaseDraft,
  flowId: string,
  update: Partial<Omit<UseCaseAlternateFlow, 'flow_id' | 'steps'>>,
): UseCaseDraft {
  return canonicalizeUseCaseDraft({
    ...useCase,
    alternate_flows: useCase.alternate_flows.map((flow) => {
      if (flow.flow_id !== flowId) return flow;
      const next = { ...flow, ...update };
      if (next.rejoin_step_id !== next.source_step_id) return next;
      const fallbackRejoin =
        useCase.main_flow_steps.find(
          (step) => step.step_id !== next.source_step_id,
        )?.step_id ?? null;
      return {
        ...next,
        rejoin_step_id: fallbackRejoin,
        terminal_outcome: fallbackRejoin
          ? null
          : next.terminal_outcome ?? 'Kết thúc nhánh thay thế.',
      };
    }),
  });
}

export function setAlternateFlowOutcomeMode(
  useCase: UseCaseDraft,
  flowId: string,
  mode: 'rejoin' | 'terminal',
): UseCaseDraft {
  const flow = useCase.alternate_flows.find((candidate) => candidate.flow_id === flowId);
  if (!flow) return useCase;
  const fallbackRejoin =
    useCase.main_flow_steps.find((step) => step.step_id !== flow.source_step_id)?.step_id ??
    null;
  if (mode === 'rejoin' && !fallbackRejoin) return useCase;
  return updateAlternateFlow(
    useCase,
    flowId,
    mode === 'rejoin'
      ? {
          rejoin_step_id: flow.rejoin_step_id ?? fallbackRejoin,
          terminal_outcome: null,
        }
      : {
          rejoin_step_id: null,
          terminal_outcome: flow.terminal_outcome ?? 'Kết thúc nhánh thay thế.',
        },
  );
}

export function removeAlternateFlow(useCase: UseCaseDraft, flowId: string): UseCaseDraft {
  return canonicalizeUseCaseDraft({
    ...useCase,
    alternate_flows: useCase.alternate_flows.filter((flow) => flow.flow_id !== flowId),
  });
}

export function addAlternateStep(useCase: UseCaseDraft, flowId: string): UseCaseDraft {
  const flow = useCase.alternate_flows.find((candidate) => candidate.flow_id === flowId);
  if (!flow) return useCase;
  const stepId = nextStableId(
    `${flowId}-S`,
    flow.steps.map((step) => step.step_id),
  );
  return canonicalizeUseCaseDraft({
    ...useCase,
    alternate_flows: useCase.alternate_flows.map((candidate) =>
      candidate.flow_id === flowId
        ? {
            ...candidate,
            steps: [
              ...candidate.steps,
              {
                step_id: stepId,
                actor_ref: useCase.primary_actor,
                action: 'Bước xử lý thay thế mới',
                input_or_trigger: null,
                expected_result: 'Bước thay thế được hoàn tất.',
              },
            ],
          }
        : candidate,
    ),
  });
}

export function updateAlternateStep(
  useCase: UseCaseDraft,
  flowId: string,
  stepId: string,
  update: Partial<Omit<UseCaseFlowStep, 'step_id'>>,
): UseCaseDraft {
  return canonicalizeUseCaseDraft({
    ...useCase,
    alternate_flows: useCase.alternate_flows.map((flow) =>
      flow.flow_id === flowId
        ? {
            ...flow,
            steps: flow.steps.map((step) =>
              step.step_id === stepId ? { ...step, ...update } : step,
            ),
          }
        : flow,
    ),
  });
}

export function moveAlternateStep(
  useCase: UseCaseDraft,
  flowId: string,
  stepId: string,
  direction: -1 | 1,
): UseCaseDraft {
  return canonicalizeUseCaseDraft({
    ...useCase,
    alternate_flows: useCase.alternate_flows.map((flow) =>
      flow.flow_id === flowId
        ? { ...flow, steps: moveItem(flow.steps, stepId, direction, 'step_id') }
        : flow,
    ),
  });
}

export function removeAlternateStep(
  useCase: UseCaseDraft,
  flowId: string,
  stepId: string,
): UseCaseDraft {
  return canonicalizeUseCaseDraft({
    ...useCase,
    alternate_flows: useCase.alternate_flows.map((flow) =>
      flow.flow_id === flowId && flow.steps.length > 1
        ? { ...flow, steps: flow.steps.filter((step) => step.step_id !== stepId) }
        : flow,
    ),
  });
}

function nextStableId(prefix: string, existingIds: string[]) {
  const existing = new Set(existingIds);
  let sequence = 1;
  while (existing.has(`${prefix}${String(sequence).padStart(2, '0')}`)) {
    sequence += 1;
  }
  return `${prefix}${String(sequence).padStart(2, '0')}`;
}

function moveItem<T extends Record<K, string>, K extends keyof T>(
  items: T[],
  id: string,
  direction: -1 | 1,
  idKey: K,
) {
  const index = items.findIndex((item) => item[idKey] === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
