import { describe, expect, it } from 'vitest';

import {
  applyUseCaseEditLifecycle,
  buildDiagramInventory,
  deriveUseCaseDiagramLifecycle,
  didUseCaseContentChange,
} from './lifecycle';
import type { UseCaseDraft } from './types';

const approvedUseCase: UseCaseDraft = {
  use_case_id: 'UC-01',
  title: 'Tiếp nhận yêu cầu',
  objective: 'Tiếp nhận đúng thông tin.',
  primary_actor: 'Điều phối viên',
  supporting_actors: ['Người gửi yêu cầu'],
  preconditions: ['Yêu cầu hợp lệ.'],
  happy_path_summary: ['Tiếp nhận', 'Xác minh'],
  key_exceptions: ['Thiếu thông tin'],
  main_flow_steps: [
    {
      step_id: 'UC-01-S01',
      actor_ref: 'Điều phối viên',
      action: 'Tiếp nhận',
      expected_result: 'Đã tiếp nhận.',
    },
    {
      step_id: 'UC-01-S02',
      actor_ref: 'Điều phối viên',
      action: 'Xác minh',
      expected_result: 'Đã xác minh.',
    },
  ],
  alternate_flows: [],
  success_outcome: 'Yêu cầu sẵn sàng xử lý.',
  review_status: 'approved',
};

describe('use case content lifecycle', () => {
  const contentChanges: Array<[keyof UseCaseDraft, UseCaseDraft[keyof UseCaseDraft]]> = [
    ['title', 'Tiếp nhận và phân loại yêu cầu'],
    ['objective', 'Tiếp nhận và phân loại đúng thông tin.'],
    ['primary_actor', 'Trưởng ca'],
    ['supporting_actors', ['Người gửi yêu cầu', 'Hệ thống']],
    ['preconditions', ['Yêu cầu hợp lệ.', 'Người dùng đã xác thực.']],
    ['happy_path_summary', ['Tiếp nhận', 'Phân loại', 'Xác minh']],
    ['key_exceptions', ['Thiếu thông tin', 'Yêu cầu trùng']],
    ['success_outcome', 'Yêu cầu đã được phân loại.'],
  ];

  it.each(contentChanges)('invalidates approval when %s changes', (field, value) => {
    const edited = {
      ...approvedUseCase,
      [field]: value,
    } as UseCaseDraft;

    expect(didUseCaseContentChange(approvedUseCase, edited)).toBe(true);
    expect(applyUseCaseEditLifecycle(approvedUseCase, edited).review_status).toBe('reviewed');
  });

  it('does not treat a review-only transition as a content edit', () => {
    const reviewed = {
      ...approvedUseCase,
      review_status: 'reviewed' as const,
    };

    expect(didUseCaseContentChange(approvedUseCase, reviewed)).toBe(false);
    expect(applyUseCaseEditLifecycle(approvedUseCase, reviewed)).toEqual(reviewed);
  });
});

describe('diagram lifecycle', () => {
  it('uses diagram lifecycle as the action permission source of truth', () => {
    expect(
      deriveUseCaseDiagramLifecycle({
        reviewStatus: 'approved',
        isActiveOnCanvas: false,
      }),
    ).toMatchObject({ status: 'ready_to_generate', canOpenCanvas: false });

    expect(
      deriveUseCaseDiagramLifecycle({
        reviewStatus: 'approved',
        artifactState: 'ready',
        isActiveOnCanvas: false,
      }),
    ).toMatchObject({ status: 'ready_to_open', canOpenCanvas: true });

    expect(
      deriveUseCaseDiagramLifecycle({
        reviewStatus: 'approved',
        artifactState: 'outdated',
        isActiveOnCanvas: true,
      }),
    ).toMatchObject({ status: 'outdated', canOpenCanvas: false });

    expect(
      deriveUseCaseDiagramLifecycle({
        reviewStatus: 'approved',
        artifactState: 'diverged',
        isActiveOnCanvas: false,
      }),
    ).toMatchObject({ status: 'diverged', canOpenCanvas: false });

    expect(
      deriveUseCaseDiagramLifecycle({
        reviewStatus: 'reviewed',
        isActiveOnCanvas: true,
      }),
    ).toMatchObject({ status: 'needs_review', canOpenCanvas: false });
  });

  it('keeps inventory focus separate from the active canvas binding', () => {
    const useCaseB = {
      ...approvedUseCase,
      use_case_id: 'UC-02',
      title: 'Xử lý yêu cầu',
    };

    const inventory = buildDiagramInventory([approvedUseCase, useCaseB], {
      focusedUseCaseId: 'UC-02',
      activeCanvasUseCaseId: 'UC-01',
      artifactStates: { 'UC-01': 'ready' },
    });

    expect(inventory[0]).toMatchObject({
      use_case_id: 'UC-01',
      diagram_status: 'active_on_canvas',
      is_active_on_canvas: true,
      is_focused: false,
    });
    expect(inventory[1]).toMatchObject({
      use_case_id: 'UC-02',
      diagram_status: 'ready_to_generate',
      is_active_on_canvas: false,
      is_focused: true,
    });
  });

  it('keeps an existing artifact openable after a failed regeneration attempt', () => {
    const [item] = buildDiagramInventory([approvedUseCase], {
      focusedUseCaseId: 'UC-01',
      activeCanvasUseCaseId: null,
      artifactStates: { 'UC-01': 'ready' },
      operationStates: { 'UC-01': 'failed' },
    });

    expect(item).toMatchObject({
      diagram_status: 'ready_to_open',
      can_open_canvas: true,
      operation_state: 'failed',
    });
  });
});
