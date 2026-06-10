import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProjectWorkspace from './ProjectWorkspace';
import type { BrdSpec } from '../brd/types';

const api = vi.hoisted(() => ({
  getProjectArtifactTree: vi.fn(),
  listFeatures: vi.fn(),
  listUseCases: vi.fn(),
  getDiagram: vi.fn(),
  getBrd: vi.fn(),
}));

vi.mock('@clerk/react', () => ({
  UserButton: () => <div data-testid="user-button" />,
  useUser: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../persistence/api', () => ({
  featurePayload: (value: unknown) => value,
  usePersistenceApi: () => api,
}));

vi.mock('../App', () => ({
  default: () => <div data-testid="canvas-probe" />,
}));

vi.mock('../usecases/PersistedUseCaseWorkspace', () => ({
  default: () => <div data-testid="usecase-workspace-probe" />,
}));

const timestamp = '2026-06-10T00:00:00Z';

const project = {
  id: 'project-1',
  name: 'Demo project',
  description: null,
  created_at: timestamp,
  updated_at: timestamp,
};

const projectSpec = {
  id: 'spec-1',
  project_id: project.id,
  project_summary: 'Demo spec',
  business_context: null,
  target_users: [],
  business_rules: [],
  glossary: [],
  created_at: timestamp,
  updated_at: timestamp,
};

const feature = {
  id: 'feature-1',
  spec_id: projectSpec.id,
  name: 'Feature A',
  feature_summary: 'Feature summary',
  actors: ['User'],
  trigger: null,
  inputs: [],
  outputs: [],
  constraints: [],
  assumptions: [],
  systems_involved: [],
  success_outcome: null,
  created_at: timestamp,
  updated_at: timestamp,
};

const useCase = {
  id: 'usecase-1',
  feature_intent_id: feature.id,
  use_case_key: 'UC-001',
  title: 'Review saved BRD',
  content: {
    use_case_id: 'UC-001',
    title: 'Review saved BRD',
    objective: 'Open the persisted BRD.',
    primary_actor: 'User',
    supporting_actors: [],
    preconditions: [],
    happy_path_summary: [],
    key_exceptions: [],
    main_flow_steps: [],
    alternate_flows: [],
    success_outcome: 'BRD is visible.',
    review_status: 'approved',
  },
  review_status: 'approved',
  created_at: timestamp,
  updated_at: timestamp,
};

const diagram = {
  id: 'diagram-1',
  use_case_id: useCase.id,
  title: 'Review saved BRD diagram',
  graph_data: {},
  lanes_data: [],
  lane_height: 720,
  semantic_edited: false,
  source_use_case_updated_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
  is_outdated: false,
};

const brdSpec: BrdSpec = {
  metadata: {
    diagram_name: 'Review saved BRD',
    source_language: 'vi',
    generated_language: 'vi',
    generated_at: timestamp,
    generator_model: 'mock',
    generator_version: 'mock-v1',
  },
  summary: 'Persisted BRD summary',
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

const brd = {
  id: 'brd-1',
  diagram_id: diagram.id,
  title: 'Persisted BRD',
  structured_spec: brdSpec,
  markdown_content: '# Persisted BRD\n\nLoaded once.',
  warnings: [],
  template: 'default' as const,
  source_diagram_updated_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
  is_outdated: false,
};

const tree = {
  project,
  spec: projectSpec,
  features: [
    {
      id: feature.id,
      name: feature.name,
      updated_at: timestamp,
      use_cases: [
        {
          id: useCase.id,
          use_case_key: useCase.use_case_key,
          title: useCase.title,
          review_status: useCase.review_status,
          updated_at: timestamp,
          diagram: {
            id: diagram.id,
            title: diagram.title,
            semantic_edited: false,
            is_outdated: false,
            updated_at: timestamp,
            brd: {
              id: brd.id,
              title: brd.title,
              template: brd.template,
              is_outdated: false,
              updated_at: timestamp,
            },
          },
        },
      ],
    },
  ],
};

describe('ProjectWorkspace persisted BRD loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getProjectArtifactTree.mockResolvedValue(tree);
    api.listFeatures.mockResolvedValue([feature]);
    api.listUseCases.mockResolvedValue([useCase]);
    api.getDiagram
      .mockResolvedValueOnce(diagram)
      .mockRejectedValue(new Error('Diagram was fetched more than once.'));
    api.getBrd.mockResolvedValue(brd);
  });

  it('loads the source diagram and BRD once for a stable deep link', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/projects/project-1/features/feature-1/use-cases/usecase-1/diagram/brd',
        ]}
      >
        <Routes>
          <Route
            path="/projects/:projectId/features/:featureId/use-cases/:useCaseId/diagram/brd"
            element={<ProjectWorkspace routeKind="brd" />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findAllByRole('heading', { name: 'Persisted BRD' })).not.toHaveLength(0);
    expect(screen.getByText('Loaded once.')).toBeVisible();
    expect(screen.queryByPlaceholderText('BRD markdown sẽ xuất hiện ở đây.')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(api.getDiagram).toHaveBeenCalledTimes(1);
      expect(api.getBrd).toHaveBeenCalledTimes(1);
    });
  });
});
