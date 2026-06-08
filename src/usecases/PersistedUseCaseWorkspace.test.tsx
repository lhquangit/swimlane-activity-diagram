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

    fireEvent.click(screen.getByRole('button', { name: 'Sinh use case' }));

    await waitFor(() => expect(workspace.generateUseCases).toHaveBeenCalledWith('auto'));
    await waitFor(() => expect(workspace.saveUseCases).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Tiep nhan yeu cau GPS')).toBeVisible();
    expect(screen.getByText('Bản nháp AI')).toBeVisible();
  });

  it('keeps generated drafts visible when persistence fails after generation', async () => {
    const workspace = buildWorkspace({
      generateUseCases: vi.fn().mockResolvedValue({
        request_id: 'req-2',
        metadata: { generation_source: 'deterministic', fallback_reason: 'mock fallback' },
        result: {
          generation_source: 'deterministic',
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

    fireEvent.click(screen.getByRole('button', { name: 'Sinh use case' }));

    await waitFor(() => expect(workspace.saveUseCases).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Tiep nhan yeu cau GPS')).toBeVisible();
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

    fireEvent.click(screen.getByRole('button', { name: 'Sinh use case' }));

    expect(await screen.findByText('Khong the luu use case')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lưu lại' }));

    await waitFor(() => expect(saveUseCases).toHaveBeenCalledTimes(2));
    expect(workspace.generateUseCases).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(workspace.refreshArtifactTree).toHaveBeenCalledTimes(1));
  });

  it('shows persisted generation metadata on the list route after reload', () => {
    const workspace = buildWorkspace({
      activeFeature: {
        ...baseFeature,
        latest_usecase_generation: {
          generation_source: 'deterministic_fallback',
          fallback_reason: 'quality_rejected',
          provider: 'openrouter',
          model: 'openai/gpt-5.4-mini',
          prompt_id: 'usecase_synthesis',
          prompt_version: '1.1.0',
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

    expect(screen.getByText('Lần sinh gần nhất')).toBeVisible();
    expect(screen.getByText('Bản nháp theo rule')).toBeVisible();
    expect(screen.getByText('Prompt usecase_synthesis@1.1.0')).toBeVisible();
    expect(screen.getByText('openrouter · openai/gpt-5.4-mini')).toBeVisible();
  });

  it('shows persisted generation metadata on the single use-case editor route', () => {
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
    expect(screen.getByText('Prompt usecase_synthesis@1.1.0')).toBeVisible();
    expect(screen.getByText('Mode ai_default')).toBeVisible();
    expect(screen.getByText('Quality passed')).toBeVisible();
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
});
