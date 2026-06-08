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
    if (!window.confirm(`Xóa project "${project.name}" và toàn bộ artifact bên trong?`)) return;
    try {
      await api.deleteProject(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  return (
    <main className="project-dashboard">
      <header className="workspace-header">
        <div>
          <span className="workspace-eyebrow">Smart Diagram</span>
          <h1>Projects</h1>
          <p>Tạo project, hoàn thiện Spec, rồi đi lần lượt qua từng artifact.</p>
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
        {projects.map((project) => (
          <article className="project-card" key={project.id}>
            <button
              className="project-card__main"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <strong>{project.name}</strong>
              <span>{project.description || 'Chưa có mô tả'}</span>
              <small>Cập nhật {new Date(project.updated_at).toLocaleString('vi-VN')}</small>
            </button>
            <button className="workspace-button danger" onClick={() => void deleteProject(project)}>
              Xóa
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}

function errorMessage(reason: unknown) {
  if (reason instanceof ApiError || reason instanceof Error) return reason.message;
  return 'Không thể kết nối backend.';
}
