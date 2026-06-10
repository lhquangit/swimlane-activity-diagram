import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProjectWorkspace from './ProjectWorkspace';

const api = vi.hoisted(() => ({
  getProjectArtifactTree: vi.fn(),
  listFeatures: vi.fn(),
  listUseCases: vi.fn(),
  getDiagram: vi.fn(),
  deleteFeature: vi.fn(),
}));

vi.mock('@clerk/react', () => ({
  UserButton: () => <div data-testid="user-button" />,
  useUser: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../persistence/api', () => ({
  featurePayload: (value: unknown) => value,
  usePersistenceApi: () => api,
}));

vi.mock('../App', async () => {
  const { useWorkspacePersistence } = await import('../persistence/WorkspaceContext');
  return {
    default: function WorkspaceProbe() {
      const workspace = useWorkspacePersistence();
      if (!workspace) return null;
      return (
        <div data-testid="workspace-probe">
          <span data-testid="active-feature">{workspace.activeFeature.id}</span>
          <span data-testid="active-artifact">{workspace.selectedArtifact.kind}</span>
          <span data-testid="dirty-count">{workspace.dirtyScopes.length}</span>
          <span data-testid="diagram-save-state">{workspace.diagramSaveState}</span>
          <button onClick={() => workspace.markDiagramDirty('UC-001')}>Dirty diagram</button>
          <button
            onClick={() => {
              void workspace.loadDiagram('UC-002').catch(() => undefined);
            }}
          >
            Load failing diagram
          </button>
        </div>
      );
    },
  };
});

vi.mock('../usecases/PersistedUseCaseWorkspace', async () => {
  const { useWorkspacePersistence } = await import('../persistence/WorkspaceContext');
  return {
    default: function PersistedUseCaseWorkspaceProbe() {
      const workspace = useWorkspacePersistence();
      if (!workspace) return null;
      return (
        <div data-testid="usecase-workspace-probe">
          <span data-testid="active-feature">{workspace.activeFeature.id}</span>
          <span data-testid="active-artifact">{workspace.selectedArtifact.kind}</span>
          <span data-testid="dirty-count">{workspace.dirtyScopes.length}</span>
          <span data-testid="usecase-save-state">{workspace.useCaseSaveState}</span>
          <button onClick={() => workspace.markUseCaseDirty('UC-001', 'Use case A')}>
            Dirty usecase
          </button>
        </div>
      );
    },
  };
});

vi.mock('../brd/PersistedBrdWorkspace', async () => {
  const { useWorkspacePersistence } = await import('../persistence/WorkspaceContext');
  return {
    default: function PersistedBrdWorkspaceProbe() {
      const workspace = useWorkspacePersistence();
      if (!workspace) return null;
      return (
        <div data-testid="brd-workspace-probe">
          <span data-testid="active-feature">{workspace.activeFeature.id}</span>
          <span data-testid="active-artifact">{workspace.selectedArtifact.kind}</span>
          <span data-testid="brd-save-state">{workspace.brdSaveState}</span>
        </div>
      );
    },
  };
});

const project = {
  id: 'project-1',
  name: 'Demo project',
  description: null,
  created_at: '2026-06-07T00:00:00Z',
  updated_at: '2026-06-07T00:00:00Z',
};

const spec = {
  id: 'spec-1',
  project_id: project.id,
  project_summary: 'Demo spec',
  business_context: null,
  target_users: [],
  business_rules: [],
  glossary: [],
  created_at: '2026-06-07T00:00:00Z',
  updated_at: '2026-06-07T00:00:00Z',
};

const features = [
  {
    id: 'feature-1',
    spec_id: spec.id,
    name: 'Feature A',
    feature_summary: 'Feature A summary',
    actors: ['User'],
    trigger: null,
    inputs: [],
    outputs: [],
    constraints: [],
    assumptions: [],
    systems_involved: [],
    success_outcome: null,
    created_at: '2026-06-07T00:00:00Z',
    updated_at: '2026-06-07T00:00:00Z',
  },
  {
    id: 'feature-2',
    spec_id: spec.id,
    name: 'Feature B',
    feature_summary: 'Feature B summary',
    actors: ['Admin'],
    trigger: null,
    inputs: [],
    outputs: [],
    constraints: [],
    assumptions: [],
    systems_involved: [],
    success_outcome: null,
    created_at: '2026-06-07T00:00:00Z',
    updated_at: '2026-06-07T00:00:00Z',
  },
];

