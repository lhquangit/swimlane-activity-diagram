import { describe, expect, it } from 'vitest';

import {
  buildUseCaseFingerprint,
  deriveDiagramArtifactState,
  diagramDraftToWorkspace,
} from './diagram';
import type { DiagramDraft, UseCaseDraft } from './types';

const useCase: UseCaseDraft = {
  use_case_id: 'UC-01',
  title: 'Xử lý yêu cầu',
  objective: 'Xử lý đúng.',
  primary_actor: 'Điều phối viên',
  supporting_actors: ['Hệ thống'],
  preconditions: ['Yêu cầu hợp lệ'],
  happy_path_summary: ['Tiếp nhận', 'Cập nhật'],
  key_exceptions: ['Thiếu dữ liệu'],
  main_flow_steps: [
    {
      step_id: 'UC-01-S01',
      actor_ref: 'Điều phối viên',
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
  alternate_flows: [],
  success_outcome: 'Hoàn tất',
  review_status: 'approved',
};

const draft: DiagramDraft = {
  diagram_id: 'diagram-uc-01',
  use_case_id: 'UC-01',
  title: 'Xử lý yêu cầu',
  generation_status: 'ready',
  lanes: [
    { id: 'lane-1', title: 'Điều phối viên', order: 0, width: 320 },
    { id: 'lane-2', title: 'Hệ thống', order: 1, width: 320 },
  ],
  nodes: [
    {
      id: 'n-1',
      type: 'activity',
      lane_id: 'lane-1',
      text: 'Tiếp nhận',
      x: 200,
      y: 220,
      properties: {},
      trace: { use_case_id: 'UC-01', source_kind: 'main_step', source_id: 'UC-01-S01' },
    },
  ],
  edges: [],
};

describe('diagram workspace helpers', () => {
  it('converts a DiagramDraft into LogicFlow graph data while preserving trace', () => {
    const workspace = diagramDraftToWorkspace(draft, useCase);
    const activity = workspace.graph.nodes?.find((node) => node.id === 'n-1');

    expect(workspace.lanes).toHaveLength(2);
    expect(activity?.properties?.trace).toEqual(draft.nodes[0].trace);
    expect(activity?.properties?.provenance).toMatchObject({
      version: 1,
      origin: 'generated',
      trusted: true,
      trace: draft.nodes[0].trace,
    });
    expect(workspace.sourceFingerprint).toBe(buildUseCaseFingerprint(useCase));
  });

  it('distinguishes ready, outdated, and diverged states', () => {
    const workspace = diagramDraftToWorkspace(draft, useCase);
    expect(deriveDiagramArtifactState(useCase, workspace)).toBe('ready');
    expect(
      deriveDiagramArtifactState({ ...useCase, title: 'Đã sửa' }, workspace),
    ).toBe('outdated');
    expect(
      deriveDiagramArtifactState(useCase, { ...workspace, semanticEdited: true }),
    ).toBe('diverged');
  });

});
