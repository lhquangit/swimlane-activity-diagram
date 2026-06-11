import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PersistedBrdWorkspace from './PersistedBrdWorkspace';
import { WorkspacePersistenceProvider, type WorkspacePersistence } from '../persistence/WorkspaceContext';
import type { UseCaseResource } from '../persistence/types';
import type { BrdSpec, ResponseEnvelope, GenerateResult } from './types';

const spec: BrdSpec = {
  metadata: {
    diagram_name: 'Camera Re-ID',
    source_language: 'vi',
    generated_language: 'vi',
    generated_at: '2026-06-09T00:00:00Z',
    generator_model: 'openai/gpt-5.5',
    generator_version: 'mock-deterministic-v1',
  },
  summary: 'BRD summary',
  actors: [],
  main_flow_steps: [],
  branches: [],
  parallel_blocks: [],
  handoffs: [],
  loops: [],
  annotations: [],
  context_notes: [],
  assumptions: [],
  open_questions: [],
  warnings: [],
};

function buildWorkspace(overrides: Partial<WorkspacePersistence> = {}): WorkspacePersistence {
  return {
    project: {
      id: 'project-1',
      name: 'Demo',
      created_at: '2026-06-09T00:00:00Z',
      updated_at: '2026-06-09T00:00:00Z',
    },
    spec: {
      id: 'spec-1',
      project_id: 'project-1',
      project_summary: 'Demo spec',
      target_users: [],
      business_rules: [],
      glossary: [],
      created_at: '2026-06-09T00:00:00Z',
      updated_at: '2026-06-09T00:00:00Z',
    },
    activeFeature: {
      id: 'feature-1',
      spec_id: 'spec-1',
      name: 'Feature',
      feature_summary: 'Summary',
      actors: ['Camera AI'],
      trigger: null,
      inputs: [],
      outputs: [],
      constraints: [],
      assumptions: [],
      systems_involved: [],
      success_outcome: null,
      created_at: '2026-06-09T00:00:00Z',
      updated_at: '2026-06-09T00:00:00Z',
    },
    selectedArtifact: { kind: 'brd', featureId: 'feature-1', useCaseId: 'usecase-1' },
    navigateToArtifact: vi.fn(() => true),
    refreshArtifactTree: vi.fn(async () => undefined),
    projectSpec: {
      project_name: 'Demo',
      project_summary: 'Demo spec',
      business_context: null,
      target_users: [],
      business_rules: [],
      glossary: [],
    },
    featureIntent: {
      feature_name: 'Feature',
      feature_summary: 'Summary',
      actors: ['Camera AI'],
      primary_actor: 'Camera AI',
      trigger: null,
      inputs: [],
      outputs: [],
      constraints: [],
      assumptions: [],
      systems_involved: [],
      success_outcome: null,
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
    loadDiagram: vi.fn(async () => ({
      id: 'diagram-1',
      use_case_id: 'usecase-1',
      title: 'Camera Re-ID Diagram',
      graph_data: {},
      lanes_data: [],
      lane_height: 720,
      semantic_edited: false,
      source_use_case_updated_at: '2026-06-09T00:00:00Z',
      created_at: '2026-06-09T00:00:00Z',
      updated_at: '2026-06-09T00:00:00Z',
      is_outdated: false,
    })),
    saveDiagram: vi.fn(),
    activeDiagram: null,
    setActiveDiagram: vi.fn(),
    brdCacheScope: null,
    deleteUseCase: vi.fn(),
    loadBrd: vi.fn(async () => null),
    generateBrd: vi.fn<WorkspacePersistence['generateBrd']>(async () =>
      ({
        request_id: 'req-1',
        status: 'completed',
        schema_version: '2026-05-31',
        warnings: [],
        blocking_issues: [],
        result: {
          spec,
          brd_markdown: '# Camera Re-ID\n\nGenerated',
          draft_status: 'Draft',
          review_status: 'No blocking warnings',
        },
        error: null,
        metadata: {
          generation_source: 'deterministic_fallback',
          fallback_reason: 'provider_unavailable_config',
          provider: 'deterministic',
          model: 'mock-deterministic-v1',
        },
      }) as ResponseEnvelope<GenerateResult>,
    ),
    saveBrd: vi.fn(async () => ({
      id: 'brd-1',
      diagram_id: 'diagram-1',
      title: 'Camera Re-ID',
      structured_spec: spec,
      markdown_content: '# Camera Re-ID\n\nGenerated',
      warnings: [],
      template: 'default',
      source_diagram_updated_at: '2026-06-09T00:00:00Z',
      created_at: '2026-06-09T00:00:00Z',
      updated_at: '2026-06-09T00:00:00Z',
      is_outdated: false,
    })),
    exportBrdDocx: vi.fn(async () => new Blob(['docx'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })),
    ...overrides,
  } as WorkspacePersistence;
}

describe('PersistedBrdWorkspace', () => {
  it('shows a reader-first BRD document with direct inline editors and no debug surface', async () => {
    const workspace = buildWorkspace({
      loadBrd: vi.fn(async () => ({
        id: 'brd-1',
        diagram_id: 'diagram-1',
        title: 'Camera Re-ID',
        structured_spec: spec,
        markdown_content:
          '# Camera Re-ID\n\n## 1. Mục đích tài liệu\nGenerated summary.\n\n## 2. Phạm vi nghiệp vụ\n| Nhóm nghiệp vụ | Nội dung |\n| :---- | :---- |\n| Xử lý yêu cầu | Camera AI tiếp nhận và xử lý. |\n\n## 6. UC-001: Camera Re-ID flow\n![Hình 1](placeholder://uc-001-main-flow)\nHình 1: Luồng chính xử lý camera re-id.\n\n| Bước | Actor | Hành động | Kết quả / trạng thái |\n| :---- | :---- | :---- | :---- |\n| 1 | Camera AI | Tiếp nhận yêu cầu | Yêu cầu sẵn sàng xử lý |',
        warnings: [],
        template: 'default' as const,
        source_diagram_updated_at: '2026-06-09T00:00:00Z',
        created_at: '2026-06-09T00:00:00Z',
        updated_at: '2026-06-09T00:00:00Z',
        is_outdated: false,
      })),
    });

    render(
      <WorkspacePersistenceProvider value={workspace}>
        <PersistedBrdWorkspace
          activeUseCaseResource={makeUseCaseResource('usecase-1', 'UC-001', 'Camera Re-ID flow')}
          activeTreeUseCase={{
            id: 'usecase-1',
            use_case_key: 'UC-001',
            title: 'Camera Re-ID flow',
            review_status: 'approved',
            updated_at: '2026-06-09T00:00:00Z',
            diagram: {
              id: 'diagram-1',
              title: 'Camera Re-ID Diagram',
              semantic_edited: false,
              is_outdated: false,
              updated_at: '2026-06-09T00:00:00Z',
              brd: {
                id: 'brd-1',
                title: 'Camera Re-ID',
                template: 'default',
                is_outdated: false,
                updated_at: '2026-06-09T00:00:00Z',
              },
            },
          }}
        />
      </WorkspacePersistenceProvider>,
    );

    expect(await screen.findByDisplayValue('1. Mục đích tài liệu')).toBeVisible();
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(2);
    expect(tables[0]).toBeVisible();
    expect(tables[1]).toBeVisible();
    expect(screen.getByDisplayValue('Generated summary.')).toBeVisible();
    expect(screen.getByDisplayValue('Hình 1: Luồng chính xử lý camera re-id.')).toBeVisible();
    expect(screen.getByDisplayValue('Tiếp nhận yêu cầu')).toBeVisible();
    expect(screen.queryByPlaceholderText('BRD markdown sẽ xuất hiện ở đây.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa markdown' })).not.toBeInTheDocument();

    expect(screen.queryByText('Structured Spec')).not.toBeInTheDocument();
    expect(screen.queryByText('Template')).not.toBeInTheDocument();
    expect(screen.queryByText('BRD Artifact')).not.toBeInTheDocument();
  });

  it('saves inline document edits back into markdown content', async () => {
    const saveBrd = vi.fn(async () => ({
      id: 'brd-1',
      diagram_id: 'diagram-1',
      title: 'Camera Re-ID',
      structured_spec: spec,
      markdown_content: '# Camera Re-ID\n\n## 1. Mục đích tài liệu\nUpdated summary.\n\n## 2. Phạm vi nghiệp vụ\n| Nhóm nghiệp vụ | Nội dung |\n| :---- | :---- |\n| Xử lý yêu cầu | Camera AI tiếp nhận và xử lý. |\n\n## 6. UC-001: Camera Re-ID flow\n![Hình 1](placeholder://uc-001-main-flow)\nHình 1: Updated caption.\n\n| Bước | Actor | Hành động | Kết quả / trạng thái |\n| :---- | :---- | :---- | :---- |\n| 1 | Camera AI | Chỉnh bước inline | Yêu cầu sẵn sàng xử lý |',
      warnings: [],
      template: 'default' as const,
      source_diagram_updated_at: '2026-06-09T00:00:00Z',
      created_at: '2026-06-09T00:00:00Z',
      updated_at: '2026-06-09T00:00:00Z',
      is_outdated: false,
    }));
    const workspace = buildWorkspace({
      saveBrd,
      loadBrd: vi.fn(async () => ({
        id: 'brd-1',
        diagram_id: 'diagram-1',
        title: 'Camera Re-ID',
        structured_spec: spec,
        markdown_content:
          '# Camera Re-ID\n\n## 1. Mục đích tài liệu\nGenerated summary.\n\n## 2. Phạm vi nghiệp vụ\n| Nhóm nghiệp vụ | Nội dung |\n| :---- | :---- |\n| Xử lý yêu cầu | Camera AI tiếp nhận và xử lý. |\n\n## 6. UC-001: Camera Re-ID flow\n![Hình 1](placeholder://uc-001-main-flow)\nHình 1: Luồng chính xử lý camera re-id.\n\n| Bước | Actor | Hành động | Kết quả / trạng thái |\n| :---- | :---- | :---- | :---- |\n| 1 | Camera AI | Tiếp nhận yêu cầu | Yêu cầu sẵn sàng xử lý |',
        warnings: [],
        template: 'default' as const,
        source_diagram_updated_at: '2026-06-09T00:00:00Z',
        created_at: '2026-06-09T00:00:00Z',
        updated_at: '2026-06-09T00:00:00Z',
        is_outdated: false,
      })),
    });

    render(
      <WorkspacePersistenceProvider value={workspace}>
        <PersistedBrdWorkspace
          activeUseCaseResource={makeUseCaseResource('usecase-1', 'UC-001', 'Camera Re-ID flow')}
        />
      </WorkspacePersistenceProvider>,
    );

    fireEvent.change(await screen.findByDisplayValue('Generated summary.'), {
      target: { value: 'Updated summary.' },
    });
    fireEvent.change(screen.getByDisplayValue('Tiếp nhận yêu cầu'), {
      target: { value: 'Chỉnh bước inline' },
    });
    fireEvent.change(screen.getByDisplayValue('Hình 1: Luồng chính xử lý camera re-id.'), {
      target: { value: 'Hình 1: Updated caption.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Lưu BRD' }));

    await waitFor(() => {
      expect(saveBrd).toHaveBeenCalledWith('diagram-1', expect.objectContaining({
        markdown_content: expect.stringContaining('Updated summary.'),
      }));
    });
    expect(saveBrd).toHaveBeenCalledWith(
      'diagram-1',
      expect.objectContaining({
        markdown_content: expect.stringContaining('| 1 | Camera AI | Chỉnh bước inline | Yêu cầu sẵn sàng xử lý |'),
      }),
    );
    expect(saveBrd).toHaveBeenCalledWith(
      'diagram-1',
      expect.objectContaining({
        markdown_content: expect.stringContaining('Hình 1: Updated caption.'),
      }),
    );
  });

  it('exports a docx from the current inline draft content', async () => {
    const exportBrdDocx = vi.fn(async () => new Blob(['docx'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    const createObjectUrl = vi.fn(() => 'blob:docx');
    const revokeObjectUrl = vi.fn();
    const anchorClick = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      value: anchorClick,
    });

    const workspace = buildWorkspace({
      exportBrdDocx,
      loadBrd: vi.fn(async () => ({
        id: 'brd-1',
        diagram_id: 'diagram-1',
        title: 'Camera Re-ID',
        structured_spec: spec,
        markdown_content:
          '# Camera Re-ID\n\n## 1. Mục đích tài liệu\nGenerated summary.\n\n## 2. Phạm vi nghiệp vụ\n| Nhóm nghiệp vụ | Nội dung |\n| :---- | :---- |\n| Xử lý yêu cầu | Camera AI tiếp nhận và xử lý. |',
        warnings: [],
        template: 'default' as const,
        source_diagram_updated_at: '2026-06-09T00:00:00Z',
        created_at: '2026-06-09T00:00:00Z',
        updated_at: '2026-06-09T00:00:00Z',
        is_outdated: false,
      })),
    });

    render(
      <WorkspacePersistenceProvider value={workspace}>
        <PersistedBrdWorkspace
          activeUseCaseResource={makeUseCaseResource('usecase-1', 'UC-001', 'Camera Re-ID flow')}
        />
      </WorkspacePersistenceProvider>,
    );

    fireEvent.change(await screen.findByDisplayValue('Generated summary.'), {
      target: { value: 'Exported inline summary.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export DOCX' }));

    await waitFor(() => {
      expect(exportBrdDocx).toHaveBeenCalledWith('diagram-1', {
        title: 'Camera Re-ID',
        markdown_content: expect.stringContaining('Exported inline summary.'),
      });
    });
    expect(createObjectUrl).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();

    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      value: originalAnchorClick,
    });
  });

  it('shows a pending state while exporting BRD DOCX', async () => {
    let resolveExport!: (value: Blob) => void;
    const exportBrdDocx = vi.fn(
      () =>
        new Promise<Blob>((resolve) => {
          resolveExport = resolve;
        }),
    );
    const createObjectUrl = vi.fn(() => 'blob:docx-pending');
    const revokeObjectUrl = vi.fn();
    const anchorClick = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      value: anchorClick,
    });

    const workspace = buildWorkspace({
      exportBrdDocx,
      loadBrd: vi.fn(async () => ({
        id: 'brd-1',
        diagram_id: 'diagram-1',
        title: 'Camera Re-ID',
        structured_spec: spec,
        markdown_content:
          '# Camera Re-ID\n\n## 1. Mục đích tài liệu\nGenerated summary.\n\n## 2. Phạm vi nghiệp vụ\n| Nhóm nghiệp vụ | Nội dung |\n| :---- | :---- |\n| Xử lý yêu cầu | Camera AI tiếp nhận và xử lý. |',
        warnings: [],
        template: 'default' as const,
        source_diagram_updated_at: '2026-06-09T00:00:00Z',
        created_at: '2026-06-09T00:00:00Z',
        updated_at: '2026-06-09T00:00:00Z',
        is_outdated: false,
      })),
    });

    render(
      <WorkspacePersistenceProvider value={workspace}>
        <PersistedBrdWorkspace
          activeUseCaseResource={makeUseCaseResource('usecase-1', 'UC-001', 'Camera Re-ID flow')}
        />
      </WorkspacePersistenceProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Export DOCX' }));

    await waitFor(() => expect(exportBrdDocx).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Đang tạo file DOCX…' })).toBeDisabled();

    resolveExport(
      new Blob(['docx'], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    );

    await waitFor(() => expect(anchorClick).toHaveBeenCalled());

    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      value: originalAnchorClick,
    });
  });

  it('generates and saves BRD inline without relying on a side panel', async () => {
    const workspace = buildWorkspace();

    render(
      <WorkspacePersistenceProvider value={workspace}>
        <PersistedBrdWorkspace
          activeUseCaseResource={{
            id: 'usecase-1',
            feature_intent_id: 'feature-1',
            use_case_key: 'UC-001',
            title: 'Camera Re-ID flow',
            content: {
              use_case_id: 'UC-001',
              title: 'Camera Re-ID flow',
              objective: 'Xác minh và lưu BRD cho flow camera re-id.',
              primary_actor: 'Camera AI',
              supporting_actors: ['Ban quản lý'],
              preconditions: ['Feature Intent đã approved'],
              happy_path_summary: ['Sinh BRD từ diagram đã lưu'],
              key_exceptions: [],
              main_flow_steps: [],
              alternate_flows: [],
              success_outcome: 'BRD được lưu trong artifact tree',
              review_status: 'approved',
            },
            review_status: 'approved',
            created_at: '2026-06-09T00:00:00Z',
            updated_at: '2026-06-09T00:00:00Z',
          }}
          activeTreeUseCase={{
            id: 'usecase-1',
            use_case_key: 'UC-001',
            title: 'Camera Re-ID flow',
            review_status: 'approved',
            updated_at: '2026-06-09T00:00:00Z',
            diagram: {
              id: 'diagram-1',
              title: 'Camera Re-ID Diagram',
              semantic_edited: false,
              is_outdated: false,
              updated_at: '2026-06-09T00:00:00Z',
              brd: null,
            },
          }}
        />
      </WorkspacePersistenceProvider>,
    );

    expect(await screen.findByText('Chưa có BRD')).toBeVisible();

    fireEvent.click(screen.getAllByRole('button', { name: 'Tạo BRD' })[0]);

    await waitFor(() => {
      expect(workspace.generateBrd).toHaveBeenCalledWith('diagram-1', expect.any(String), 'default');
    });
    await waitFor(() => {
      expect(workspace.saveBrd).toHaveBeenCalledWith('diagram-1', {
        title: 'Camera Re-ID',
        structured_spec: spec,
        markdown_content: '# Camera Re-ID\n\nGenerated',
        warnings: [],
        template: 'default',
      });
    });
    expect(await screen.findByText('Generated')).toBeVisible();
    expect(screen.queryByPlaceholderText('BRD markdown sẽ xuất hiện ở đây.')).not.toBeInTheDocument();
  });

  it('hides duplicate navigation, telemetry, and raw warning node ids on the persisted BRD route', async () => {
    const workspace = buildWorkspace({
      loadBrd: vi.fn(async () => ({
        id: 'brd-1',
        diagram_id: 'diagram-1',
        title: 'Camera Re-ID',
        structured_spec: spec,
        markdown_content: '# Camera Re-ID\n\nGenerated',
        warnings: [
          {
            code: 'DECISION_UNLABELED',
            severity: 'warning' as const,
            message: 'Một quyết định chưa có nhãn rõ ràng.',
            related_node_ids: ['node-1'],
          },
        ],
        template: 'default' as const,
        source_diagram_updated_at: '2026-06-09T00:00:00Z',
        created_at: '2026-06-09T00:00:00Z',
        updated_at: '2026-06-09T00:00:00Z',
        is_outdated: false,
      })),
    });

    render(
      <WorkspacePersistenceProvider value={workspace}>
        <PersistedBrdWorkspace
          activeUseCaseResource={makeUseCaseResource('usecase-1', 'UC-001', 'Camera Re-ID flow')}
          activeTreeUseCase={{
            id: 'usecase-1',
            use_case_key: 'UC-001',
            title: 'Camera Re-ID flow',
            review_status: 'approved',
            updated_at: '2026-06-09T00:00:00Z',
            diagram: {
              id: 'diagram-1',
              title: 'Camera Re-ID Diagram',
              semantic_edited: false,
              is_outdated: false,
              updated_at: '2026-06-09T00:00:00Z',
              brd: {
                id: 'brd-1',
                title: 'Camera Re-ID',
                template: 'default',
                is_outdated: false,
                updated_at: '2026-06-09T00:00:00Z',
              },
            },
          }}
        />
      </WorkspacePersistenceProvider>,
    );

    expect(await screen.findByText('Một quyết định chưa có nhãn rõ ràng.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Về Diagram' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mở Diagram' })).not.toBeInTheDocument();
    expect(screen.queryByText('mock-deterministic-v1')).not.toBeInTheDocument();
    expect(screen.queryByText(/provider_unavailable_config/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Request req-1/i)).not.toBeInTheDocument();
    expect(screen.queryByText('node-1')).not.toBeInTheDocument();
  });

  it('ignores a stale diagram response after switching to another BRD resource', async () => {
    let resolveFirstDiagram: ((value: Awaited<ReturnType<WorkspacePersistence['loadDiagram']>>) => void) | null =
      null;
    const firstDiagramPromise = new Promise<
      Awaited<ReturnType<WorkspacePersistence['loadDiagram']>>
    >((resolve) => {
      resolveFirstDiagram = resolve;
    });
    const secondDiagram = {
      id: 'diagram-2',
      use_case_id: 'usecase-2',
      title: 'Second diagram',
      graph_data: {},
      lanes_data: [],
      lane_height: 720,
      semantic_edited: false,
      source_use_case_updated_at: '2026-06-10T00:00:00Z',
      created_at: '2026-06-10T00:00:00Z',
      updated_at: '2026-06-10T00:00:00Z',
      is_outdated: false,
    };
    const loadDiagram = vi.fn((businessKey: string) =>
      businessKey === 'UC-001' ? firstDiagramPromise : Promise.resolve(secondDiagram),
    );
    const loadBrd = vi.fn(async (diagramId: string) =>
      diagramId === secondDiagram.id
        ? {
            id: 'brd-2',
            diagram_id: secondDiagram.id,
            title: 'Second BRD',
            structured_spec: spec,
            markdown_content: '# Second BRD\n\nCurrent resource.',
            warnings: [],
            template: 'default' as const,
            source_diagram_updated_at: '2026-06-10T00:00:00Z',
            created_at: '2026-06-10T00:00:00Z',
            updated_at: '2026-06-10T00:00:00Z',
            is_outdated: false,
          }
        : null,
    );
    const workspace = buildWorkspace({ loadDiagram, loadBrd });
    const firstUseCase = makeUseCaseResource('usecase-1', 'UC-001', 'First BRD');
    const secondUseCase = makeUseCaseResource('usecase-2', 'UC-002', 'Second BRD');

    const view = render(
      <WorkspacePersistenceProvider value={workspace}>
        <PersistedBrdWorkspace activeUseCaseResource={firstUseCase} />
      </WorkspacePersistenceProvider>,
    );

    await waitFor(() => expect(loadDiagram).toHaveBeenCalledWith('UC-001'));

    view.rerender(
      <WorkspacePersistenceProvider value={workspace}>
        <PersistedBrdWorkspace activeUseCaseResource={secondUseCase} />
      </WorkspacePersistenceProvider>,
    );

    expect((await screen.findAllByRole('heading', { name: 'Second BRD' })).length).toBeGreaterThan(0);
    expect(screen.getByText('Current resource.')).toBeVisible();
    expect(screen.queryByPlaceholderText('BRD markdown sẽ xuất hiện ở đây.')).not.toBeInTheDocument();

    await act(async () => {
      resolveFirstDiagram?.({
        ...secondDiagram,
        id: 'diagram-1',
        use_case_id: 'usecase-1',
        title: 'First diagram',
      });
      await firstDiagramPromise;
    });

    expect(loadDiagram).toHaveBeenCalledTimes(2);
    expect(loadBrd).toHaveBeenCalledTimes(1);
    expect(loadBrd).toHaveBeenCalledWith('diagram-2');
    expect(screen.getAllByRole('heading', { name: 'Second BRD' }).length).toBeGreaterThan(0);
    expect(screen.getByText('Current resource.')).toBeVisible();
  });
});

function makeUseCaseResource(id: string, useCaseKey: string, title: string): UseCaseResource {
  return {
    id,
    feature_intent_id: 'feature-1',
    use_case_key: useCaseKey,
    title,
    content: {
      use_case_id: useCaseKey,
      title,
      objective: `Review ${title}.`,
      primary_actor: 'Camera AI',
      supporting_actors: [],
      preconditions: [],
      happy_path_summary: [],
      key_exceptions: [],
      main_flow_steps: [],
      alternate_flows: [],
      success_outcome: `${title} is visible.`,
      review_status: 'approved' as const,
    },
    review_status: 'approved',
    created_at: '2026-06-10T00:00:00Z',
    updated_at: '2026-06-10T00:00:00Z',
  };
}
