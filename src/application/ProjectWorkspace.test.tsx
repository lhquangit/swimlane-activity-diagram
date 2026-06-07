import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProjectWorkspace from './ProjectWorkspace';

const api = vi.hoisted(() => ({
  getProject: vi.fn(),
  getSpec: vi.fn(),
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
    title: 'Use case 1',
    content: { use_case_id: 'UC-001', review_status: 'approved' },
    review_status: 'approved',
    created_at: '2026-06-07T00:00:00Z',
    updated_at: '2026-06-07T00:00:00Z',
  },
  {
    id: 'usecase-2',
    feature_intent_id: 'feature-1',
    use_case_key: 'UC-002',
    title: 'Use case 2',
    content: { use_case_id: 'UC-002', review_status: 'approved' },
    review_status: 'approved',
    created_at: '2026-06-07T00:00:00Z',
    updated_at: '2026-06-07T00:00:00Z',
  },
];

function RouteControls() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/projects/project-1/features/missing')}>Invalid feature URL</button>;
}

function renderWorkspace(initialEntry = '/projects/project-1/features/feature-1') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/projects/:projectId/features/:featureId"
          element={
            <>
              <RouteControls />
              <ProjectWorkspace />
            </>
          }
        />
        <Route path="/projects/:projectId" element={<ProjectWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectWorkspace persistence transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getProject.mockResolvedValue(project);
    api.getSpec.mockResolvedValue(spec);
    api.listFeatures.mockResolvedValue(features);
    api.listUseCases.mockResolvedValue(useCases);
    api.deleteFeature.mockResolvedValue(undefined);
  });

  it('clears the previous editor context when a valid route becomes invalid', async () => {
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', { name: '3. Use Case, Diagram & BRD' }));
    expect(await screen.findByTestId('active-feature')).toHaveTextContent('feature-1');

    fireEvent.click(screen.getByRole('button', { name: 'Invalid feature URL' }));

    expect(
      await screen.findByText('Feature không tồn tại trong project này hoặc bạn không có quyền.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('workspace-probe')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Mở feature đầu tiên' }));
    expect(await screen.findByTestId('active-feature')).toHaveTextContent('feature-1');
  });

  it('clears discarded feature scopes before opening another feature', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', { name: '3. Use Case, Diagram & BRD' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dirty diagram' }));
    expect(screen.getByTestId('dirty-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: '2. Features' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Feature B' }));

    expect(await screen.findByTestId('active-feature')).toHaveTextContent('feature-2');
    expect(screen.getByTestId('dirty-count')).toHaveTextContent('0');
  });

  it('keeps the current diagram save scope when the next persisted diagram fails to load', async () => {
    api.getDiagram.mockRejectedValue(new Error('Backend unavailable'));
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', { name: '3. Use Case, Diagram & BRD' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dirty diagram' }));
    expect(screen.getByTestId('diagram-save-state')).toHaveTextContent('dirty');

    fireEvent.click(screen.getByRole('button', { name: 'Load failing diagram' }));

    await waitFor(() => expect(api.getDiagram).toHaveBeenCalledWith('usecase-2'));
    expect(screen.getByTestId('diagram-save-state')).toHaveTextContent('dirty');
  });

  it('keeps spaces and temporary newlines while editing Project Spec list fields', async () => {
    renderWorkspace('/projects/project-1');
    const targetUsers = await screen.findByLabelText('Người dùng mục tiêu');

    fireEvent.change(targetUsers, { target: { value: 'Ban' } });
    fireEvent.change(targetUsers, { target: { value: 'Ban ' } });
    expect(targetUsers).toHaveValue('Ban ');

    fireEvent.change(targetUsers, { target: { value: 'Ban quản lý OCP2\n' } });
    expect(targetUsers).toHaveValue('Ban quản lý OCP2\n');

    fireEvent.change(targetUsers, {
      target: { value: 'Ban quản lý OCP2\nCư dân OCP2' },
    });
    expect(targetUsers).toHaveValue('Ban quản lý OCP2\nCư dân OCP2');
  });
});
