import {
  DiagramSemanticRequest,
  GenerateBrdRequest,
  GenerateResult,
  ResponseEnvelope,
  ValidationResult,
} from './types';

const fallbackBaseUrl = `${window.location.protocol}//${window.location.hostname}:8000`;
const API_BASE_URL = (
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_BRD_API_URL || fallbackBaseUrl
).replace(/\/$/, '');

async function parseResponse<T>(response: Response): Promise<ResponseEnvelope<T>> {
  const payload = (await response.json()) as ResponseEnvelope<T>;
  if (!response.ok) {
    const message = payload.error?.message || `Backend request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

export async function validateDiagram(
  request: DiagramSemanticRequest,
): Promise<ResponseEnvelope<ValidationResult>> {
  const response = await fetch(`${API_BASE_URL}/api/brd/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Schema-Version': '2026-05-31',
    },
    body: JSON.stringify(request),
  });

  if (response.status >= 400) {
    const payload = (await response.json()) as ResponseEnvelope<ValidationResult>;
    throw new Error(payload.error?.message || `Validation failed (${response.status})`);
  }

  return (await response.json()) as ResponseEnvelope<ValidationResult>;
}

export async function generateBrd(
  request: GenerateBrdRequest,
  idempotencyKey: string,
): Promise<{ statusCode: number; payload: ResponseEnvelope<GenerateResult> }> {
  const response = await fetch(`${API_BASE_URL}/api/brd/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Schema-Version': '2026-05-31',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(request),
  });

  const payload = (await response.json()) as ResponseEnvelope<GenerateResult>;
  return { statusCode: response.status, payload };
}
