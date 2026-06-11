import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WorkspacePersistenceProvider } from '../persistence/WorkspaceContext';
import type { WorkspacePersistence } from '../persistence/WorkspaceContext';
import type { ArtifactTreeUseCase, UseCaseResource } from '../persistence/types';
import PersistedUseCaseWorkspace from './PersistedUseCaseWorkspace';

const baseProject = {
  id: 'project-1',
  name: 'Smart Diagram',
  description: null,
  created_at: '2026-06-07T00:00:00Z',
  updated_at: '2026-06-07T00:00:00Z',
};

const baseSpec = {
  id: 'spec-1',
  project_id: 'project-1',
  project_summary: 'Nen tang quan ly cu dan.',
  business_context: null,
  target_users: ['Ban quan ly'],
  business_rules: [],
  glossary: [],
  created_at: '2026-06-07T00:00:00Z',
  updated_at: '2026-06-07T00:00:00Z',
};

const baseFeature = {
  id: 'feature-1',
  spec_id: 'spec-1',
  name: 'Cap phat GPS',
  feature_summary: 'Xu ly cap phat GPS.',
  actors: ['Ban quan ly', 'Portal'],
  trigger: 'Co yeu cau hop le',
  inputs: ['Yeu cau GPS'],
  outputs: ['Trang thai xu ly'],
  constraints: ['Thiet bi phai kha dung'],
  assumptions: [],
  systems_involved: ['Portal'],
  success_outcome: 'Yeu cau duoc tiep nhan.',
  usecase_generation_runtime: {
    status: 'available' as const,
    provider: 'openrouter',
    prompt_version: '1.2.0',
    can_generate: true,
    note: 'AI đã sẵn sàng để sinh Use Case cho feature hiện tại.',
  },
  created_at: '2026-06-07T00:00:00Z',
  updated_at: '2026-06-07T00:00:00Z',
};

const baseUseCaseContent = {
  use_case_id: 'UC-001',
  title: 'Tiep nhan yeu cau GPS',
  objective: 'Tiep nhan va khoi tao xu ly.',
  primary_actor: 'Ban quan ly',
  supporting_actors: ['Portal'],
  preconditions: ['Da co yeu cau hop le.'],
  happy_path_summary: ['Tiep nhan yeu cau'],
  key_exceptions: [],
  main_flow_steps: [
    {
      step_id: 'UC-001-S01',
      actor_ref: 'Ban quan ly',
      action: 'Tiep nhan yeu cau',
      input_or_trigger: 'Yeu cau GPS',
      expected_result: 'Yeu cau duoc tiep nhan.',
    },
  ],
  alternate_flows: [],
  success_outcome: 'Ho so da san sang.',
  review_status: 'approved' as const,
};