const useCases = [
  {
    id: 'usecase-1',
    feature_intent_id: 'feature-1',
    use_case_key: 'UC-001',
    title: 'Use case A',
    content: { use_case_id: 'UC-001', review_status: 'approved' },
    review_status: 'approved',
    created_at: '2026-06-07T00:00:00Z',
    updated_at: '2026-06-07T00:00:00Z',
  },
  {
    id: 'usecase-2',
    feature_intent_id: 'feature-1',
    use_case_key: 'UC-002',
    title: 'Use case A2',
    content: { use_case_id: 'UC-002', review_status: 'approved' },
    review_status: 'approved',
    created_at: '2026-06-07T00:00:00Z',
    updated_at: '2026-06-07T00:00:00Z',
  },
];

const useCasesB = [
  {
    id: 'usecase-3',
    feature_intent_id: 'feature-2',
    use_case_key: 'UC-101',
    title: 'Use case B',
    content: { use_case_id: 'UC-101', review_status: 'approved' },
    review_status: 'approved',
    created_at: '2026-06-07T00:00:00Z',
    updated_at: '2026-06-07T00:00:00Z',
  },
];

const tree = {
  project,
  spec,
  features: [
    {
      id: 'feature-1',
      name: 'Feature A',
      updated_at: '2026-06-07T00:00:00Z',
      use_cases: useCases.map((item) => ({
        id: item.id,
        use_case_key: item.use_case_key,
        title: item.title,
        review_status: item.review_status,
        updated_at: item.updated_at,
        diagram:
          item.id === 'usecase-1'
            ? {
                id: 'diagram-1',
                title: 'Diagram A',
                semantic_edited: false,
                is_outdated: false,
                updated_at: item.updated_at,
                brd: null,
              }
            : null,
      })),
    },
    {
      id: 'feature-2',
      name: 'Feature B',
      updated_at: '2026-06-07T00:00:00Z',
      use_cases: useCasesB.map((item) => ({
        id: item.id,
        use_case_key: item.use_case_key,
        title: item.title,
        review_status: item.review_status,
        updated_at: item.updated_at,
        diagram: null,
      })),
    },
  ],
};

function RouteControls() {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate('/projects/project-1/features/missing')}>
      Invalid feature URL
    </button>
  );
}

