import type { ResponseEnvelope } from '../brd/types';
import type {
  UseCaseGenerationRequest,
  UseCaseGenerationResult,
  DiagramGenerationResult,
  UseCaseDraft,
} from './types';

const fallbackBaseUrl = `${window.location.protocol}//${window.location.hostname}:8000`;
const API_BASE_URL = (
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_BRD_API_URL || fallbackBaseUrl
).replace(/\/$/, '');

export async function generateUseCases(
  request: UseCaseGenerationRequest,
): Promise<ResponseEnvelope<UseCaseGenerationResult>> {
  const response = await fetch(`${API_BASE_URL}/api/usecases/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Schema-Version': '2026-05-31',
    },
    body: JSON.stringify(request),
  });

  const payload = (await response.json()) as ResponseEnvelope<UseCaseGenerationResult>;
  if (!response.ok) {
    throw new Error(payload.error?.message || `Use case generation failed (${response.status})`);
  }
  return payload;
}

export async function generateUseCaseDiagram(
  useCase: UseCaseDraft,
): Promise<ResponseEnvelope<DiagramGenerationResult>> {
  const response = await fetch(`${API_BASE_URL}/api/diagrams/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Schema-Version': '2026-05-31',
    },
    body: JSON.stringify({ use_case: useCase, language: 'vi' }),
  });

  const payload = (await response.json()) as ResponseEnvelope<DiagramGenerationResult>;
  if (!response.ok) {
    throw new Error(payload.error?.message || `Diagram generation failed (${response.status})`);
  }
  return payload;
}