function buildWorkspace(overrides: Partial<WorkspacePersistence> = {}): WorkspacePersistence {
  return {
    project: baseProject,
    spec: baseSpec,
    activeFeature: baseFeature,
    selectedArtifact: { kind: 'use-cases', featureId: 'feature-1' },
    navigateToArtifact: vi.fn(() => true),
    refreshArtifactTree: vi.fn().mockResolvedValue(undefined),
    projectSpec: {
      project_name: 'Smart Diagram',
      project_summary: 'Nen tang quan ly cu dan.',
      business_context: null,
      target_users: ['Ban quan ly'],
      business_rules: [],
      glossary: [],
    },
    featureIntent: {
      feature_name: 'Cap phat GPS',
      feature_summary: 'Xu ly cap phat GPS.',
      actors: ['Ban quan ly', 'Portal'],
      primary_actor: 'Ban quan ly',
      trigger: 'Co yeu cau hop le',
      inputs: ['Yeu cau GPS'],
      outputs: ['Trang thai xu ly'],
      constraints: ['Thiet bi phai kha dung'],
      assumptions: [],
      systems_involved: ['Portal'],
      success_outcome: 'Yeu cau duoc tiep nhan.',
    },
    openProjectSpecEditor: vi.fn(),
    openFeatureIntentEditor: vi.fn(),
    useCaseResources: [],
    useCaseSaveState: 'idle',
    diagramSaveState: 'idle',
    brdSaveState: 'idle',
    dirtyScopes: [],
    canSwitchDiagramScope: vi.fn(() => true),
    markUseCasesDirty: vi.fn(),
    markUseCaseDirty: vi.fn(),
    markDiagramDirty: vi.fn(),
    markBrdDirty: vi.fn(),
    markBrdLoaded: vi.fn(),
    pendingUseCaseGenerationMetadata: null,
    pendingUseCaseGenerationRequestId: null,
    generateUseCases: vi.fn(),
    saveUseCases: vi.fn(),
    generateDiagram: vi.fn(),
    loadDiagram: vi.fn(),
    saveDiagram: vi.fn(),
    activeDiagram: null,
    setActiveDiagram: vi.fn(),
    brdCacheScope: null,
    deleteUseCase: vi.fn(),
    loadBrd: vi.fn(),
    generateBrd: vi.fn(),
    saveBrd: vi.fn(),
    exportBrdDocx: vi.fn(),
    ...overrides,
  };
}

function renderWorkspace(
  workspace: WorkspacePersistence,
  props: ComponentProps<typeof PersistedUseCaseWorkspace>,
) {
  return render(
    <WorkspacePersistenceProvider value={workspace}>
      <PersistedUseCaseWorkspace {...props} />
    </WorkspacePersistenceProvider>,
  );
}

