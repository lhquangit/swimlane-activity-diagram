import { describe, expect, it } from 'vitest';

import {
  addAlternateFlow,
  addMainStep,
  canonicalizeUseCaseDraft,
  getMainStepReferenceReason,
  moveMainStep,
  removeMainStep,
  setAlternateFlowOutcomeMode,
} from './editor';
import type { UseCaseDraft } from './types';

const baseUseCase: UseCaseDraft = {
  use_case_id: 'UC-01',
  title: 'Xử lý yêu cầu',
  objective: 'Hoàn tất yêu cầu.',
  primary_actor: 'Nhân viên',
  supporting_actors: ['Hệ thống'],
  preconditions: [],
  happy_path_summary: ['stale'],
  key_exceptions: ['stale'],
  main_flow_steps: [
    {
      step_id: 'UC-01-S01',
      actor_ref: 'Nhân viên',
      action: 'Tiếp nhận',
      expected_result: 'Đã tiếp nhận',
    },
    {
      step_id: 'UC-01-S02',
      actor_ref: 'Hệ thống',
      action: 'Cập nhật',
      expected_result: 'Đã cập nhật',
    },
  ],
  alternate_flows: [
    {
      flow_id: 'UC-01-AF01',
      source_step_id: 'UC-01-S01',
      condition: 'Thiếu dữ liệu',
      steps: [
        {
          step_id: 'UC-01-AF01-S01',
          actor_ref: 'Nhân viên',
          action: 'Yêu cầu bổ sung',
          expected_result: 'Đã yêu cầu bổ sung',
        },
      ],
      rejoin_step_id: 'UC-01-S02',
    },
  ],
  success_outcome: 'Hoàn tất',
  review_status: 'draft',
};

describe('use-case structured editor model', () => {
  it('derives summary fields from the canonical structured flow', () => {
    const result = canonicalizeUseCaseDraft(baseUseCase);
    expect(result.happy_path_summary).toEqual(['Tiếp nhận', 'Cập nhật']);
    expect(result.key_exceptions).toEqual(['Thiếu dữ liệu']);
  });

  it('keeps stable IDs while adding and reordering steps', () => {
    const added = addMainStep(baseUseCase);
    expect(added.main_flow_steps[2].step_id).toBe('UC-01-S03');
    const moved = moveMainStep(added, 'UC-01-S03', -1);
    expect(moved.main_flow_steps.map((step) => step.step_id)).toEqual([
      'UC-01-S01',
      'UC-01-S03',
      'UC-01-S02',
    ]);
  });

  it('blocks removal of a referenced main step', () => {
    expect(getMainStepReferenceReason(baseUseCase, 'UC-01-S01')).toBe(
      'Bước đang được một luồng thay thế tham chiếu.',
    );
    expect(removeMainStep(baseUseCase, 'UC-01-S01')).toEqual(baseUseCase);
  });

  it('creates alternate flows and switches to a terminal outcome exclusively', () => {
    const withoutFlows = { ...baseUseCase, alternate_flows: [] };
    const added = addAlternateFlow(withoutFlows);
    expect(added.alternate_flows[0].steps).toHaveLength(1);
    const terminal = setAlternateFlowOutcomeMode(
      added,
      added.alternate_flows[0].flow_id,
      'terminal',
    );
    expect(terminal.alternate_flows[0].rejoin_step_id).toBeNull();
    expect(terminal.alternate_flows[0].terminal_outcome).toBeTruthy();
  });

  it('does not create a rejoin loop when the source is the only main step', () => {
    const oneStep = {
      ...baseUseCase,
      main_flow_steps: [baseUseCase.main_flow_steps[0]],
      alternate_flows: [
        {
          ...baseUseCase.alternate_flows[0],
          rejoin_step_id: null,
          terminal_outcome: 'Kết thúc.',
        },
      ],
    };
    expect(
      setAlternateFlowOutcomeMode(oneStep, 'UC-01-AF01', 'rejoin'),
    ).toEqual(oneStep);
  });
});
