import { describe, expect, it } from 'vitest';

import { migratePrimaryActor, validateUseCaseContract } from './contract';
import type { UseCaseDraft } from './types';

const validUseCase: UseCaseDraft = {
  use_case_id: 'UC-01',
  title: 'Xử lý yêu cầu',
  objective: 'Hoàn tất yêu cầu.',
  primary_actor: 'Điều phối viên',
  supporting_actors: ['Hệ thống'],
  preconditions: [],
  happy_path_summary: ['Tiếp nhận', 'Cập nhật'],
  key_exceptions: ['Thiếu dữ liệu'],
  main_flow_steps: [
    {
      step_id: 'UC-01-S01',
      actor_ref: 'Điều phối viên',
      action: 'Tiếp nhận',
      expected_result: 'Đã tiếp nhận.',
    },
    {
      step_id: 'UC-01-S02',
      actor_ref: 'Hệ thống',
      action: 'Cập nhật',
      expected_result: 'Đã cập nhật.',
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
          actor_ref: 'Điều phối viên',
          action: 'Yêu cầu bổ sung',
          expected_result: 'Đã yêu cầu bổ sung.',
        },
      ],
      rejoin_step_id: 'UC-01-S02',
      terminal_outcome: null,
    },
  ],
  success_outcome: 'Hoàn tất.',
  review_status: 'approved',
};

describe('detailed use-case contract', () => {
  it('accepts a diagram-ready use case', () => {
    expect(validateUseCaseContract(validUseCase)).toEqual([]);
  });

  it('reports dangling actor and branch references', () => {
    const invalid = {
      ...validUseCase,
      supporting_actors: [],
      main_flow_steps: validUseCase.main_flow_steps.slice(0, 1),
    };

    expect(validateUseCaseContract(invalid).map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        'alternate_flows.0.rejoin_step_id',
      ]),
    );
  });

  it('migrates references owned by the previous primary actor', () => {
    const migrated = migratePrimaryActor(validUseCase, 'Trưởng ca');

    expect(migrated.primary_actor).toBe('Trưởng ca');
    expect(migrated.main_flow_steps[0].actor_ref).toBe('Trưởng ca');
    expect(migrated.alternate_flows[0].steps[0].actor_ref).toBe('Trưởng ca');
    expect(validateUseCaseContract(migrated)).toEqual([]);
  });
});
