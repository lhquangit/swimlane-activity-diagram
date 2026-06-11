import { UserButton } from '@clerk/react';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError, usePersistenceApi } from '../persistence/api';
import type { ProjectResource } from '../persistence/types';

export default function ProjectDashboard() {
  const api = usePersistenceApi();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectResource[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .listProjects()
      .then((items) => active && setProjects(items))
      .catch((reason) => active && setError(errorMessage(reason)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [api]);

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const project = await api.createProject({
        name: name.trim(),
        description: description.trim() || null,
      });
      navigate(`/projects/${project.id}`);
    } catch (reason) {
      setError(errorMessage(reason));
      setCreating(false);
    }
  };

  const deleteProject = async (project: ProjectResource) => {
    if (deletingProjectId === project.id) return;
    if (!window.confirm(`Xóa project "${project.name}" và toàn bộ artifact bên trong?`)) return;
    setDeletingProjectId(project.id);
    setError(null);
    try {
      await api.deleteProject(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDeletingProjectId((current) => (current === project.id ? null : current));
    }
  };

  return (
    <main className="project-dashboard">
      <header className="workspace-header">
        <div>
          <span className="workspace-eyebrow">Smart Diagram</span>
          <h1>Projects</h1>
          <p>Quản lý các project nghiệp vụ đang triển khai.</p>
        </div>
        <UserButton />
      </header>

      <section className="project-create-card">
        <h2>Tạo project mới</h2>
        <form onSubmit={createProject} className="project-create-form">
          <label>
            Tên project
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Mô tả ngắn
            <input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <button className="workspace-button primary" disabled={creating}>
            {creating ? 'Đang tạo…' : 'Tạo project'}
          </button>
        </form>
        {error ? <p className="workspace-error">{error}</p> : null}
      </section>

      <section className="project-list" aria-label="Danh sách project">
        {loading ? <p>Đang tải projects…</p> : null}
        {!loading && projects.length === 0 ? (
          <div className="workspace-empty">
            <h2>Chưa có project</h2>
            <p>Tạo project đầu tiên để bắt đầu nhập bối cảnh nghiệp vụ.</p>
          </div>
        ) : null}
        {projects.map((project) => {
          const deleting = deletingProjectId === project.id;
          return (
          <article className="project-card" key={project.id}>
            <button
              className="project-card__main"
              disabled={deleting}
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <strong>{project.name}</strong>
              {project.description ? <span>{project.description}</span> : null}
            </button>
            <button
              className="workspace-button danger"
              onClick={() => void deleteProject(project)}
              disabled={deleting}
            >
              {deleting ? 'Đang xóa…' : 'Xóa'}
            </button>
          </article>
        )})}
      </section>
    </main>
  );
}

function errorMessage(reason: unknown) {
  if (reason instanceof ApiError || reason instanceof Error) return reason.message;
  return 'Không thể kết nối backend.';
}
