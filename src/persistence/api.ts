import { useAuth } from '@clerk/react';
import { useMemo } from 'react';

import type {
  BrdDocxExportPayload,
  BrdResource,
  BrdSavePayload,
  DiagramResource,
  DiagramSavePayload,
  FeatureIntentResource,
  ProjectResource,
  ProjectArtifactTree,
  SpecResource,
  UseCaseResource,
  WorkspaceDiagramGenerationResponse,
  WorkspaceGenerationResponse,
} from './types';
import type { FeatureIntent, UseCaseDraft } from '../usecases/types';
import type { GenerateResult, ResponseEnvelope, ResponseMetadata } from '../brd/types';

const fallbackBaseUrl = `${window.location.protocol}//${window.location.hostname}:8000`;
const API_BASE_URL = (import.meta.env.VITE_BRD_API_URL || fallbackBaseUrl).replace(/\/$/, '');

type TokenProvider = () => Promise<string | null>;
const localAuthDisabledTokenProvider: TokenProvider = async () => 'local-auth-disabled';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class PersistenceApi {
  constructor(private readonly getToken: TokenProvider) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    if (!token) throw new ApiError('Bạn cần đăng nhập để tiếp tục.', 401);
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Schema-Version', '2026-05-31');
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    if (response.status === 204) return undefined as T;
    const payload = (await response.json()) as {
      detail?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new ApiError(
        payload.error?.message || payload.detail || `Backend request failed (${response.status})`,
        response.status,
      );
    }
    return payload as T;
  }

  private async requestBlob(path: string, init: RequestInit = {}): Promise<Blob> {
    const token = await this.getToken();
    if (!token) throw new ApiError('Bạn cần đăng nhập để tiếp tục.', 401);
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Schema-Version', '2026-05-31');
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    if (!response.ok) {
      let message = `Backend request failed (${response.status})`;
      try {
        const payload = (await response.json()) as {
          detail?: string;
          error?: { message?: string };
        };
        message = payload.error?.message || payload.detail || message;
      } catch {
        // Keep the generic message when the response is a binary payload or plain text.
      }
      throw new ApiError(message, response.status);
    }
    return response.blob();
  }

  listProjects() {
    return this.request<ProjectResource[]>('/api/projects');
  }

  createProject(payload: { name: string; description?: string | null }) {
    return this.request<ProjectResource>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  getProject(id: string) {
    return this.request<ProjectResource>(`/api/projects/${id}`);
  }

  getProjectArtifactTree(id: string) {
    return this.request<ProjectArtifactTree>(`/api/projects/${id}/artifact-tree`);
  }

  updateProject(id: string, payload: { name: string; description?: string | null }) {
    return this.request<ProjectResource>(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteProject(id: string) {
    return this.request<void>(`/api/projects/${id}`, { method: 'DELETE' });
  }

  getSpec(projectId: string) {
    return this.request<SpecResource>(`/api/projects/${projectId}/spec`);
  }

  updateSpec(projectId: string, payload: Omit<SpecResource, 'id' | 'project_id' | 'created_at' | 'updated_at'>) {
    return this.request<SpecResource>(`/api/projects/${projectId}/spec`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  listFeatures(specId: string) {
    return this.request<FeatureIntentResource[]>(`/api/specs/${specId}/feature-intents`);
  }

  getFeature(id: string) {
    return this.request<FeatureIntentResource>(`/api/feature-intents/${id}`);
  }

  createFeature(specId: string, payload: FeaturePayload) {
    return this.request<FeatureIntentResource>(`/api/specs/${specId}/feature-intents`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateFeature(id: string, payload: FeaturePayload) {
    return this.request<FeatureIntentResource>(`/api/feature-intents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteFeature(id: string) {
    return this.request<void>(`/api/feature-intents/${id}`, { method: 'DELETE' });
  }

  generateUseCases(featureId: string, preference: string) {
    return this.request<WorkspaceGenerationResponse>(
      `/api/feature-intents/${featureId}/use-cases/generate?generation_preference=${encodeURIComponent(preference)}`,
      { method: 'POST' },
    );
  }

  listUseCases(featureId: string) {
    return this.request<UseCaseResource[]>(`/api/feature-intents/${featureId}/use-cases`);
  }

  saveUseCases(
    featureId: string,
    resources: UseCaseResource[],
    drafts: UseCaseDraft[],
    committedGenerationMetadata?: ResponseMetadata | null,
  ) {
    const idByKey = new Map(resources.map((item) => [item.use_case_key, item.id]));
    return this.request<UseCaseResource[]>(`/api/feature-intents/${featureId}/use-cases`, {
      method: 'PUT',
      body: JSON.stringify({
        items: drafts.map((content) => ({
          id: idByKey.get(content.use_case_id) ?? null,
          content,
        })),
        committed_generation_metadata: committedGenerationMetadata ?? null,
      }),
    });
  }

  deleteUseCase(id: string) {
    return this.request<void>(`/api/use-cases/${id}`, { method: 'DELETE' });
  }

  generateDiagram(useCaseId: string) {
    return this.request<WorkspaceDiagramGenerationResponse>(
      `/api/use-cases/${useCaseId}/diagram/generate`,
      { method: 'POST' },
    );
  }

  getDiagram(useCaseId: string) {
    return this.request<DiagramResource | null>(`/api/use-cases/${useCaseId}/diagram`);
  }

  saveDiagram(useCaseId: string, payload: DiagramSavePayload) {
    return this.request<DiagramResource>(`/api/use-cases/${useCaseId}/diagram`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  getBrd(diagramId: string) {
    return this.request<BrdResource | null>(`/api/diagrams/${diagramId}/brd`);
  }

  generateBrd(diagramId: string, idempotencyKey: string, template: 'default' | 'full') {
    return this.request<ResponseEnvelope<GenerateResult>>(
      `/api/diagrams/${diagramId}/brd/generate?template=${template}`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
      },
    );
  }

  saveBrd(diagramId: string, payload: BrdSavePayload) {
    return this.request<BrdResource>(`/api/diagrams/${diagramId}/brd`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  exportBrdDocx(diagramId: string, payload: BrdDocxExportPayload) {
    return this.requestBlob(`/api/diagrams/${diagramId}/brd/export.docx`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export type FeaturePayload = {
  name: string;
  feature_summary: string;
  actors: string[];
  trigger?: string | null;
  inputs: string[];
  outputs: string[];
  constraints: string[];
  assumptions: string[];
  systems_involved: string[];
  success_outcome?: string | null;
};

export function featurePayload(intent: FeatureIntent): FeaturePayload {
  return {
    name: intent.feature_name,
    feature_summary: intent.feature_summary,
    actors: intent.actors ?? (intent.primary_actor ? [intent.primary_actor] : []),
    trigger: intent.trigger,
    inputs: intent.inputs,
    outputs: intent.outputs,
    constraints: intent.constraints,
    assumptions: intent.assumptions,
    systems_involved: intent.systems_involved,
    success_outcome: intent.success_outcome,
  };
}

export function usePersistenceApi() {
  const { getToken } = useAuth();
  const tokenProvider =
    import.meta.env.VITE_AUTH_DISABLED === 'true'
      ? localAuthDisabledTokenProvider
      : getToken;
  return useMemo(() => new PersistenceApi(tokenProvider), [tokenProvider]);
}
