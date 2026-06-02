import type { LaneConfig } from '../lane-config';

export type EditorNodeText =
  | string
  | {
      value?: string;
      x?: number;
      y?: number;
    };

export type EditorEdgeText =
  | string
  | {
      value?: string;
      x?: number;
      y?: number;
    };

export type EditorNodeData = {
  id: string;
  type: string;
  x: number;
  y: number;
  text?: EditorNodeText;
  properties?: Record<string, unknown>;
};

export type EditorEdgeData = {
  id: string;
  type?: string;
  sourceNodeId: string;
  targetNodeId: string;
  text?: EditorEdgeText;
};

export type EditorGraphData = {
  nodes?: EditorNodeData[];
  edges?: EditorEdgeData[];
};

export type DrawioImportResult = {
  lanes: LaneConfig[];
  laneHeight: number;
  graph: EditorGraphData;
  diagramName: string;
};
