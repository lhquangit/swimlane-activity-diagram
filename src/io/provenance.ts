import type { DiagramTrace } from '../usecases/types';
import type { EditorGraphData } from './drawio-types';

export const DIAGRAM_PROVENANCE_VERSION = 1 as const;

export type DiagramElementProvenance = {
  version: typeof DIAGRAM_PROVENANCE_VERSION;
  origin: 'generated' | 'manual' | 'imported';
  trusted: boolean;
  use_case_id?: string;
  trace?: DiagramTrace;
  modified?: boolean;
};

export type TraceCoverage = {
  total: number;
  traced: number;
  manual: number;
  untrusted: number;
};

export function generatedProvenance(trace: DiagramTrace): DiagramElementProvenance {
  return {
    version: DIAGRAM_PROVENANCE_VERSION,
    origin: 'generated',
    trusted: true,
    use_case_id: trace.use_case_id,
    trace,
  };
}

export function manualProvenance(useCaseId?: string | null): DiagramElementProvenance {
  return {
    version: DIAGRAM_PROVENANCE_VERSION,
    origin: 'manual',
    trusted: true,
    ...(useCaseId ? { use_case_id: useCaseId } : {}),
  };
}

export function importedProvenance(): DiagramElementProvenance {
  return {
    version: DIAGRAM_PROVENANCE_VERSION,
    origin: 'imported',
    trusted: false,
  };
}

export function readProvenance(
  properties?: Record<string, unknown>,
): DiagramElementProvenance | null {
  const parsed = parseProvenance(properties?.provenance);
  if (parsed) return parsed;
  const trace = parseTrace(properties?.trace);
  return trace ? generatedProvenance(trace) : null;
}

export function markProvenanceModified(
  properties?: Record<string, unknown>,
): DiagramElementProvenance {
  const provenance = readProvenance(properties) ?? importedProvenance();
  return provenance.origin === 'generated'
    ? { ...provenance, modified: true }
    : provenance;
}

export function serializeProvenance(properties?: Record<string, unknown>) {
  const provenance = readProvenance(properties);
  return provenance ? encodeURIComponent(JSON.stringify(provenance)) : null;
}

export function deserializeProvenance(value: string | null): DiagramElementProvenance {
  if (!value) return importedProvenance();
  try {
    return parseProvenance(JSON.parse(decodeURIComponent(value))) ?? importedProvenance();
  } catch {
    return importedProvenance();
  }
}

export function provenanceProperties(provenance: DiagramElementProvenance) {
  return {
    provenance,
    ...(provenance.trace ? { trace: provenance.trace } : {}),
  };
}

export function buildTraceCoverage(graph: EditorGraphData): TraceCoverage {
  const elements = [
    ...(graph.nodes ?? []).filter((node) => node.type !== 'lane'),
    ...(graph.edges ?? []),
  ];
  return elements.reduce<TraceCoverage>(
    (coverage, element) => {
      const provenance = readProvenance(element.properties);
      coverage.total += 1;
      if (provenance?.trace) coverage.traced += 1;
      if (provenance?.origin === 'manual') coverage.manual += 1;
      if (!provenance?.trusted) coverage.untrusted += 1;
      return coverage;
    },
    { total: 0, traced: 0, manual: 0, untrusted: 0 },
  );
}

export function normalizeImportedGraphProvenance(graph: EditorGraphData): EditorGraphData {
  return {
    nodes: graph.nodes?.map((node) => {
      const provenance = readProvenance(node.properties) ?? importedProvenance();
      return {
        ...node,
        properties: {
          ...(node.properties ?? {}),
          ...provenanceProperties(provenance),
        },
      };
    }),
    edges: graph.edges?.map((edge) => {
      const provenance = readProvenance(edge.properties) ?? importedProvenance();
      return {
        ...edge,
        properties: {
          ...(edge.properties ?? {}),
          ...provenanceProperties(provenance),
        },
      };
    }),
  };
}

function parseProvenance(value: unknown): DiagramElementProvenance | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<DiagramElementProvenance>;
  const origin = candidate.origin;
  if (
    candidate.version !== DIAGRAM_PROVENANCE_VERSION ||
    (origin !== 'generated' && origin !== 'manual' && origin !== 'imported') ||
    typeof candidate.trusted !== 'boolean'
  ) {
    return null;
  }
  const trace = parseTrace(candidate.trace);
  if (origin === 'generated' && !trace) return null;
  return {
    version: DIAGRAM_PROVENANCE_VERSION,
    origin,
    trusted: candidate.trusted,
    ...(typeof candidate.use_case_id === 'string'
      ? { use_case_id: candidate.use_case_id }
      : {}),
    ...(trace ? { trace } : {}),
    ...(candidate.modified === true ? { modified: true } : {}),
  };
}

function parseTrace(value: unknown): DiagramTrace | null {
  if (!value || typeof value !== 'object') return null;
  const trace = value as Partial<DiagramTrace>;
  const sourceKinds = [
    'use_case',
    'main_step',
    'alternate_flow',
    'precondition',
    'success_outcome',
    'terminal_outcome',
  ];
  if (
    typeof trace.use_case_id !== 'string' ||
    typeof trace.source_id !== 'string' ||
    !sourceKinds.includes(trace.source_kind ?? '')
  ) {
    return null;
  }
  return trace as DiagramTrace;
}
