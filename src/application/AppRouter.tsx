import { Show, SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import ProjectDashboard from './ProjectDashboard';
import ProjectWorkspace from './ProjectWorkspace';
import App from '../App';

function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-card">
        <span className="workspace-eyebrow">V-PetSafe</span>
        <h1>Thiết kế quy trình từ bối cảnh đến BRD</h1>
        <p>
          Mỗi tài khoản quản lý nhiều project. Mỗi project giữ một Spec và chuỗi artifact mới
          nhất: Feature Intent, Use Case, Diagram và BRD.
        </p>
        <div className="landing-actions">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="workspace-button primary">Đăng nhập</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="workspace-button">Tạo tài khoản</button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <a className="workspace-button primary" href="/projects">
              Mở danh sách project
            </a>
            <UserButton />
          </Show>
        </div>
      </section>
    </main>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  if (!isLoaded) return <main className="workspace-loading">Đang kiểm tra phiên đăng nhập…</main>;
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <Navigate to="/" replace />
      </Show>
    </>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        {import.meta.env.DEV ? <Route path="/demo" element={<App />} /> : null}
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <ProtectedRoute>
              <ProjectWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/features/:featureId"
          element={
            <ProtectedRoute>
              <ProjectWorkspace />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
