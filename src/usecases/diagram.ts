import { buildLaneNodes } from '../lf-config';
import type { EditorGraphData } from '../io/drawio-types';
import { withPositions, type LaneConfig } from '../lane-config';
import type { DiagramDraft, UseCaseDraft } from './types';
import {
  buildTraceCoverage,
  generatedProvenance,
  type TraceCoverage,
} from '../io/provenance';

export type DiagramWorkspaceEntry = {
  draft: DiagramDraft;
  graph: EditorGraphData;
  lanes: LaneConfig[];
  laneHeight: number;
  sourceFingerprint: string;
  semanticEdited: boolean;
  phase: 'ready' | 'generating' | 'failed';
  errorMessage?: string | null;
  traceCoverage: TraceCoverage;
};

export function buildUseCaseFingerprint(useCase: UseCaseDraft) {
  const { review_status: _reviewStatus, ...content } = useCase;
  return JSON.stringify(content);
}

export function diagramDraftToWorkspace(
  draft: DiagramDraft,
  sourceUseCase: UseCaseDraft,
): DiagramWorkspaceEntry {
  const lanes = withPositions(
    [...draft.lanes]
      .sort((a, b) => a.order - b.order)
      .map((lane) => ({ id: lane.id, title: lane.title, width: lane.width })),
  );
  const laneHeight = Math.max(
    520,
    ...draft.nodes.map((node) => node.y + 160),
  );
  const graph: EditorGraphData = {
    nodes: [
      ...buildLaneNodes(lanes, laneHeight),
      ...draft.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        x: node.x,
        y: node.y,
        text: node.text
          ? {
              value: node.text,
              x: node.x,
              y: node.y,
            }
          : undefined,
        properties: {
          ...node.properties,
          trace: node.trace,
          provenance: generatedProvenance(node.trace),
          laneId: node.lane_id ?? undefined,
        },
      })),
    ],
    edges: draft.edges.map((edge) => ({
      id: edge.id,
      type: 'polyline',
      sourceNodeId: edge.source_node_id,
      targetNodeId: edge.target_node_id,
      text: edge.label ?? undefined,
      properties: {
        trace: edge.trace,
        provenance: generatedProvenance(edge.trace),
      },
    })),
  };

  return {
    draft,
    graph,
    lanes,
    laneHeight,
    sourceFingerprint: buildUseCaseFingerprint(sourceUseCase),
    semanticEdited: false,
    phase: 'ready',
    errorMessage: null,
    traceCoverage: buildTraceCoverage(graph),
  };
}

export function deriveDiagramArtifactState(
  useCase: UseCaseDraft,
  entry?: DiagramWorkspaceEntry,
) {
  if (!entry) return 'not_started' as const;
  if (entry.phase === 'generating') return 'generating' as const;
  if (entry.phase === 'failed') return 'failed' as const;
  if (entry.sourceFingerprint !== buildUseCaseFingerprint(useCase)) {
    return entry.semanticEdited ? ('diverged' as const) : ('outdated' as const);
  }
  if (entry.semanticEdited) return 'diverged' as const;
  return 'ready' as const;
}
