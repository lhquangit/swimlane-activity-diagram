import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ArtifactTree from './ArtifactTree';
import type { ProjectArtifactTree } from '../persistence/types';

const tree: ProjectArtifactTree = {
  project: {
    id: 'project-1',
    name: 'Smart Diagram',
    description: null,
    created_at: '2026-06-07T00:00:00Z',
    updated_at: '2026-06-07T00:00:00Z',
  },
  spec: {
    id: 'spec-1',
    project_id: 'project-1',
    project_summary: 'Pet operations',
    business_context: null,
    target_users: [],
    business_rules: [],
    glossary: [],
    created_at: '2026-06-07T00:00:00Z',
    updated_at: '2026-06-07T00:00:00Z',
  },
  features: [
    {
      id: 'feature-1',
      name: 'Định danh thú nuôi',
      updated_at: '2026-06-07T00:00:00Z',
      use_cases: [
        {
          id: 'usecase-1',
          use_case_key: 'UC-001',
          title: 'Gửi yêu cầu định danh',
          review_status: 'approved',
          updated_at: '2026-06-07T00:00:00Z',
          diagram: null,
        },
      ],
    },
  ],
};

describe('ArtifactTree', () => {
  it('renders the real hierarchy and absent child states without sample data', () => {
    render(
      <ArtifactTree
        tree={tree}
        active={{ kind: 'use-case', featureId: 'feature-1', useCaseId: 'usecase-1' }}
        onSelect={vi.fn()}
        onCreateFeature={vi.fn()}
      />,
    );

    expect(screen.getByRole('tree', { name: 'Cấu trúc project' })).toBeVisible();
    expect(screen.getByText('Project Spec')).toBeVisible();
    expect(screen.getByText('Định danh thú nuôi')).toBeVisible();
    expect(screen.getByText('Gửi yêu cầu định danh')).toBeVisible();
    expect(screen.getByText('Diagram chưa tạo')).toBeVisible();
    expect(screen.getByText('BRD cần Diagram')).toBeVisible();
    expect(screen.queryByText('Tiếp nhận tín hiệu ban đầu')).not.toBeInTheDocument();
  });

  it('emits the selected artifact identity', () => {
    const onSelect = vi.fn();
    render(
      <ArtifactTree
        tree={tree}
        active={{ kind: 'spec' }}
        onSelect={onSelect}
        onCreateFeature={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('treeitem', { name: /Gửi yêu cầu định danh/ }));
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'use-case',
      featureId: 'feature-1',
      useCaseId: 'usecase-1',
    });
  });

  it('moves focus through visible tree items with arrow keys', () => {
    render(
      <ArtifactTree
        tree={tree}
        active={{ kind: 'spec' }}
        onSelect={vi.fn()}
        onCreateFeature={vi.fn()}
      />,
    );

    const items = screen.getAllByRole('treeitem');
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1], { key: 'End' });
    expect(items[items.length - 1]).toHaveFocus();
  });
});