function renderWorkspace(
  initialEntry = '/projects/project-1/features/feature-1/use-cases/usecase-1',
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <RouteControls />
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectWorkspace routeKind="root" />} />
        <Route path="/projects/:projectId/spec" element={<ProjectWorkspace routeKind="spec" />} />
        <Route
          path="/projects/:projectId/features/:featureId"
          element={<ProjectWorkspace routeKind="feature" />}
        />
        <Route
          path="/projects/:projectId/features/:featureId/use-cases"
          element={<ProjectWorkspace routeKind="use-cases" />}
        />
        <Route
          path="/projects/:projectId/features/:featureId/use-cases/:useCaseId"
          element={<ProjectWorkspace routeKind="use-case" />}
        />
        <Route
          path="/projects/:projectId/features/:featureId/use-cases/:useCaseId/diagram"
          element={<ProjectWorkspace routeKind="diagram" />}
        />
        <Route
          path="/projects/:projectId/features/:featureId/use-cases/:useCaseId/diagram/brd"
          element={<ProjectWorkspace routeKind="brd" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectWorkspace artifact-tree transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.getProjectArtifactTree.mockResolvedValue(tree);
    api.listFeatures.mockResolvedValue(features);
    api.listUseCases.mockImplementation((featureId: string) =>
      Promise.resolve(featureId === 'feature-2' ? useCasesB : useCases),
    );
    api.deleteFeature.mockResolvedValue(undefined);
  });

  it('clears the previous editor context when a valid route becomes invalid', async () => {
    renderWorkspace();
    expect(await screen.findByTestId('active-feature')).toHaveTextContent('feature-1');

    fireEvent.click(screen.getByRole('button', { name: 'Invalid feature URL' }));

    expect(
      await screen.findByText('Artifact không tồn tại trong project này hoặc bạn không có quyền.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('workspace-probe')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Về Project Spec' }));
    expect(await screen.findByRole('heading', { name: 'Project Spec' })).toBeVisible();
  });

  it('renders the persisted use-case workspace without mounting the canvas on use-case routes', async () => {
    renderWorkspace('/projects/project-1/features/feature-1/use-cases/usecase-1');

    expect(await screen.findByTestId('usecase-workspace-probe')).toBeVisible();
    expect(screen.getByTestId('active-artifact')).toHaveTextContent('use-case');
    expect(screen.queryByTestId('workspace-probe')).not.toBeInTheDocument();
  });

  it('renders the persisted brd workspace without mounting the canvas overlay on brd routes', async () => {
    renderWorkspace('/projects/project-1/features/feature-1/use-cases/usecase-1/diagram/brd');

    expect(await screen.findByTestId('brd-workspace-probe')).toBeVisible();
    expect(screen.getByTestId('active-artifact')).toHaveTextContent('brd');
    expect(screen.queryByTestId('workspace-probe')).not.toBeInTheDocument();
  });

  it('shows loading instead of the missing-editor error while feature resources are still hydrating for a deep-link use-case route', async () => {
    let resolveFeatures: ((value: typeof features) => void) | null = null;
    api.listFeatures.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFeatures = resolve;
        }),
    );

    renderWorkspace('/projects/project-1/features/feature-1/use-cases/usecase-1');

    expect(await screen.findByText('Đang tải dữ liệu thật từ server…')).toBeVisible();
    expect(screen.queryByText('Feature nguồn chưa sẵn sàng hoặc không còn tồn tại.')).not.toBeInTheDocument();

    const finishFeaturesLoad = resolveFeatures as ((value: typeof features) => void) | null;
    if (finishFeaturesLoad) {
      finishFeaturesLoad(features);
    }
    expect(await screen.findByTestId('usecase-workspace-probe')).toBeVisible();
  });

  it('guards a cross-feature tree switch and clears discarded feature scopes', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', { name: 'Dirty usecase' }));
    expect(screen.getByTestId('dirty-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('treeitem', { name: /Use case B/ }));

    expect(await screen.findByTestId('active-feature')).toHaveTextContent('feature-2');
    expect(screen.getByTestId('dirty-count')).toHaveTextContent('0');
  });

  it('keeps the current diagram save scope when the next persisted diagram fails to load', async () => {
    api.getDiagram.mockRejectedValue(new Error('Backend unavailable'));
    renderWorkspace(
      '/projects/project-1/features/feature-1/use-cases/usecase-1/diagram',
    );
    expect(await screen.findByTestId('active-artifact')).toHaveTextContent('diagram');
    fireEvent.click(screen.getByRole('button', { name: 'Dirty diagram' }));
    expect(screen.getByTestId('diagram-save-state')).toHaveTextContent('dirty');

    fireEvent.click(screen.getByRole('button', { name: 'Load failing diagram' }));

    await waitFor(() => expect(api.getDiagram).toHaveBeenCalledWith('usecase-2'));
    expect(screen.getByTestId('diagram-save-state')).toHaveTextContent('dirty');
  });

  it('keeps spaces and temporary newlines while editing Project Spec list fields', async () => {
    renderWorkspace('/projects/project-1/spec');
    const targetUsers = await screen.findByLabelText('Người dùng mục tiêu');

    fireEvent.change(targetUsers, { target: { value: 'Ban' } });
    fireEvent.change(targetUsers, { target: { value: 'Ban ' } });
    expect(targetUsers).toHaveValue('Ban ');

    fireEvent.change(targetUsers, { target: { value: 'Ban quản lý OCP2\n' } });
    expect(targetUsers).toHaveValue('Ban quản lý OCP2\n');
  });

  it('persists the collapsed artifact sidebar across workspace reloads', async () => {
    const firstRender = renderWorkspace('/projects/project-1/features/feature-1/use-cases/usecase-1/diagram');
    expect(await screen.findByTestId('workspace-probe')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn thanh điều hướng artifact' }));

    expect(window.localStorage.getItem('artifact-sidebar:collapsed')).toBe('true');
    expect(screen.queryByRole('tree', { name: 'Cấu trúc project' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở thanh điều hướng artifact' })).toBeVisible();

    firstRender.unmount();

    renderWorkspace('/projects/project-1/features/feature-1/use-cases/usecase-1/diagram');

    expect(await screen.findByRole('button', { name: 'Mở thanh điều hướng artifact' })).toBeVisible();
    expect(screen.queryByRole('tree', { name: 'Cấu trúc project' })).not.toBeInTheDocument();
  });
});
