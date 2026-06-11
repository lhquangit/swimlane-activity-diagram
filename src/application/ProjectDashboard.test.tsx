import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProjectDashboard from './ProjectDashboard';

const api = vi.hoisted(() => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
}));

vi.mock('@clerk/react', () => ({
  UserButton: () => <div data-testid="user-button" />,
}));

vi.mock('../persistence/api', () => ({
  ApiError: class ApiError extends Error {},
  usePersistenceApi: () => api,
}));

describe('ProjectDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listProjects.mockResolvedValue([
      {
        id: 'project-1',
        name: 'Smart Diagram',
        description: null,
        created_at: '2026-06-11T00:00:00Z',
        updated_at: '2026-06-11T00:00:00Z',
      },
      {
        id: 'project-2',
        name: 'GPS Rollout',
        description: 'Theo dõi quy trình cấp phát GPS.',
        created_at: '2026-06-11T00:00:00Z',
        updated_at: '2026-06-11T00:00:00Z',
      },
    ]);
  });

  it('keeps dashboard cards focused on project identity instead of placeholder and timestamp chrome', async () => {
    render(
      <MemoryRouter>
        <ProjectDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Smart Diagram')).toBeVisible();
    expect(screen.queryByText(/đi lần lượt qua từng artifact/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa có mô tả')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cập nhật/)).not.toBeInTheDocument();
    expect(screen.getByText('Theo dõi quy trình cấp phát GPS.')).toBeVisible();

    await waitFor(() => expect(api.listProjects).toHaveBeenCalledTimes(1));
  });

  it('shows a row-level pending state while deleting a project', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    let resolveDelete!: () => void;
    api.deleteProject.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );

    render(
      <MemoryRouter>
        <ProjectDashboard />
      </MemoryRouter>,
    );

    const projectButton = await screen.findByRole('button', { name: 'Smart Diagram' });
    const projectCard = projectButton.closest('article');
    if (!projectCard) throw new Error('Expected project card for Smart Diagram.');

    fireEvent.click(within(projectCard).getByRole('button', { name: 'Xóa' }));

    await waitFor(() => expect(api.deleteProject).toHaveBeenCalledWith('project-1'));
    expect(within(projectCard).getByRole('button', { name: 'Đang xóa…' })).toBeDisabled();
    expect(within(projectCard).getByRole('button', { name: 'Smart Diagram' })).toBeDisabled();

    resolveDelete();

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Smart Diagram' })).not.toBeInTheDocument(),
    );
  });
});