describe('PersistedUseCaseWorkspace', () => {
  it('generates and persists use cases immediately from the list route', async () => {
    const generatedResource: UseCaseResource = {
      id: 'usecase-1',
      feature_intent_id: 'feature-1',
      use_case_key: 'UC-001',
      title: 'Tiep nhan yeu cau GPS',
      content: baseUseCaseContent,
      review_status: 'approved',
      created_at: '2026-06-07T00:00:00Z',
      updated_at: '2026-06-07T00:00:00Z',
    };
    const workspace = buildWorkspace({
      generateUseCases: vi.fn().mockResolvedValue({
        request_id: 'req-1',
        metadata: { generation_source: 'ai' },
        result: {
          generation_source: 'ai',
          artifact_chain: [],
          project_spec: {
            project_name: 'Smart Diagram',
            project_summary: 'Nen tang quan ly cu dan.',
            business_context: null,
            target_users: ['Ban quan ly'],
            business_rules: [],
            glossary: [],
          },
          feature_intent: {
            feature_name: 'Cap phat GPS',
            feature_summary: 'Xu ly cap phat GPS.',
            actors: ['Ban quan ly', 'Portal'],
            primary_actor: 'Ban quan ly',
            trigger: 'Co yeu cau hop le',
            inputs: ['Yeu cau GPS'],
            outputs: ['Trang thai xu ly'],
            constraints: ['Thiet bi phai kha dung'],
            assumptions: [],
            systems_involved: ['Portal'],
            success_outcome: 'Yeu cau duoc tiep nhan.',
          },
          use_cases: [baseUseCaseContent],
        },
      }),
      saveUseCases: vi.fn().mockResolvedValue([generatedResource]),
    });

    renderWorkspace(workspace, { mode: 'list', treeUseCases: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Sinh use case bằng AI' }));

    await waitFor(() => expect(workspace.generateUseCases).toHaveBeenCalledWith('ai'));
    await waitFor(() => expect(workspace.saveUseCases).toHaveBeenCalledTimes(1));
    expect(workspace.saveUseCases).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        generationMetadata: { generation_source: 'ai' },
      }),
    );
    expect(await screen.findByText('Tiep nhan yeu cau GPS')).toBeVisible();
  });

  it('keeps generated drafts visible when persistence fails after generation', async () => {
    const workspace = buildWorkspace({
      generateUseCases: vi.fn().mockResolvedValue({
        request_id: 'req-2',
        metadata: { generation_source: 'ai' },
        result: {
          generation_source: 'ai',
          artifact_chain: [],
          project_spec: {
            project_name: 'Smart Diagram',
            project_summary: 'Nen tang quan ly cu dan.',
            business_context: null,
            target_users: ['Ban quan ly'],
            business_rules: [],
            glossary: [],
          },
          feature_intent: {
            feature_name: 'Cap phat GPS',
            feature_summary: 'Xu ly cap phat GPS.',
            actors: ['Ban quan ly', 'Portal'],
            primary_actor: 'Ban quan ly',
            trigger: 'Co yeu cau hop le',
            inputs: ['Yeu cau GPS'],
            outputs: ['Trang thai xu ly'],
            constraints: ['Thiet bi phai kha dung'],
            assumptions: [],
            systems_involved: ['Portal'],
            success_outcome: 'Yeu cau duoc tiep nhan.',
          },
          use_cases: [baseUseCaseContent],
        },
      }),
      saveUseCases: vi.fn().mockRejectedValue(new Error('Khong the luu use case')),
    });

    renderWorkspace(workspace, { mode: 'list', treeUseCases: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Sinh use case bằng AI' }));

    await waitFor(() => expect(workspace.saveUseCases).toHaveBeenCalledTimes(1));
    expect(workspace.saveUseCases).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        generationMetadata: {
          generation_source: 'ai',
        },
      }),
    );
    expect(await screen.findByText('Tiep nhan yeu cau GPS')).toBeVisible();
    expect(screen.getByText('Bản nháp mới nhất chưa được lưu.')).toBeVisible();
    expect(await screen.findByText('Khong the luu use case')).toBeVisible();
  });

  it('creates and persists a diagram from an approved use case editor without auto-opening the canvas', async () => {
    const useCaseResource: UseCaseResource = {
      id: 'usecase-1',
      feature_intent_id: 'feature-1',
      use_case_key: 'UC-001',
      title: 'Tiep nhan yeu cau GPS',
      content: baseUseCaseContent,
      review_status: 'approved',
      created_at: '2026-06-07T00:00:00Z',
      updated_at: '2026-06-07T00:00:00Z',
    };
    const treeUseCase: ArtifactTreeUseCase = {
      id: 'usecase-1',
      use_case_key: 'UC-001',
      title: 'Tiep nhan yeu cau GPS',
      review_status: 'approved',
      updated_at: '2026-06-07T00:00:00Z',
      diagram: null,
    };
    const workspace = buildWorkspace({
      selectedArtifact: { kind: 'use-case', featureId: 'feature-1', useCaseId: 'usecase-1' },
      useCaseResources: [useCaseResource],
      generateDiagram: vi.fn().mockResolvedValue({
        request_id: 'req-diagram-1',
        metadata: null,
        result: {
          diagram: {
            diagram_id: 'draft-1',
            use_case_id: 'UC-001',
            title: 'Diagram UC-001',
            lanes: [{ id: 'lane-1', title: 'Ban quan ly', order: 0, width: 320 }],
            nodes: [],
            edges: [],
            generation_status: 'ready',
          },
        },
      }),
      saveDiagram: vi.fn().mockResolvedValue({
        id: 'diagram-1',
        use_case_id: 'usecase-1',
        title: 'Diagram UC-001',
        graph_data: { nodes: [], edges: [] },
        lanes_data: [{ id: 'lane-1', title: 'Ban quan ly', x: 0, width: 320 }],
        lane_height: 520,
        semantic_edited: false,
        source_use_case_updated_at: '2026-06-07T00:00:00Z',
        created_at: '2026-06-07T00:00:00Z',
        updated_at: '2026-06-07T00:00:00Z',
        is_outdated: false,
      }),
    });

    renderWorkspace(workspace, {
      mode: 'editor',
      activeUseCaseResource: useCaseResource,
      activeTreeUseCase: treeUseCase,
      treeUseCases: [treeUseCase],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tạo diagram' }));

    await waitFor(() => expect(workspace.generateDiagram).toHaveBeenCalledWith('UC-001'));
    await waitFor(() => expect(workspace.saveDiagram).toHaveBeenCalledTimes(1));
    expect(workspace.refreshArtifactTree).toHaveBeenCalled();
    expect(workspace.navigateToArtifact).not.toHaveBeenCalledWith({
      kind: 'diagram',
      featureId: 'feature-1',
      useCaseId: 'usecase-1',
    });
  });

  it('shows a pending state while generating and saving a diagram from the persisted route', async () => {
    const useCaseResource: UseCaseResource = {
      id: 'usecase-1',
      feature_intent_id: 'feature-1',
      use_case_key: 'UC-001',
      title: 'Tiep nhan yeu cau GPS',
      content: baseUseCaseContent,
      review_status: 'approved',
      created_at: '2026-06-07T00:00:00Z',
      updated_at: '2026-06-07T00:00:00Z',
    };
    const treeUseCase: ArtifactTreeUseCase = {
      id: 'usecase-1',
      use_case_key: 'UC-001',
      title: 'Tiep nhan yeu cau GPS',
      review_status: 'approved',
      updated_at: '2026-06-07T00:00:00Z',
      diagram: null,
    };
    let resolveSaveDiagram!: (
      value: Awaited<ReturnType<WorkspacePersistence['saveDiagram']>>,
    ) => void;
    const workspace = buildWorkspace({
      selectedArtifact: { kind: 'use-case', featureId: 'feature-1', useCaseId: 'usecase-1' },
      useCaseResources: [useCaseResource],
      generateDiagram: vi.fn().mockResolvedValue({
        request_id: 'req-diagram-2',
        metadata: null,
        result: {
          diagram: {
            diagram_id: 'draft-2',
            use_case_id: 'UC-001',
            title: 'Diagram UC-001',
            lanes: [{ id: 'lane-1', title: 'Ban quan ly', order: 0, width: 320 }],
            nodes: [],
            edges: [],
            generation_status: 'ready',
          },
        },
      }),
      saveDiagram: vi.fn(
        () =>
          new Promise<Awaited<ReturnType<WorkspacePersistence['saveDiagram']>>>((resolve) => {
            resolveSaveDiagram = resolve;
          }),
      ),
    });

    renderWorkspace(workspace, {
      mode: 'editor',
      activeUseCaseResource: useCaseResource,
      activeTreeUseCase: treeUseCase,
      treeUseCases: [treeUseCase],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tạo diagram' }));

    await waitFor(() => expect(workspace.saveDiagram).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Đang tạo diagram…' })).toBeDisabled();

    resolveSaveDiagram({
      id: 'diagram-2',
      use_case_id: 'usecase-1',
      title: 'Diagram UC-001',
      graph_data: { nodes: [], edges: [] },
      lanes_data: [{ id: 'lane-1', title: 'Ban quan ly', x: 0, width: 320 }],
      lane_height: 520,
      semantic_edited: false,
      source_use_case_updated_at: '2026-06-07T00:00:00Z',
      created_at: '2026-06-07T00:00:00Z',
      updated_at: '2026-06-07T00:00:00Z',
      is_outdated: false,
    });

    await waitFor(() => expect(workspace.refreshArtifactTree).toHaveBeenCalled());
  });

  it('blocks diagram generation in the editor until the latest use case changes are saved', async () => {
    const useCaseResource: UseCaseResource = {
      id: 'usecase-1',
      feature_intent_id: 'feature-1',
      use_case_key: 'UC-001',
      title: 'Tiep nhan yeu cau GPS',
      content: baseUseCaseContent,
      review_status: 'approved',
      created_at: '2026-06-07T00:00:00Z',
      updated_at: '2026-06-07T00:00:00Z',
    };
    const workspace = buildWorkspace({
      selectedArtifact: { kind: 'use-case', featureId: 'feature-1', useCaseId: 'usecase-1' },
      useCaseResources: [useCaseResource],
      useCaseSaveState: 'dirty',
    });

    renderWorkspace(workspace, {
      mode: 'editor',
      activeUseCaseResource: useCaseResource,
      activeTreeUseCase: {
        id: 'usecase-1',
        use_case_key: 'UC-001',
        title: 'Tiep nhan yeu cau GPS',
        review_status: 'approved',
        updated_at: '2026-06-07T00:00:00Z',
        diagram: null,
      },
      treeUseCases: [],
    });

    expect(screen.getByRole('button', { name: 'Lưu Use Case trước' })).toBeDisabled();
    expect(
      screen.getByText('Lưu Use Case mới nhất trước khi tạo hoặc tạo lại diagram.'),
    ).toBeVisible();
    expect(workspace.generateDiagram).not.toHaveBeenCalled();
  });

  it('keeps diagram creation disabled on missing-diagram route until the use case is approved', () => {
    const draftResource: UseCaseResource = {
      id: 'usecase-1',
      feature_intent_id: 'feature-1',
      use_case_key: 'UC-001',
      title: 'Tiep nhan yeu cau GPS',
      content: { ...baseUseCaseContent, review_status: 'draft' },
      review_status: 'draft',
      created_at: '2026-06-07T00:00:00Z',
      updated_at: '2026-06-07T00:00:00Z',
    };
    const workspace = buildWorkspace({
      selectedArtifact: { kind: 'diagram', featureId: 'feature-1', useCaseId: 'usecase-1' },
      useCaseResources: [draftResource],
    });

    renderWorkspace(workspace, {
      mode: 'missing-diagram',
      activeUseCaseResource: draftResource,
      activeTreeUseCase: {
        id: 'usecase-1',
        use_case_key: 'UC-001',
        title: 'Tiep nhan yeu cau GPS',
        review_status: 'draft',
        updated_at: '2026-06-07T00:00:00Z',
        diagram: null,
      },
      treeUseCases: [],
    });

    expect(screen.getByRole('button', { name: 'Tạo diagram' })).toBeDisabled();
  });

  it('retries persisting generated drafts without re-running generation', async () => {
    const generatedResource: UseCaseResource = {
      id: 'usecase-1',
      feature_intent_id: 'feature-1',
      use_case_key: 'UC-001',
      title: 'Tiep nhan yeu cau GPS',
      content: baseUseCaseContent,
      review_status: 'approved',
      created_at: '2026-06-07T00:00:00Z',
      updated_at: '2026-06-07T00:00:00Z',
    };
    const saveUseCases = vi
      .fn()
      .mockRejectedValueOnce(new Error('Khong the luu use case'))
      .mockResolvedValueOnce([generatedResource]);
    const workspace = buildWorkspace({
      generateUseCases: vi.fn().mockResolvedValue({
        request_id: 'req-2',
        metadata: { generation_source: 'ai' },
        result: {
          generation_source: 'ai',
          artifact_chain: [],
          project_spec: {
            project_name: 'Smart Diagram',
            project_summary: 'Nen tang quan ly cu dan.',
            business_context: null,
            target_users: ['Ban quan ly'],
            business_rules: [],
            glossary: [],
          },
          feature_intent: {
            feature_name: 'Cap phat GPS',
            feature_summary: 'Xu ly cap phat GPS.',
            actors: ['Ban quan ly', 'Portal'],
            primary_actor: 'Ban quan ly',
            trigger: 'Co yeu cau hop le',
            inputs: ['Yeu cau GPS'],
            outputs: ['Trang thai xu ly'],
            constraints: ['Thiet bi phai kha dung'],
            assumptions: [],
            systems_involved: ['Portal'],
            success_outcome: 'Yeu cau duoc tiep nhan.',
          },
          use_cases: [baseUseCaseContent],
        },
      }),
      saveUseCases,
    });

    renderWorkspace(workspace, { mode: 'list', treeUseCases: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Sinh use case bằng AI' }));

    expect(await screen.findByText('Khong the luu use case')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lưu lại' }));

    await waitFor(() => expect(saveUseCases).toHaveBeenCalledTimes(2));
    expect(saveUseCases).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.objectContaining({
        generationMetadata: {
          generation_source: 'ai',
        },
      }),
    );
    expect(workspace.generateUseCases).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(workspace.refreshArtifactTree).toHaveBeenCalledTimes(1));
  });

  it('shows pending generation metadata from the current session without treating it as persisted', () => {
    const workspace = buildWorkspace({
      pendingUseCaseGenerationMetadata: {
        generation_source: 'ai',
        provider: 'openrouter',
        model: 'openai/gpt-5.4-mini',
        prompt_id: 'usecase_synthesis',
        prompt_version: '1.1.0',
      },
      pendingUseCaseGenerationRequestId: 'req-pending-1',
    });

    renderWorkspace(workspace, { mode: 'list', treeUseCases: [] });

    expect(screen.getByText('Bản nháp AI')).toBeVisible();
    expect(screen.getByText('Bản nháp mới nhất chưa được lưu.')).toBeVisible();
    expect(screen.queryByText('Request req-pending-1')).not.toBeInTheDocument();
  });

  it('shows AI-unavailable runtime truthfully before the user clicks generate', () => {
    const workspace = buildWorkspace({
      activeFeature: {
        ...baseFeature,
        usecase_generation_runtime: {
          status: 'unavailable',
          provider: 'openrouter',
          prompt_version: '1.2.0',
          can_generate: false,
          note: 'AI authoring cho Use Case đang bị tắt ở môi trường này.',
        },
      },
    });

    renderWorkspace(workspace, { mode: 'list', treeUseCases: [] });

    expect(screen.getByText('AI authoring cho Use Case đang bị tắt ở môi trường này.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Ưu tiên AI' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Theo hệ thống' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Theo rule (scaffold)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AI chưa khả dụng' })).toBeDisabled();
  });

  it('fails closed when the persisted feature payload does not include generation runtime', () => {
    const workspace = buildWorkspace({
      activeFeature: {
        ...baseFeature,
        usecase_generation_runtime: undefined,
      },
    });

    renderWorkspace(workspace, { mode: 'list', treeUseCases: [] });

    expect(
      screen.getByText('Không xác định được trạng thái AI authoring của môi trường này.'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Ưu tiên AI' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Theo hệ thống' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Theo rule (scaffold)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sinh use case bằng AI' })).toBeDisabled();
  });

  it('keeps generation source visible on the list route without developer telemetry', () => {
    const workspace = buildWorkspace({
      activeFeature: {
        ...baseFeature,
        latest_usecase_generation: {
          generation_source: 'deterministic_fallback',
          fallback_reason: 'USECASE_AI_OUTPUT_REJECTED',
          provider: 'openrouter',
          model: 'openai/gpt-5.4-mini',
          prompt_id: 'usecase_synthesis',
          prompt_version: '1.2.0',
          generation_mode: 'ai_default',
        },
      },
      useCaseResources: [
        {
          id: 'usecase-1',
          feature_intent_id: 'feature-1',
          use_case_key: 'UC-001',
          title: 'Tiep nhan yeu cau GPS',
          content: baseUseCaseContent,
          review_status: 'approved',
          created_at: '2026-06-07T00:00:00Z',
          updated_at: '2026-06-07T00:00:00Z',
        },
      ],
    });

    renderWorkspace(workspace, { mode: 'list', treeUseCases: [] });

    expect(screen.getByText('Bản nháp degraded')).toBeVisible();
    expect(
      screen.getByText('Bản nháp này đến từ lần sinh AI không qua quality gate. Không nên dùng làm output cuối.'),
    ).toBeVisible();
    expect(screen.queryByText('Lần sinh gần nhất')).not.toBeInTheDocument();
    expect(screen.queryByText('Prompt usecase_synthesis@1.2.0')).not.toBeInTheDocument();
    expect(screen.queryByText('openrouter · openai/gpt-5.4-mini')).not.toBeInTheDocument();
    expect(screen.queryByText('quality gate')).not.toBeInTheDocument();
  });

  it('keeps use-case editor focused on business content instead of generation telemetry', () => {
    const useCaseResource: UseCaseResource = {
      id: 'usecase-1',
      feature_intent_id: 'feature-1',
      use_case_key: 'UC-001',
      title: 'Tiep nhan yeu cau GPS',
      content: baseUseCaseContent,
      review_status: 'approved',
      created_at: '2026-06-07T00:00:00Z',
      updated_at: '2026-06-07T00:00:00Z',
    };
    const workspace = buildWorkspace({
      selectedArtifact: { kind: 'use-case', featureId: 'feature-1', useCaseId: 'usecase-1' },
      activeFeature: {
        ...baseFeature,
        latest_usecase_generation: {
          generation_source: 'ai',
          provider: 'openrouter',
          model: 'openai/gpt-5.4-mini',
          prompt_id: 'usecase_synthesis',
          prompt_version: '1.1.0',
          generation_mode: 'ai_default',
          quality_status: 'passed',
          attempt_count: 1,
        },
      },
      useCaseResources: [useCaseResource],
    });

    renderWorkspace(workspace, {
      mode: 'editor',
      activeUseCaseResource: useCaseResource,
      activeTreeUseCase: {
        id: 'usecase-1',
        use_case_key: 'UC-001',
        title: 'Tiep nhan yeu cau GPS',
        review_status: 'approved',
        updated_at: '2026-06-07T00:00:00Z',
        diagram: null,
      },
      treeUseCases: [],
    });

    expect(screen.getByText('Bản nháp AI')).toBeVisible();
    expect(screen.queryByText('Prompt usecase_synthesis@1.1.0')).not.toBeInTheDocument();
    expect(screen.queryByText('Mode ai_default')).not.toBeInTheDocument();
    expect(screen.queryByText('Quality passed')).not.toBeInTheDocument();
  });

  it('shows regenerate diagram CTA for diverged persisted diagrams', () => {
    const useCaseResource: UseCaseResource = {
      id: 'usecase-1',
      feature_intent_id: 'feature-1',
      use_case_key: 'UC-001',
      title: 'Tiep nhan yeu cau GPS',
      content: baseUseCaseContent,
      review_status: 'approved',
      created_at: '2026-06-07T00:00:00Z',
      updated_at: '2026-06-07T00:00:00Z',
    };
    const workspace = buildWorkspace({
      selectedArtifact: { kind: 'use-case', featureId: 'feature-1', useCaseId: 'usecase-1' },
      useCaseResources: [useCaseResource],
    });

    renderWorkspace(workspace, {
      mode: 'editor',
      activeUseCaseResource: useCaseResource,
      activeTreeUseCase: {
        id: 'usecase-1',
        use_case_key: 'UC-001',
        title: 'Tiep nhan yeu cau GPS',
        review_status: 'approved',
        updated_at: '2026-06-07T00:00:00Z',
        diagram: {
          id: 'diagram-1',
          title: 'Diagram UC-001',
          semantic_edited: true,
          is_outdated: false,
          updated_at: '2026-06-07T00:00:00Z',
          brd: null,
        },
      },
      treeUseCases: [],
    });

    expect(screen.getByRole('button', { name: 'Tạo lại diagram' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Mở diagram' })).toBeNull();
    expect(screen.getByText('Sơ đồ đã phân kỳ')).toBeVisible();
  });

  it('removes duplicated persisted-workspace navigation buttons and technical copy', () => {
    const useCaseResource: UseCaseResource = {
      id: 'usecase-1',
      feature_intent_id: 'feature-1',
      use_case_key: 'UC-001',
      title: 'Tiep nhan yeu cau GPS',
      content: baseUseCaseContent,
      review_status: 'approved',
      created_at: '2026-06-07T00:00:00Z',
      updated_at: '2026-06-07T00:00:00Z',
    };
    const workspace = buildWorkspace({
      selectedArtifact: { kind: 'use-case', featureId: 'feature-1', useCaseId: 'usecase-1' },
      useCaseResources: [useCaseResource],
    });

    const { rerender } = renderWorkspace(workspace, { mode: 'list', treeUseCases: [] });

    expect(screen.queryByRole('button', { name: 'Sửa Feature Intent' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa Use Case' })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/left tree refresh theo artifact thật/i),
    ).not.toBeInTheDocument();

    rerender(
      <WorkspacePersistenceProvider value={workspace}>
        <PersistedUseCaseWorkspace
          mode="missing-diagram"
          activeUseCaseResource={useCaseResource}
          activeTreeUseCase={{
            id: 'usecase-1',
            use_case_key: 'UC-001',
            title: 'Tiep nhan yeu cau GPS',
            review_status: 'approved',
            updated_at: '2026-06-07T00:00:00Z',
            diagram: null,
          }}
          treeUseCases={[]}
        />
      </WorkspacePersistenceProvider>,
    );

    expect(screen.queryByRole('button', { name: 'Về Use Cases' })).not.toBeInTheDocument();
    expect(screen.queryByText(/database/i)).not.toBeInTheDocument();

    rerender(
      <WorkspacePersistenceProvider value={workspace}>
        <PersistedUseCaseWorkspace
          mode="editor"
          activeUseCaseResource={useCaseResource}
          activeTreeUseCase={{
            id: 'usecase-1',
            use_case_key: 'UC-001',
            title: 'Tiep nhan yeu cau GPS',
            review_status: 'approved',
            updated_at: '2026-06-07T00:00:00Z',
            diagram: {
              id: 'diagram-1',
              title: 'Diagram UC-001',
              semantic_edited: false,
              is_outdated: false,
              updated_at: '2026-06-07T00:00:00Z',
              brd: null,
            },
          }}
          treeUseCases={[]}
        />
      </WorkspacePersistenceProvider>,
    );

    expect(screen.queryByRole('button', { name: 'Về Use Cases' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mở diagram' })).not.toBeInTheDocument();
  });

  it('exposes delete action on the persisted editor route', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleteUseCase = vi.fn().mockResolvedValue(undefined);
    const useCaseResource: UseCaseResource = {
      id: 'usecase-1',
      feature_intent_id: 'feature-1',
      use_case_key: 'UC-001',
      title: 'Tiep nhan yeu cau GPS',
      content: baseUseCaseContent,
      review_status: 'approved',
      created_at: '2026-06-07T00:00:00Z',
      updated_at: '2026-06-07T00:00:00Z',
    };
    const workspace = buildWorkspace({
      selectedArtifact: { kind: 'use-case', featureId: 'feature-1', useCaseId: 'usecase-1' },
      useCaseResources: [useCaseResource],
      deleteUseCase,
    });

    renderWorkspace(workspace, {
      mode: 'editor',
      activeUseCaseResource: useCaseResource,
      activeTreeUseCase: {
        id: 'usecase-1',
        use_case_key: 'UC-001',
        title: 'Tiep nhan yeu cau GPS',
        review_status: 'approved',
        updated_at: '2026-06-07T00:00:00Z',
        diagram: null,
      },
      treeUseCases: [],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Xóa use case' }));

    await waitFor(() => expect(deleteUseCase).toHaveBeenCalledWith('UC-001'));
  });
});
