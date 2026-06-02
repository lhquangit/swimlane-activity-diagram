import { useEffect, useRef, useState } from 'react';
import LogicFlow from '@logicflow/core';
import '@logicflow/core/dist/style/index.css';
import { Snapshot, SelectionSelect, NodeResize } from '@logicflow/extension';
import '@logicflow/extension/lib/style/index.css';

import {
  registerNodes,
  DEFAULT_LANES,
  LaneConfig,
  LANE_HEIGHT,
  LANE_TOP,
  getAutoNodeSize,
  withPositions,
} from './nodes';
import {
  buildInitialData,
  buildLaneNodes,
  getLogicFlowOptions,
  snapToLane,
} from './lf-config';
import DndPanel, { DndPaletteItem } from './DndPanel';
import BrdPanel from './brd/BrdPanel';
import {
  BRD_WORKSPACE_CACHE_VERSION,
  clearBrdWorkspaceCache,
  loadBrdWorkspaceCache,
  saveBrdWorkspaceCache,
} from './brd/cache';
import { generateBrd, validateDiagram } from './brd/client';
import { buildGenerateRequest, buildRequestFingerprint, buildSemanticRequest } from './brd/normalize';
import { runLocalPreValidation } from './brd/prevalidate';
import {
  BrdPanelPhase,
  BrdSpec,
  BrdTabId,
  ErrorObject,
  GenerateResult,
  ResponseMetadata,
  WarningItem,
} from './brd/types';
import { exportDrawioXml } from './io/drawio-export';
import { importDrawioXml } from './io/drawio-import';
import type { EditorGraphData } from './io/drawio-types';

LogicFlow.use(Snapshot);
LogicFlow.use(SelectionSelect);
LogicFlow.use(NodeResize);

const PALETTE: DndPaletteItem[] = [
  {
    id: 'start',
    label: 'Start',
    nodeType: 'start',
    swatch: (
      <svg viewBox="0 0 28 22">
        <circle cx="14" cy="11" r="7" fill="#111827" />
      </svg>
    ),
  },
  {
    id: 'activity',
    label: 'Activity',
    nodeType: 'activity',
    properties: { width: 180, height: 44 },
    text: 'Activity',
    swatch: (
      <svg viewBox="0 0 28 22">
        <rect x="2" y="5" width="24" height="12" rx="4" fill="#fff2cc" stroke="#d6b656" />
      </svg>
    ),
  },
  {
    id: 'decision',
    label: 'Decision',
    nodeType: 'decision',
    text: 'Quyết định?',
    swatch: (
      <svg viewBox="0 0 28 22">
        <polygon points="14,3 25,11 14,19 3,11" fill="#ffffff" stroke="#9c2a47" />
      </svg>
    ),
  },
  {
    id: 'sync-bar',
    label: 'Sync Bar (fork/join)',
    nodeType: 'sync-bar',
    properties: { width: 320, height: 8 },
    swatch: (
      <svg viewBox="0 0 28 22">
        <rect x="2" y="9" width="24" height="4" fill="#111827" />
      </svg>
    ),
  },
  {
    id: 'end',
    label: 'End',
    nodeType: 'end',
    swatch: (
      <svg viewBox="0 0 28 22">
        <circle cx="14" cy="11" r="8" fill="#ffffff" stroke="#111827" strokeWidth="1.5" />
        <circle cx="14" cy="11" r="4" fill="#111827" />
      </svg>
    ),
  },
  {
    id: 'note',
    label: 'Sticky Note',
    nodeType: 'note',
    properties: { width: 220, height: 90 },
    text: 'Ghi chú…',
    swatch: (
      <svg viewBox="0 0 28 22">
        <rect x="3" y="3" width="22" height="16" fill="#fff2cc" stroke="#d6b656" />
      </svg>
    ),
  },
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function downloadTextFile(contents: string, filename: string, contentType = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([contents], { type: contentType }), filename);
}

function makeIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `brd-${crypto.randomUUID()}`;
  }
  return `brd-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const INITIAL_LANES = withPositions(DEFAULT_LANES);
const MIN_LANE_HEIGHT = 360;
const MIN_LANE_WIDTH = 220;
const MAX_LANE_WIDTH = 720;
const LANE_BOTTOM_PADDING = 140;
const LANE_CONTENT_HORIZONTAL_PADDING = 24;
const LANE_RESIZE_HANDLE_SIZE = 16;

type LaneDraft = Omit<LaneConfig, 'x'>;

type NodeSizeProperties = {
  width?: number;
  height?: number;
  rx?: number;
  ry?: number;
};

type NodePropertiesLike = Record<string, unknown> & {
  laneId?: string;
  laneOffsetX?: number;
  lanePosition?: number;
  nodeSize?: NodeSizeProperties;
  syncBarFromLaneId?: string;
  syncBarToLaneId?: string;
  syncBarLeftInset?: number;
  syncBarRightInset?: number;
};

type NodeModelLike = {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rx?: number;
  ry?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  points?: number[][];
  text?: { value?: string; x?: number; y?: number };
  properties?: NodePropertiesLike;
  setProperties?: (properties: Record<string, unknown>) => void;
  moveTo?: (x: number, y: number) => void;
  moveText?: (deltaX: number, deltaY: number) => void;
  updateText?: (value: string) => void;
  anchors?: Array<{ id?: string; x: number; y: number }>;
};

type LaneResizeSession = {
  laneId: string;
  startClientX: number;
  startClientY: number;
  startWidth: number;
  startHeight: number;
  contentMinWidth: number;
  contentMinHeight: number;
};

type ShapeResizeSession = {
  nodeId: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
};

type EdgeModelLike = {
  sourceNodeId?: string;
  targetNodeId?: string;
  sourceAnchorId?: string;
  targetAnchorId?: string;
  updateStartPoint?: (anchor: { x: number; y: number }) => void;
  updateEndPoint?: (anchor: { x: number; y: number }) => void;
};

type LaneBinding = {
  lane: LaneConfig;
  relativeX: number;
  clampedX: number;
};

type SyncBarSpan = {
  fromLaneId: string;
  toLaneId: string;
  leftInset: number;
  rightInset: number;
};

function toLaneDrafts(lanes: LaneConfig[]): LaneDraft[] {
  return lanes.map(({ id, title, width }) => ({ id, title, width }));
}

function findLaneById(lanes: LaneConfig[], laneId?: string) {
  if (!laneId) return undefined;
  return lanes.find((lane) => lane.id === laneId);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundCanvasValue(value: number) {
  return Math.round(value * 100) / 100;
}

function isUserResizableNode(nodeType?: string) {
  return (
    nodeType === 'activity' ||
    nodeType === 'decision' ||
    nodeType === 'note' ||
    nodeType === 'sync-bar'
  );
}

function getClosestLane(x: number, lanes: LaneConfig[]) {
  if (lanes.length === 0) return undefined;
  return lanes.reduce((best, lane) =>
    Math.abs(lane.x - x) < Math.abs(best.x - x) ? lane : best,
  );
}

function getClosestLaneByBoundaryX(x: number, lanes: LaneConfig[]) {
  if (lanes.length === 0) return undefined;
  return lanes.reduce((best, lane) => {
    const laneLeft = lane.x - lane.width / 2;
    const laneRight = lane.x + lane.width / 2;
    const bestLeft = best.x - best.width / 2;
    const bestRight = best.x + best.width / 2;
    const laneDistance = x < laneLeft ? laneLeft - x : x > laneRight ? x - laneRight : 0;
    const bestDistance =
      x < bestLeft ? bestLeft - x : x > bestRight ? x - bestRight : 0;
    return laneDistance < bestDistance ? lane : best;
  });
}

function getNodeDimensions(model: NodeModelLike) {
  const width =
    typeof model.width === 'number'
      ? model.width
      : typeof model.rx === 'number'
        ? model.rx * 2
        : 0;
  const height =
    typeof model.height === 'number'
      ? model.height
      : typeof model.ry === 'number'
        ? model.ry * 2
        : 0;
  return { width, height };
}

function getLaneBounds(lane: LaneConfig) {
  return {
    left: lane.x - lane.width / 2,
    right: lane.x + lane.width / 2,
  };
}

function getLanePlacementRange(lane: LaneConfig, model: NodeModelLike) {
  const { width } = getNodeDimensions(model);
  const halfWidth = width > 0 ? width / 2 : 0;
  const { left, right } = getLaneBounds(lane);
  const minX = left + halfWidth;
  const maxX = right - halfWidth;
  if (maxX <= minX) {
    return { minX: lane.x, maxX: lane.x };
  }
  return { minX, maxX };
}

function getLanePlacementFromX(
  lane: LaneConfig,
  model: NodeModelLike,
  desiredX: number,
) {
  const range = getLanePlacementRange(lane, model);
  const clampedX = clamp(desiredX, range.minX, range.maxX);
  const relativeX =
    range.maxX === range.minX
      ? 0.5
      : (clampedX - range.minX) / (range.maxX - range.minX);
  return {
    clampedX: roundCanvasValue(clampedX),
    relativeX: roundCanvasValue(clamp(relativeX, 0, 1)),
  };
}

function getLanePlacementFromRelative(
  lane: LaneConfig,
  model: NodeModelLike,
  relativeX: number,
) {
  const range = getLanePlacementRange(lane, model);
  if (range.maxX === range.minX) {
    return {
      clampedX: roundCanvasValue(lane.x),
      relativeX: 0.5,
    };
  }
  const normalized = clamp(relativeX, 0, 1);
  return {
    clampedX: roundCanvasValue(range.minX + (range.maxX - range.minX) * normalized),
    relativeX: roundCanvasValue(normalized),
  };
}

function getNodeTextValue(model: NodeModelLike, fallback = '') {
  return model.text?.value ?? fallback;
}

function resizeNodeToText(model: NodeModelLike, fallbackText = '') {
  const size = getAutoNodeSize(
    model.type,
    getNodeTextValue(model, fallbackText),
    model.properties,
  );
  if (!size) return false;

  const changed = model.width !== size.width || model.height !== size.height;
  if (!changed) return false;

  if (model.type === 'decision') {
    model.rx = size.width / 2;
    model.ry = size.height / 2;
  } else {
    model.width = size.width;
    model.height = size.height;
  }

  model.setProperties?.({
    ...(model.properties ?? {}),
    width: size.width,
    height: size.height,
    nodeSize:
      model.type === 'decision'
        ? { rx: size.width / 2, ry: size.height / 2 }
        : { width: size.width, height: size.height },
  });
  return true;
}

function getRequiredLaneHeight(lf: LogicFlow, minLaneHeight = LANE_HEIGHT) {
  const graphModel = lf.graphModel as unknown as { nodes?: NodeModelLike[] };
  const maxBottom = (graphModel.nodes ?? [])
    .filter((node) => node.type !== 'lane')
    .reduce((bottom, node) => {
      const halfHeight = typeof node.height === 'number' ? node.height / 2 : 0;
      return Math.max(bottom, node.y + halfHeight);
    }, LANE_TOP + minLaneHeight - LANE_BOTTOM_PADDING);
  return Math.max(minLaneHeight, Math.ceil(maxBottom - LANE_TOP + LANE_BOTTOM_PADDING));
}

function getRequiredLaneWidth(
  lf: LogicFlow,
  laneId: string,
  lanes: LaneConfig[],
  fallbackLanes = lanes,
  minLaneWidth = MIN_LANE_WIDTH,
) {
  const graphModel = lf.graphModel as unknown as { nodes?: NodeModelLike[] };
  const widestNode = (graphModel.nodes ?? [])
    .filter((node) => node.type !== 'lane' && node.type !== 'sync-bar')
    .reduce((width, node) => {
      const binding = getLaneBinding(node, lanes, fallbackLanes);
      if (!binding || binding.lane.id !== laneId) return width;
      return Math.max(width, getNodeDimensions(node).width);
    }, 0);
  return Math.max(
    minLaneWidth,
    Math.ceil(widestNode + (widestNode > 0 ? LANE_CONTENT_HORIZONTAL_PADDING : 0)),
  );
}

function setLaneLayout(lf: LogicFlow, lanes: LaneConfig[], laneHeight: number) {
  const laneY = LANE_TOP + laneHeight / 2;
  lanes.forEach((lane) => {
    const model = lf.graphModel.getNodeModelById(lane.id) as unknown as
      | NodeModelLike
      | undefined;
    if (!model) return;
    model.x = lane.x;
    model.y = laneY;
    model.width = lane.width;
    model.height = laneHeight;
    if (model.text?.value !== lane.title) {
      model.updateText?.(lane.title);
    }
    model.text = { ...(model.text ?? {}), x: lane.x, y: LANE_TOP + 18 };
    model.setProperties?.({
      ...(model.properties ?? {}),
      width: lane.width,
      height: laneHeight,
    });
  });
}

function getLaneBinding(
  model: NodeModelLike,
  lanes: LaneConfig[],
  fallbackLanes = lanes,
): LaneBinding | undefined {
  const storedLane = findLaneById(fallbackLanes, model.properties?.laneId);
  const lane = storedLane ?? getClosestLane(model.x, fallbackLanes) ?? getClosestLane(model.x, lanes);
  if (!lane) return undefined;
  const rawPosition = Number(model.properties?.lanePosition);
  const rawOffset = Number(model.properties?.laneOffsetX);
  if (Number.isFinite(rawPosition)) {
    const placement = getLanePlacementFromRelative(lane, model, rawPosition);
    return { lane, ...placement };
  }
  const desiredX =
    storedLane && storedLane.id === lane.id && Number.isFinite(rawOffset)
      ? lane.x + rawOffset
      : model.x;
  const placement = getLanePlacementFromX(lane, model, desiredX);
  return { lane, ...placement };
}

function setNodeLaneBinding(
  model: NodeModelLike,
  laneId: string,
  laneOffsetX: number,
  lanePosition?: number,
) {
  model.setProperties?.({
    ...(model.properties ?? {}),
    laneId,
    laneOffsetX: roundCanvasValue(laneOffsetX),
    lanePosition: roundCanvasValue(lanePosition ?? 0.5),
  });
}

function bindNodeToLane(
  model: NodeModelLike,
  lane: LaneConfig,
  desiredX = model.x,
) {
  const placement = getLanePlacementFromX(lane, model, desiredX);
  model.moveTo?.(placement.clampedX, model.y);
  setNodeLaneBinding(model, lane.id, placement.clampedX - lane.x, placement.relativeX);
  return placement;
}

function getLaneSliceBetween(
  lanes: LaneConfig[],
  fromLaneId: string,
  toLaneId: string,
) {
  const fromIndex = lanes.findIndex((lane) => lane.id === fromLaneId);
  const toIndex = lanes.findIndex((lane) => lane.id === toLaneId);
  if (fromIndex < 0 || toIndex < 0) return [];
  const startIndex = Math.min(fromIndex, toIndex);
  const endIndex = Math.max(fromIndex, toIndex);
  return lanes.slice(startIndex, endIndex + 1);
}

function getLaneSpanBounds(lanes: LaneConfig[]) {
  return lanes.reduce(
    (bounds, lane) => {
      const laneBounds = getLaneBounds(lane);
      return {
        left: Math.min(bounds.left, laneBounds.left),
        right: Math.max(bounds.right, laneBounds.right),
      };
    },
    { left: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY },
  );
}

function getSyncBarSpan(
  model: NodeModelLike,
  lanes: LaneConfig[],
  fallbackLanes = lanes,
  preferCurrentGeometry = false,
): SyncBarSpan | undefined {
  const { width } = getNodeDimensions(model);
  const leftX = model.x - width / 2;
  const rightX = model.x + width / 2;
  const storedFromLane = findLaneById(fallbackLanes, model.properties?.syncBarFromLaneId);
  const storedToLane = findLaneById(fallbackLanes, model.properties?.syncBarToLaneId);
  const currentFromLane =
    getClosestLaneByBoundaryX(leftX, lanes) ?? getClosestLaneByBoundaryX(leftX, fallbackLanes);
  const currentToLane =
    getClosestLaneByBoundaryX(rightX, lanes) ?? getClosestLaneByBoundaryX(rightX, fallbackLanes);
  const fromLane = preferCurrentGeometry
    ? currentFromLane ?? storedFromLane
    : storedFromLane ?? currentFromLane;
  const toLane = preferCurrentGeometry ? currentToLane ?? storedToLane : storedToLane ?? currentToLane;
  if (!fromLane || !toLane) return undefined;
  const fallbackSpanLanes = getLaneSliceBetween(fallbackLanes, fromLane.id, toLane.id);
  const fallbackSpanBounds =
    fallbackSpanLanes.length > 0
      ? getLaneSpanBounds(fallbackSpanLanes)
      : {
          left: Math.min(getLaneBounds(fromLane).left, getLaneBounds(toLane).left),
          right: Math.max(getLaneBounds(fromLane).right, getLaneBounds(toLane).right),
        };
  const rawLeftInset = Number(model.properties?.syncBarLeftInset);
  const rawRightInset = Number(model.properties?.syncBarRightInset);
  return {
    fromLaneId: fromLane.id,
    toLaneId: toLane.id,
    leftInset: roundCanvasValue(
      Number.isFinite(rawLeftInset) ? rawLeftInset : leftX - fallbackSpanBounds.left,
    ),
    rightInset: roundCanvasValue(
      Number.isFinite(rawRightInset) ? rawRightInset : fallbackSpanBounds.right - rightX,
    ),
  };
}

function persistSyncBarSpan(
  model: NodeModelLike,
  lanes: LaneConfig[],
  fallbackLanes = lanes,
  dimensions = getNodeDimensions(model),
  preferCurrentGeometry = false,
) {
  const span = getSyncBarSpan(model, lanes, fallbackLanes, preferCurrentGeometry);
  if (!span) return undefined;
  const spanLanes = getLaneSliceBetween(lanes, span.fromLaneId, span.toLaneId);
  if (spanLanes.length === 0) return undefined;
  const spanBounds = getLaneSpanBounds(spanLanes);
  const width = roundCanvasValue(dimensions.width);
  const height = roundCanvasValue(dimensions.height);
  model.setProperties?.({
    ...(model.properties ?? {}),
    width,
    height,
    nodeSize: { width, height },
    syncBarFromLaneId: span.fromLaneId,
    syncBarToLaneId: span.toLaneId,
    syncBarLeftInset: roundCanvasValue(model.x - width / 2 - spanBounds.left),
    syncBarRightInset: roundCanvasValue(spanBounds.right - (model.x + width / 2)),
  });
  return span;
}

function normalizeSyncBarSpan(
  lf: LogicFlow,
  model: NodeModelLike,
  span: SyncBarSpan,
  lanes: LaneConfig[],
  fallbackLanes = lanes,
) {
  const laneIds = new Set<string>([span.fromLaneId, span.toLaneId]);
  const edges = lf.getNodeEdges(model.id) as EdgeModelLike[];
  edges.forEach((edge) => {
    const peerNodeId =
      edge.sourceNodeId === model.id
        ? edge.targetNodeId
        : edge.targetNodeId === model.id
          ? edge.sourceNodeId
          : undefined;
    if (!peerNodeId) return;
    const peerModel = lf.graphModel.getNodeModelById(peerNodeId) as unknown as
      | NodeModelLike
      | undefined;
    if (!peerModel || peerModel.type === 'lane' || peerModel.type === 'sync-bar') return;
    const binding = getLaneBinding(peerModel, lanes, fallbackLanes);
    if (binding) {
      laneIds.add(binding.lane.id);
    }
  });
  const orderedLaneIds = lanes.map((lane) => lane.id).filter((laneId) => laneIds.has(laneId));
  if (orderedLaneIds.length === 0) return span;
  return {
    ...span,
    fromLaneId: orderedLaneIds[0],
    toLaneId: orderedLaneIds[orderedLaneIds.length - 1],
  };
}

function applySyncBarSpan(
  lf: LogicFlow,
  model: NodeModelLike,
  lanes: LaneConfig[],
  fallbackLanes = lanes,
) {
  const rawSpan = getSyncBarSpan(model, lanes, fallbackLanes);
  if (!rawSpan) return;
  const span = normalizeSyncBarSpan(lf, model, rawSpan, lanes, fallbackLanes);
  const spanLanes = getLaneSliceBetween(lanes, span.fromLaneId, span.toLaneId);
  if (spanLanes.length === 0) return;
  const spanBounds = getLaneSpanBounds(spanLanes);
  const minWidth = model.minWidth ?? 30;
  let nextLeft = spanBounds.left + span.leftInset;
  let nextRight = spanBounds.right - span.rightInset;
  nextLeft = clamp(nextLeft, spanBounds.left, spanBounds.right - minWidth);
  nextRight = clamp(nextRight, nextLeft + minWidth, spanBounds.right);
  const nextWidth = roundCanvasValue(Math.max(minWidth, nextRight - nextLeft));
  const nextX = roundCanvasValue(nextLeft + nextWidth / 2);
  model.width = nextWidth;
  model.height = getNodeDimensions(model).height;
  model.moveTo?.(nextX, model.y);
  model.setProperties?.({
    ...(model.properties ?? {}),
    syncBarFromLaneId: span.fromLaneId,
    syncBarToLaneId: span.toLaneId,
  });
  persistSyncBarSpan(model, lanes, fallbackLanes, {
    width: nextWidth,
    height: getNodeDimensions(model).height,
  });
  syncConnectedEdges(lf, model);
}

function syncConnectedEdges(lf: LogicFlow, model: NodeModelLike) {
  const anchors = model.anchors ?? [];
  if (anchors.length === 0) return;
  const edges = lf.getNodeEdges(model.id) as EdgeModelLike[];
  edges.forEach((edge) => {
    if (edge.sourceNodeId === model.id) {
      const sourceAnchor = anchors.find((anchor) => anchor.id === edge.sourceAnchorId) ?? anchors[0];
      sourceAnchor && edge.updateStartPoint?.({ x: sourceAnchor.x, y: sourceAnchor.y });
    }
    if (edge.targetNodeId === model.id) {
      const targetAnchor = anchors.find((anchor) => anchor.id === edge.targetAnchorId) ?? anchors[0];
      targetAnchor && edge.updateEndPoint?.({ x: targetAnchor.x, y: targetAnchor.y });
    }
  });
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const lfRef = useRef<LogicFlow | null>(null);
  const [lanes, setLanes] = useState<LaneConfig[]>(INITIAL_LANES);
  const lanesRef = useRef<LaneConfig[]>(INITIAL_LANES);
  const laneHeightRef = useRef(LANE_HEIGHT);
  const isSyncingLanesRef = useRef(false);
  const laneResizeSessionRef = useRef<LaneResizeSession | null>(null);
  const shapeResizeSessionRef = useRef<ShapeResizeSession | null>(null);
  const [activeLaneId, setActiveLaneId] = useState<string | null>(INITIAL_LANES[0]?.id ?? null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [viewportTick, setViewportTick] = useState(0);
  const [status, setStatus] = useState('Đang khởi tạo…');
  const [diagramRevision, setDiagramRevision] = useState(0);
  const [lastGeneratedRevision, setLastGeneratedRevision] = useState<number | null>(null);
  const [brdPanelOpen, setBrdPanelOpen] = useState(false);
  const [brdPhase, setBrdPhase] = useState<BrdPanelPhase>('idle');
  const [brdTab, setBrdTab] = useState<BrdTabId>('warnings');
  const [brdWarnings, setBrdWarnings] = useState<WarningItem[]>([]);
  const [brdBlockingIssues, setBrdBlockingIssues] = useState<WarningItem[]>([]);
  const [brdSpec, setBrdSpec] = useState<BrdSpec | null>(null);
  const [brdDraft, setBrdDraft] = useState('');
  const [brdError, setBrdError] = useState<ErrorObject | null>(null);
  const [brdMetadata, setBrdMetadata] = useState<ResponseMetadata | null>(null);
  const [brdRequestId, setBrdRequestId] = useState<string | null>(null);
  const [brdRuntimeStatus, setBrdRuntimeStatus] = useState<string | null>(null);
  const [lastGenerateFingerprint, setLastGenerateFingerprint] = useState<string | null>(null);
  const [lastIdempotencyKey, setLastIdempotencyKey] = useState<string | null>(null);

  const markDiagramChanged = () => {
    setDiagramRevision((revision) => revision + 1);
  };

  const hasCachedBrdSnapshot = Boolean(brdDraft || brdSpec);
  const currentBrdFingerprint = (() => {
    void diagramRevision;
    const lf = lfRef.current;
    if (!lf) return null;
    try {
      const graphData = lf.getGraphData() as Parameters<typeof buildGenerateRequest>[0];
      return buildRequestFingerprint(buildGenerateRequest(graphData, lanesRef.current));
    } catch {
      return null;
    }
  })();

  const isBrdOutdated =
    hasCachedBrdSnapshot &&
    ((lastGeneratedRevision !== null && diagramRevision !== lastGeneratedRevision) ||
      (lastGenerateFingerprint !== null &&
        currentBrdFingerprint !== null &&
        lastGenerateFingerprint !== currentBrdFingerprint));

  const resetBrdState = () => {
    setBrdPanelOpen(false);
    setBrdPhase('idle');
    setBrdTab('warnings');
    setBrdWarnings([]);
    setBrdBlockingIssues([]);
    setBrdSpec(null);
    setBrdDraft('');
    setBrdError(null);
    setBrdMetadata(null);
    setBrdRequestId(null);
    setBrdRuntimeStatus(null);
    setLastGenerateFingerprint(null);
    setLastGeneratedRevision(null);
    setLastIdempotencyKey(null);
  };

  const formatContextSwitchStatus = (base: string) =>
    hasCachedBrdSnapshot ? `${base} — BRD draft đã cache được giữ và sẽ hiển thị là outdated.` : base;

  // Keep ref in sync so event handlers (registered once) always see current value
  useEffect(() => {
    lanesRef.current = lanes;
  }, [lanes]);

  useEffect(() => {
    const cached = loadBrdWorkspaceCache();
    if (!cached) return;
    setBrdPhase(cached.phase);
    setBrdTab(cached.activeTab);
    setBrdWarnings(cached.warnings);
    setBrdBlockingIssues(cached.blockingIssues);
    setBrdSpec(cached.spec);
    setBrdDraft(cached.draft);
    setBrdError(cached.error);
    setBrdMetadata(cached.metadata);
    setBrdRequestId(cached.requestId);
    setBrdRuntimeStatus(cached.runtimeStatus);
    setLastGenerateFingerprint(cached.lastGenerateFingerprint);
    setLastGeneratedRevision(cached.lastGeneratedRevision);
    setLastIdempotencyKey(cached.idempotencyKey);
    setBrdPanelOpen(false);
  }, []);

  useEffect(() => {
    if (!hasCachedBrdSnapshot) return;
    saveBrdWorkspaceCache({
      version: BRD_WORKSPACE_CACHE_VERSION,
      draft: brdDraft,
      spec: brdSpec,
      warnings: brdWarnings,
      blockingIssues: brdBlockingIssues,
      metadata: brdMetadata,
      requestId: brdRequestId,
      runtimeStatus: brdRuntimeStatus,
      phase: brdPhase,
      activeTab: brdTab,
      error: brdError,
      lastGenerateFingerprint,
      lastGeneratedRevision,
      idempotencyKey: lastIdempotencyKey,
      updatedAt: new Date().toISOString(),
    });
  }, [
    brdBlockingIssues,
    brdDraft,
    brdError,
    brdMetadata,
    brdPhase,
    brdRequestId,
    brdRuntimeStatus,
    brdSpec,
    brdTab,
    brdWarnings,
    hasCachedBrdSnapshot,
    lastGenerateFingerprint,
    lastGeneratedRevision,
    lastIdempotencyKey,
  ]);

  const bumpViewportTick = () => setViewportTick((tick) => tick + 1);

  const updateLaneState = (nextLanes: LaneConfig[]) => {
    setLanes(nextLanes);
    lanesRef.current = nextLanes;
  };

  const applyLaneModels = (nextLanes: LaneConfig[], nextLaneHeight = laneHeightRef.current) => {
    const lf = lfRef.current;
    if (!lf) return;
    const data = lf.getGraphData() as { nodes?: Array<{ id: string; type: string }> };
    const nextLaneIds = new Set(nextLanes.map((lane) => lane.id));
    isSyncingLanesRef.current = true;
    try {
      (data.nodes ?? [])
        .filter((n) => n.type === 'lane' && !nextLaneIds.has(n.id))
        .forEach((n) => lf.deleteNode(n.id));
      buildLaneNodes(nextLanes, nextLaneHeight).forEach((node) => {
        const existing = lf.graphModel.getNodeModelById(node.id);
        if (!existing) {
          lf.addNode(node);
        }
      });
      setLaneLayout(lf, nextLanes, nextLaneHeight);
    } finally {
      isSyncingLanesRef.current = false;
    }
    bumpViewportTick();
  };

  const hydrateNodeLaneBindings = (laneList = lanesRef.current, fallbackLanes = laneList) => {
    const lf = lfRef.current;
    if (!lf) return;
    const graphModel = lf.graphModel as unknown as { nodes?: NodeModelLike[] };
    (graphModel.nodes ?? []).forEach((node) => {
      if (node.type === 'lane' || node.type === 'sync-bar') return;
      const binding = getLaneBinding(node, laneList, fallbackLanes);
      if (!binding) return;
      setNodeLaneBinding(
        node,
        binding.lane.id,
        binding.clampedX - binding.lane.x,
        binding.relativeX,
      );
    });
  };

  const hydrateSyncBarBindings = (laneList = lanesRef.current, fallbackLanes = laneList) => {
    const lf = lfRef.current;
    if (!lf) return;
    const graphModel = lf.graphModel as unknown as { nodes?: NodeModelLike[] };
    (graphModel.nodes ?? []).forEach((node) => {
      if (node.type !== 'sync-bar') return;
      persistSyncBarSpan(node, laneList, fallbackLanes);
    });
  };

  const realignNodesToLaneLayout = (prevLanes: LaneConfig[], nextLanes: LaneConfig[]) => {
    const lf = lfRef.current;
    if (!lf) return;
    const graphModel = lf.graphModel as unknown as { nodes?: NodeModelLike[] };
    (graphModel.nodes ?? []).forEach((node) => {
      if (node.type === 'lane' || node.type === 'sync-bar') return;
      const binding = getLaneBinding(node, nextLanes, prevLanes);
      if (!binding) return;
      const nextLane =
        findLaneById(nextLanes, binding.lane.id) ??
        getClosestLane(binding.clampedX, nextLanes) ??
        getClosestLane(node.x, nextLanes);
      if (!nextLane) return;
      const placement = getLanePlacementFromRelative(nextLane, node, binding.relativeX);
      node.moveTo?.(placement.clampedX, node.y);
      setNodeLaneBinding(
        node,
        nextLane.id,
        placement.clampedX - nextLane.x,
        placement.relativeX,
      );
      syncConnectedEdges(lf, node);
    });
  };

  const realignSyncBarsToLaneLayout = (prevLanes: LaneConfig[], nextLanes: LaneConfig[]) => {
    const lf = lfRef.current;
    if (!lf) return;
    const graphModel = lf.graphModel as unknown as { nodes?: NodeModelLike[] };
    (graphModel.nodes ?? []).forEach((node) => {
      if (node.type !== 'sync-bar') return;
      applySyncBarSpan(lf, node, nextLanes, prevLanes);
    });
  };

  const refreshLaneHeight = () => {
    const lf = lfRef.current;
    if (!lf) return;
    const contentHeight = getRequiredLaneHeight(lf, MIN_LANE_HEIGHT);
    const nextHeight = Math.max(laneHeightRef.current, contentHeight);
    if (nextHeight === laneHeightRef.current) return;
    laneHeightRef.current = nextHeight;
    applyLaneModels(lanesRef.current, nextHeight);
  };

  const commitLaneLayout = (
    nextLanes: LaneConfig[],
    options?: { laneHeight?: number; preserveDeletedLaneNodes?: boolean; status?: string },
  ) => {
    const lf = lfRef.current;
    if (!lf) return;
    const prevLanes = lanesRef.current;
    const nextHeight = Math.max(
      options?.laneHeight ?? laneHeightRef.current,
      getRequiredLaneHeight(lf, MIN_LANE_HEIGHT),
    );
    laneHeightRef.current = nextHeight;
    updateLaneState(nextLanes);
    applyLaneModels(nextLanes, nextHeight);
    realignNodesToLaneLayout(prevLanes, nextLanes);
    realignSyncBarsToLaneLayout(prevLanes, nextLanes);
    if (options?.status) {
      setStatus(options.status);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const lf = new LogicFlow(getLogicFlowOptions(containerRef.current));
    registerNodes(lf);

    lf.render(buildInitialData());
    hydrateNodeLaneBindings(lanesRef.current);
    hydrateSyncBarBindings(lanesRef.current);
    laneHeightRef.current = getRequiredLaneHeight(lf, LANE_HEIGHT);
    applyLaneModels(lanesRef.current, laneHeightRef.current);
    lf.fitView(20, 20);

    // Snap newly-dropped (via dnd) nodes to nearest lane center.
    // We also force the new node to the top of the stack so its DOM element
    // is appended AFTER the lane elements in the SVG canvas. Lanes render a
    // full-size white-fill rect, so any node that ends up below them in the
    // DOM tree gets covered and looks invisible until the next render pass.
    lf.on('node:dnd-add', ({ data }) => {
      if (!data || !data.type) return;
      if (data.type === 'lane') return;
      const model = lf.graphModel.getNodeModelById(data.id);
      if (!model) return;
      if (data.type !== 'sync-bar') {
        const lane = getClosestLane(data.x, lanesRef.current);
        const snappedX = lane?.x ?? snapToLane(data.x, lanesRef.current);
        model.moveTo(snappedX, data.y);
        if (lane) {
          bindNodeToLane(model as unknown as NodeModelLike, lane, snappedX);
        }
      } else {
        persistSyncBarSpan(model as unknown as NodeModelLike, lanesRef.current, lanesRef.current, undefined, true);
      }
      resizeNodeToText(model as unknown as NodeModelLike);
      // Bring new node above any lane in the stacking order.
      lf.graphModel.setElementZIndex(data.id, 'top');
      refreshLaneHeight();
      setActiveLaneId(null);
      setActiveNodeId(isUserResizableNode(data.type) ? data.id : null);
      markDiagramChanged();
      bumpViewportTick();
    });

    // Snap when moving an existing node (drag-end)
    lf.on('node:drop', ({ data }) => {
      if (!data || !data.type) return;
      const model = lf.graphModel.getNodeModelById(data.id) as unknown as NodeModelLike | undefined;
      if (!model || data.type === 'lane') return;
      if (data.type === 'sync-bar') {
        persistSyncBarSpan(model, lanesRef.current, lanesRef.current, undefined, true);
        syncConnectedEdges(lf, model);
        setActiveLaneId(null);
        setActiveNodeId(data.id);
        bumpViewportTick();
        return;
      }
      const lane = getClosestLane(data.x, lanesRef.current);
      const snappedX = lane?.x ?? snapToLane(data.x, lanesRef.current);
      model.moveTo?.(snappedX, data.y);
      if (lane) {
        bindNodeToLane(model, lane, snappedX);
      }
      syncConnectedEdges(lf, model);
      refreshLaneHeight();
      setActiveLaneId(null);
      setActiveNodeId(isUserResizableNode(data.type) ? data.id : null);
      markDiagramChanged();
      bumpViewportTick();
    });

    lf.on('text:update', ({ id, text }) => {
      const model = lf.graphModel.getNodeModelById(id) as unknown as
        | NodeModelLike
        | undefined;
      if (!model || model.type === 'lane') return;
      resizeNodeToText(model, text);
      refreshLaneHeight();
      markDiagramChanged();
      bumpViewportTick();
    });

    lf.on('node:resize', ({ newNodeSize }) => {
      const model = lf.graphModel.getNodeModelById(newNodeSize.id) as unknown as
        | NodeModelLike
        | undefined;
      if (!model || model.type === 'lane') return;
      const width =
        typeof newNodeSize.width === 'number'
          ? newNodeSize.width
          : typeof newNodeSize.rx === 'number'
            ? newNodeSize.rx * 2
            : model.width;
      const height =
        typeof newNodeSize.height === 'number'
          ? newNodeSize.height
          : typeof newNodeSize.ry === 'number'
            ? newNodeSize.ry * 2
            : model.height;
      model.setProperties?.({
        ...(model.properties ?? {}),
        width,
        height,
        nodeSize:
          model.type === 'decision'
            ? { rx: width / 2, ry: height / 2 }
            : { width, height },
      });
      if (model.type === 'sync-bar') {
        persistSyncBarSpan(
          model,
          lanesRef.current,
          lanesRef.current,
          { width, height },
          true,
        );
      } else {
        const binding = getLaneBinding(model, lanesRef.current);
        if (binding) {
          setNodeLaneBinding(
            model,
            binding.lane.id,
            binding.clampedX - binding.lane.x,
            binding.relativeX,
          );
        }
      }
      syncConnectedEdges(lf, model);
      refreshLaneHeight();
      markDiagramChanged();
      bumpViewportTick();
    });

    // Prevent lane deletion via DELETE key — re-add immediately
    lf.on('node:delete', ({ data }) => {
      if (isSyncingLanesRef.current) return;
      if (data?.type === 'lane') {
        applyLaneModels(lanesRef.current, laneHeightRef.current);
        setActiveLaneId((current) => (current === data.id ? lanesRef.current[0]?.id ?? null : current));
      } else if (data?.id) {
        setActiveNodeId((current) => (current === data.id ? null : current));
      }
    });

    const syncActiveTarget = (data?: { id?: string; type?: string }) => {
      if (data?.type === 'lane') {
        setActiveLaneId(data.id ?? null);
        setActiveNodeId(null);
      } else {
        setActiveLaneId(null);
        setActiveNodeId(isUserResizableNode(data?.type) ? data.id ?? null : null);
      }
    };

    lf.on('node:click', ({ data }) => {
      syncActiveTarget(data);
    });

    lf.on('node:mouseup', ({ data }) => {
      syncActiveTarget(data);
    });

    lf.on('blank:click', () => {
      setActiveLaneId(null);
      setActiveNodeId(null);
    });

    lf.on('graph:transform', () => {
      bumpViewportTick();
    });

    // Double-click on lane → rename
    lf.on('node:dbclick', ({ data }) => {
      if (data?.type !== 'lane') return;
      const current = lanesRef.current.find((l) => l.id === data.id);
      if (!current) return;
      const next = window.prompt('Đổi tên lane:', current.title);
      if (next === null) return;
      const trimmed = next.trim();
      if (!trimmed || trimmed === current.title) return;
      const updated = withPositions(
        toLaneDrafts(
          lanesRef.current.map((l) => (l.id === data.id ? { ...l, title: trimmed } : l)),
        ),
      );
      commitLaneLayout(updated, { status: `Đã đổi tên lane → "${trimmed}"` });
      setActiveLaneId(data.id);
      markDiagramChanged();
    });

    // Right-click on lane → confirm delete
    lf.on('node:contextmenu', ({ data, e }) => {
      if (data?.type !== 'lane') return;
      e?.preventDefault?.();
      const current = lanesRef.current.find((l) => l.id === data.id);
      if (!current) return;
      if (lanesRef.current.length <= 1) {
        setStatus('Không thể xoá: cần ít nhất 1 lane');
        return;
      }
      const ok = window.confirm(
        `Xoá lane "${current.title}"?\n\nNode bên trong sẽ không bị xoá; bạn có thể kéo chúng sang lane khác sau.`,
      );
      if (!ok) return;
      const updated = withPositions(
        toLaneDrafts(lanesRef.current.filter((l) => l.id !== data.id)),
      );
      commitLaneLayout(updated, { status: `Đã xoá lane "${current.title}"` });
      setActiveLaneId(updated[0]?.id ?? null);
      markDiagramChanged();
    });

    lfRef.current = lf;
    setStatus(`Sẵn sàng — ${INITIAL_LANES.length} lane đã được tạo`);

    return () => {
      lfRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartDrag = (item: DndPaletteItem) => {
    const lf = lfRef.current;
    if (!lf) return;
    lf.dnd.startDrag({
      type: item.nodeType,
      properties: item.properties ?? {},
      text: item.text ?? '',
    });
  };

  const handleAddLane = () => {
    if (!lfRef.current) return;
    const name = window.prompt('Tên lane mới (actor):', 'Actor mới');
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const newLane: LaneDraft = {
      id: `lane-${Date.now()}`,
      title: trimmed,
      width: 320,
    };
    const updated = withPositions([...toLaneDrafts(lanesRef.current), newLane]);
    commitLaneLayout(updated, { status: `Đã thêm lane "${trimmed}"` });
    setActiveLaneId(newLane.id);
    setActiveNodeId(null);
    markDiagramChanged();
  };

  const handleRenameLane = (laneId: string) => {
    const current = lanesRef.current.find((lane) => lane.id === laneId);
    if (!current) return;
    const next = window.prompt('Đổi tên lane:', current.title);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === current.title) return;
    const updated = withPositions(
      toLaneDrafts(lanesRef.current.map((lane) => (lane.id === laneId ? { ...lane, title: trimmed } : lane))),
    );
    commitLaneLayout(updated, { status: `Đã đổi tên lane → "${trimmed}"` });
    setActiveLaneId(laneId);
    markDiagramChanged();
  };

  const handleDeleteLane = (laneId: string) => {
    const current = lanesRef.current.find((lane) => lane.id === laneId);
    if (!current) return;
    if (lanesRef.current.length <= 1) {
      setStatus('Không thể xoá: cần ít nhất 1 lane');
      return;
    }
    const ok = window.confirm(
      `Xoá lane "${current.title}"?\n\nNode bên trong sẽ không bị xoá; bạn có thể kéo chúng sang lane khác sau.`,
    );
    if (!ok) return;
    const updated = withPositions(toLaneDrafts(lanesRef.current.filter((lane) => lane.id !== laneId)));
    commitLaneLayout(updated, { status: `Đã xoá lane "${current.title}"` });
    setActiveLaneId(updated[0]?.id ?? null);
    markDiagramChanged();
  };

  const handleMoveLane = (laneId: string, direction: -1 | 1) => {
    const currentIndex = lanesRef.current.findIndex((lane) => lane.id === laneId);
    if (currentIndex < 0) return;
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= lanesRef.current.length) return;
    const drafts = [...toLaneDrafts(lanesRef.current)];
    const [lane] = drafts.splice(currentIndex, 1);
    drafts.splice(targetIndex, 0, lane);
    const updated = withPositions(drafts);
    commitLaneLayout(updated, { status: `Đã đổi vị trí lane "${lane.title}"` });
    setActiveLaneId(laneId);
    markDiagramChanged();
  };

  const handleExportPNG = async () => {
    const lf = lfRef.current;
    if (!lf) return;
    setStatus('Đang export PNG…');
    await (lf as unknown as {
      getSnapshot: (filename: string, options?: Record<string, unknown>) => Promise<unknown>;
    }).getSnapshot('swimlane.png', { fileType: 'png', backgroundColor: '#ffffff' });
    setStatus('Đã tải swimlane.png');
  };

  const handleExportSVG = () => {
    const lf = lfRef.current;
    if (!lf) return;
    setStatus('Đang export SVG…');
    const svgEl = (containerRef.current?.querySelector('svg.lf-canvas-overlay') ||
      containerRef.current?.querySelector('svg')) as SVGSVGElement | null;
    if (!svgEl) {
      setStatus('Không tìm thấy SVG canvas.');
      return;
    }
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const serializer = new XMLSerializer();
    const xml = serializer.serializeToString(clone);
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], {
      type: 'image/svg+xml',
    });
    downloadBlob(blob, 'swimlane.svg');
    setStatus('Đã tải swimlane.svg');
  };

  const handleExportJSON = () => {
    const lf = lfRef.current;
    if (!lf) return;
    const data = lf.getGraphData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'swimlane.json');
    setStatus('Đã tải swimlane.json');
  };

  const applyImportedGraph = ({
    graph,
    importedLanes,
    importedLaneHeight,
    statusMessage,
  }: {
    graph: EditorGraphData;
    importedLanes: LaneConfig[];
    importedLaneHeight?: number;
    statusMessage: string;
  }) => {
    const lf = lfRef.current;
    if (!lf) return;
    lf.render(graph as Parameters<typeof lf.render>[0]);
    if (importedLanes.length > 0) {
      updateLaneState(importedLanes);
      hydrateNodeLaneBindings(importedLanes, importedLanes);
      hydrateSyncBarBindings(importedLanes, importedLanes);
      const nextLaneHeight = Math.max(
        importedLaneHeight ?? MIN_LANE_HEIGHT,
        getRequiredLaneHeight(lf, MIN_LANE_HEIGHT),
      );
      laneHeightRef.current = nextLaneHeight;
      applyLaneModels(importedLanes, laneHeightRef.current);
      setActiveLaneId(importedLanes[0]?.id ?? null);
    }
    setActiveNodeId(null);
    lf.fitView(20, 20);
    markDiagramChanged();
    setStatus(formatContextSwitchStatus(statusMessage));
  };

  const handleCopyBrdDraft = async () => {
    if (!brdDraft) return;
    await navigator.clipboard.writeText(brdDraft);
    setStatus('Đã copy BRD draft vào clipboard');
  };

  const handleExportBrdDraft = () => {
    if (!brdDraft) return;
    downloadTextFile(brdDraft, 'diagram-brd-draft.md', 'text/markdown;charset=utf-8');
    setStatus('Đã tải diagram-brd-draft.md');
  };

  const handleAcknowledgeOutdatedDraft = () => {
    setLastGeneratedRevision(diagramRevision);
    setStatus('Đã giữ BRD draft hiện tại dù diagram đã thay đổi');
  };

  const handleOpenCachedBrd = () => {
    if (!hasCachedBrdSnapshot) return;
    setBrdPanelOpen(true);
    setStatus(
      isBrdOutdated ? 'Đã mở lại BRD draft đã cache (outdated).' : 'Đã mở lại BRD draft đã cache.',
    );
  };

  const handleDiscardCachedBrd = () => {
    if (!hasCachedBrdSnapshot) return;
    const confirmed = window.confirm('Xoá BRD draft đã cache khỏi trình duyệt này?');
    if (!confirmed) return;
    clearBrdWorkspaceCache();
    resetBrdState();
    setStatus('Đã xoá BRD draft đã cache');
  };

  const executeGenerateBrd = async (options?: { reuseIdempotencyKey?: boolean }) => {
    const lf = lfRef.current;
    if (!lf) return;
    const graphData = lf.getGraphData() as Parameters<typeof buildGenerateRequest>[0];
    const validationRequest = buildSemanticRequest(graphData, lanesRef.current);
    const generateRequest = buildGenerateRequest(graphData, lanesRef.current);
    const requestFingerprint = buildRequestFingerprint(generateRequest);
    const shouldReuseIdempotencyKey =
      options?.reuseIdempotencyKey &&
      lastGenerateFingerprint === requestFingerprint &&
      lastIdempotencyKey;
    const idempotencyKey = shouldReuseIdempotencyKey ? lastIdempotencyKey! : makeIdempotencyKey();

    setBrdPanelOpen(true);
    setBrdPhase('validating');
    setBrdTab('warnings');
    setBrdError(null);
    setBrdWarnings([]);
    setBrdBlockingIssues([]);
    setBrdRuntimeStatus('validating');
    setStatus('Đang validate diagram cho AI BRD…');

    try {
      const localBlockingIssues = runLocalPreValidation(validationRequest);
      if (localBlockingIssues.length > 0) {
        setBrdPhase('blocking');
        setBrdRuntimeStatus('blocking');
        setBrdWarnings([]);
        setBrdBlockingIssues(localBlockingIssues);
        setBrdError({
          code: 'VALIDATION_BLOCKING',
          message: 'Diagram còn blocking issue cơ bản; hãy sửa trước khi generate.',
          retryable: false,
          related_node_ids: localBlockingIssues.flatMap((item) => item.related_node_ids),
        });
        setStatus('Không thể generate BRD: diagram còn blocking issue cơ bản');
        return;
      }

      const validationEnvelope = await validateDiagram(validationRequest);
      setBrdRequestId(validationEnvelope.request_id);
      setBrdMetadata(validationEnvelope.metadata);
      setBrdWarnings(validationEnvelope.warnings);
      setBrdBlockingIssues(validationEnvelope.blocking_issues);
      if (
        validationEnvelope.status === 'blocking' ||
        validationEnvelope.blocking_issues.length > 0
      ) {
        setBrdPhase('blocking');
        setBrdRuntimeStatus(validationEnvelope.status);
        setBrdError({
          code: 'VALIDATION_BLOCKING',
          message: 'Diagram còn blocking issue; hãy sửa trước khi generate.',
          retryable: false,
          related_node_ids: validationEnvelope.blocking_issues.flatMap((item) => item.related_node_ids),
        });
        setStatus('Không thể generate BRD: diagram còn blocking issue');
        return;
      }

      setBrdPhase('generating');
      setBrdRuntimeStatus('generating');
      setStatus('Đang sinh BRD draft…');
      const { statusCode, payload } = await generateBrd(generateRequest, idempotencyKey);
      setBrdRequestId(payload.request_id);
      setBrdMetadata(payload.metadata);
      setBrdWarnings(payload.warnings);
      setBrdBlockingIssues(payload.blocking_issues);
      setBrdRuntimeStatus(payload.status);
      setLastIdempotencyKey(idempotencyKey);
      setLastGenerateFingerprint(requestFingerprint);

      if (statusCode === 202 || payload.status === 'in_progress') {
        setBrdPhase('in-progress');
        setBrdError(null);
        setStatus('Generate đang được xử lý…');
        return;
      }

      if (statusCode >= 400 || payload.error) {
        setBrdPhase(payload.status === 'blocking' ? 'blocking' : 'failed');
        setBrdError(payload.error);
        setStatus(payload.error?.message ?? 'Sinh BRD thất bại');
        return;
      }

      const result = payload.result as GenerateResult;
      setBrdSpec(result.spec);
      setBrdDraft(result.brd_markdown);
      setBrdPhase('ready');
      setBrdTab('draft');
      setBrdError(null);
      setLastGeneratedRevision(diagramRevision);
      setStatus(
        payload.status === 'replayed'
          ? 'Đã dùng lại kết quả generate trước đó'
          : 'Đã sinh BRD draft thành công',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể gọi backend AI BRD';
      setBrdPhase('failed');
      setBrdError({
        code: 'BACKEND_REQUEST_FAILED',
        message,
        retryable: true,
        related_node_ids: [],
      });
      setBrdRuntimeStatus('failed');
      setStatus(message);
    }
  };

  const handleImportJSON = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as {
          nodes?: Array<{
            id: string;
            type: string;
            x: number;
            y: number;
            properties?: { width?: number; height?: number };
            text?: { value: string };
          }>;
        };
        const importedLanes: LaneConfig[] = (data.nodes ?? [])
          .filter((n) => n.type === 'lane')
          .map((n) => ({
            id: n.id,
            title: n.text?.value ?? n.id,
            x: n.x,
            width: n.properties?.width ?? 320,
          }))
          .sort((a, b) => a.x - b.x);
        const importedLaneHeight = Math.max(
          ...((data.nodes ?? [])
            .filter((node) => node.type === 'lane')
            .map((node) => node.properties?.height ?? MIN_LANE_HEIGHT)),
          MIN_LANE_HEIGHT,
        );
        applyImportedGraph({
          graph: data,
          importedLanes,
          importedLaneHeight,
          statusMessage: `Đã load: ${file.name}`,
        });
      } catch (e) {
        setStatus(`Lỗi parse JSON: ${(e as Error).message}`);
      }
    };
    reader.readAsText(file);
    ev.target.value = '';
  };

  const handleImportXML = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = importDrawioXml(String(reader.result));
        applyImportedGraph({
          graph: result.graph,
          importedLanes: result.lanes,
          importedLaneHeight: result.laneHeight,
          statusMessage: `Đã import XML: ${file.name}`,
        });
      } catch (e) {
        setStatus(`Lỗi import XML: ${(e as Error).message}`);
      }
    };
    reader.readAsText(file);
    ev.target.value = '';
  };

  const handleExportXML = () => {
    const lf = lfRef.current;
    if (!lf) return;
    const graphData = lf.getGraphData() as Parameters<typeof exportDrawioXml>[0];
    const xml = exportDrawioXml(graphData, lanesRef.current, laneHeightRef.current);
    downloadTextFile(xml, 'diagram.drawio.xml', 'application/xml;charset=utf-8');
    setStatus('Đã tải diagram.drawio.xml');
  };

  const handleResetSample = () => {
    const seeded = withPositions(DEFAULT_LANES);
    updateLaneState(seeded);
    lfRef.current?.render(buildInitialData());
    if (lfRef.current) {
      hydrateNodeLaneBindings(seeded, seeded);
      hydrateSyncBarBindings(seeded, seeded);
      laneHeightRef.current = getRequiredLaneHeight(lfRef.current, LANE_HEIGHT);
      applyLaneModels(seeded, laneHeightRef.current);
    }
    setActiveLaneId(seeded[0]?.id ?? null);
    setActiveNodeId(null);
    lfRef.current?.fitView(20, 20);
    markDiagramChanged();
    setStatus(formatContextSwitchStatus('Đã reset về diagram mẫu'));
  };

  const handleClear = () => {
    if (!lfRef.current) return;
    lfRef.current.clearData();
    lfRef.current.render({
      nodes: buildLaneNodes(lanesRef.current, MIN_LANE_HEIGHT),
      edges: [],
    });
    hydrateSyncBarBindings(lanesRef.current, lanesRef.current);
    laneHeightRef.current = MIN_LANE_HEIGHT;
    applyLaneModels(lanesRef.current, laneHeightRef.current);
    setActiveLaneId(lanesRef.current[0]?.id ?? null);
    setActiveNodeId(null);
    markDiagramChanged();
    setStatus(formatContextSwitchStatus('Đã xoá nội dung (giữ lại lane)'));
  };

  const handleUndo = () => lfRef.current?.undo();
  const handleRedo = () => lfRef.current?.redo();
  const handleZoomIn = () => lfRef.current?.zoom(true);
  const handleZoomOut = () => lfRef.current?.zoom(false);
  const handleFit = () => lfRef.current?.fitView(20, 20);

  const handleCanvasMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.lane-toolbar, .lane-resize-handle, .shape-resize-handle')) return;
    const lf = lfRef.current;
    if (!lf) return;
    const { canvasOverlayPosition } = lf.getPointByClient(event.clientX, event.clientY);
    const graphModel = lf.graphModel as unknown as { nodes?: NodeModelLike[] };
    const candidates = [...(graphModel.nodes ?? [])].reverse();
    const hitTest = (node: NodeModelLike) => {
      const { width, height } = getNodeDimensions(node);
      return (
        canvasOverlayPosition.x >= node.x - width / 2 &&
        canvasOverlayPosition.x <= node.x + width / 2 &&
        canvasOverlayPosition.y >= node.y - height / 2 &&
        canvasOverlayPosition.y <= node.y + height / 2
      );
    };
    const node =
      candidates.find((candidate) => candidate.type !== 'lane' && hitTest(candidate)) ??
      candidates.find((candidate) => candidate.type === 'lane' && hitTest(candidate)) ??
      null;
    if (!node) {
      setActiveLaneId(null);
      setActiveNodeId(null);
      return;
    }
    if (node.type === 'lane') {
      setActiveLaneId(node.id);
      setActiveNodeId(null);
      return;
    }
    setActiveLaneId(null);
    setActiveNodeId(isUserResizableNode(node.type) ? node.id : null);
  };

  const activeLane = activeLaneId ? lanes.find((lane) => lane.id === activeLaneId) ?? null : null;
  const activeNode = (() => {
    if (!activeNodeId) return null;
    const lf = lfRef.current;
    if (!lf) return null;
    const model = lf.graphModel.getNodeModelById(activeNodeId) as unknown as NodeModelLike | undefined;
    return model && isUserResizableNode(model.type) ? model : null;
  })();
  const laneOverlay = (() => {
    void viewportTick;
    const lf = lfRef.current;
    if (!lf || !activeLane) return null;
    const transformModel = lf.graphModel.transformModel;
    const [toolbarX, toolbarY] = transformModel.CanvasPointToHtmlPoint([
      activeLane.x,
      LANE_TOP,
    ]);
    const [handleX, handleY] = transformModel.CanvasPointToHtmlPoint([
      activeLane.x + activeLane.width / 2,
      LANE_TOP + laneHeightRef.current,
    ]);
    return {
      toolbarLeft: toolbarX,
      toolbarTop: Math.max(toolbarY + 8, 8),
      handleLeft: handleX - LANE_RESIZE_HANDLE_SIZE / 2,
      handleTop: handleY - LANE_RESIZE_HANDLE_SIZE / 2,
    };
  })();
  const shapeOverlay = (() => {
    void viewportTick;
    const lf = lfRef.current;
    if (!lf || !activeNode) return null;
    const transformModel = lf.graphModel.transformModel;
    const { width, height } = getNodeDimensions(activeNode);
    const [handleX, handleY] = transformModel.CanvasPointToHtmlPoint([
      activeNode.x + width / 2,
      activeNode.y + height / 2,
    ]);
    return {
      handleLeft: handleX - LANE_RESIZE_HANDLE_SIZE / 2,
      handleTop: handleY - LANE_RESIZE_HANDLE_SIZE / 2,
      width,
      height,
      type: activeNode.type,
    };
  })();

  const startLaneResize = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!activeLaneId) return;
    const lf = lfRef.current;
    if (!lf) return;
    event.preventDefault();
    event.stopPropagation();
    laneResizeSessionRef.current = {
      laneId: activeLaneId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: activeLane?.width ?? MIN_LANE_WIDTH,
      startHeight: laneHeightRef.current,
      contentMinWidth: getRequiredLaneWidth(lf, activeLaneId, lanesRef.current),
      contentMinHeight: getRequiredLaneHeight(lf, MIN_LANE_HEIGHT),
    };
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const session = laneResizeSessionRef.current;
      const currentLF = lfRef.current;
      if (!session || !currentLF) return;
      const lane = findLaneById(lanesRef.current, session.laneId);
      if (!lane) return;
      const prevLanes = lanesRef.current;
      const [deltaX, deltaY] = currentLF.graphModel.transformModel.fixDeltaXY(
        moveEvent.clientX - session.startClientX,
        moveEvent.clientY - session.startClientY,
      );
      const nextWidth = clamp(
        session.startWidth + deltaX,
        session.contentMinWidth,
        MAX_LANE_WIDTH,
      );
      const nextHeight = Math.max(session.contentMinHeight, session.startHeight + deltaY);
      const resized = withPositions(
        toLaneDrafts(
          lanesRef.current.map((currentLane) =>
            currentLane.id === session.laneId
              ? { ...currentLane, width: roundCanvasValue(nextWidth) }
              : currentLane,
          ),
        ),
      );
      laneHeightRef.current = roundCanvasValue(nextHeight);
      updateLaneState(resized);
      applyLaneModels(resized, laneHeightRef.current);
      realignNodesToLaneLayout(prevLanes, resized);
      realignSyncBarsToLaneLayout(prevLanes, resized);
      setStatus(
        `Đang resize lane "${lane.title}" → ${Math.round(nextWidth)}w × ${Math.round(nextHeight)}h`,
      );
    };
    const handleMouseUp = () => {
      laneResizeSessionRef.current = null;
      const currentLF = lfRef.current;
      if (currentLF) {
        const contentHeight = getRequiredLaneHeight(currentLF, MIN_LANE_HEIGHT);
        if (laneHeightRef.current < contentHeight) {
          laneHeightRef.current = contentHeight;
          applyLaneModels(lanesRef.current, laneHeightRef.current);
        }
      }
      setStatus('Đã cập nhật kích thước lane');
      markDiagramChanged();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const startShapeResize = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!activeNode) return;
    const lf = lfRef.current;
    if (!lf) return;
    const { width, height } = getNodeDimensions(activeNode);
    const activeNodeLane =
      activeNode.type === 'sync-bar' ? undefined : getLaneBinding(activeNode, lanesRef.current)?.lane;
    event.preventDefault();
    event.stopPropagation();
    shapeResizeSessionRef.current = {
      nodeId: activeNode.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: activeNode.x,
      startY: activeNode.y,
      startWidth: width,
      startHeight: height,
      minWidth: activeNode.minWidth ?? 30,
      minHeight: activeNode.minHeight ?? 30,
      maxWidth:
        activeNode.type === 'sync-bar'
          ? activeNode.maxWidth ?? 2000
          : Math.min(
              activeNode.maxWidth ?? 2000,
              Math.max(width, activeNodeLane?.width ?? 2000),
            ),
      maxHeight: activeNode.maxHeight ?? 2000,
    };
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const session = shapeResizeSessionRef.current;
      const currentLF = lfRef.current;
      if (!session || !currentLF) return;
      const model = currentLF.graphModel.getNodeModelById(session.nodeId) as unknown as
        | NodeModelLike
        | undefined;
      if (!model || !isUserResizableNode(model.type)) return;
      const [deltaX, deltaY] = currentLF.graphModel.transformModel.fixDeltaXY(
        moveEvent.clientX - session.startClientX,
        moveEvent.clientY - session.startClientY,
      );
      const nextWidth = clamp(session.startWidth + deltaX, session.minWidth, session.maxWidth);
      const nextHeight =
        model.type === 'sync-bar'
          ? session.startHeight
          : clamp(session.startHeight + deltaY, session.minHeight, session.maxHeight);
      const deltaWidth = nextWidth - session.startWidth;
      const deltaHeight = nextHeight - session.startHeight;
      if (model.type === 'decision') {
        model.rx = roundCanvasValue(nextWidth / 2);
        model.ry = roundCanvasValue(nextHeight / 2);
      } else {
        model.width = roundCanvasValue(nextWidth);
        model.height = roundCanvasValue(nextHeight);
      }
      model.setProperties?.({
        ...(model.properties ?? {}),
        width: roundCanvasValue(nextWidth),
        height: roundCanvasValue(nextHeight),
        nodeSize:
          model.type === 'decision'
            ? {
                rx: roundCanvasValue(nextWidth / 2),
                ry: roundCanvasValue(nextHeight / 2),
              }
            : {
                width: roundCanvasValue(nextWidth),
                height: roundCanvasValue(nextHeight),
              },
      });
      model.moveTo?.(
        roundCanvasValue(session.startX + deltaWidth / 2),
        roundCanvasValue(
          model.type === 'sync-bar' ? session.startY : session.startY + deltaHeight / 2,
        ),
      );
      if (model.type === 'sync-bar') {
        persistSyncBarSpan(model, lanesRef.current, lanesRef.current, {
          width: nextWidth,
          height: nextHeight,
        }, true);
      }
      syncConnectedEdges(currentLF, model);
      if (model.type !== 'sync-bar') {
        const binding = getLaneBinding(model, lanesRef.current);
        if (binding) {
          setNodeLaneBinding(
            model,
            binding.lane.id,
            binding.clampedX - binding.lane.x,
            binding.relativeX,
          );
        }
      }
      refreshLaneHeight();
      bumpViewportTick();
      setStatus(
        `Đang resize ${model.type} → ${Math.round(nextWidth)}w × ${Math.round(nextHeight)}h`,
      );
    };
    const handleMouseUp = () => {
      shapeResizeSessionRef.current = null;
      setStatus('Đã cập nhật kích thước shape');
      markDiagramChanged();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Swimlane Activity Diagram — LogicFlow PoC</h1>
        <button className="toolbar-btn" onClick={handleUndo} title="Ctrl+Z">
          ↶
        </button>
        <button className="toolbar-btn" onClick={handleRedo} title="Ctrl+Y">
          ↷
        </button>
        <button className="toolbar-btn" onClick={handleZoomOut}>
          −
        </button>
        <button className="toolbar-btn" onClick={handleZoomIn}>
          +
        </button>
        <button className="toolbar-btn" onClick={handleFit}>
          Fit
        </button>
        <span style={{ width: 8 }} />
        <button
          className="toolbar-btn primary"
          onClick={handleAddLane}
          title="Thêm 1 lane (actor) mới vào bên phải"
        >
          + Lane
        </button>
        <span style={{ width: 8 }} />
        <button className="toolbar-btn" onClick={handleResetSample}>
          Reset mẫu
        </button>
        <button className="toolbar-btn" onClick={handleClear}>
          Xoá nội dung
        </button>
        <label className="toolbar-btn" style={{ cursor: 'pointer' }}>
          Import XML…
          <input
            type="file"
            accept=".xml,text/xml,application/xml"
            style={{ display: 'none' }}
            onChange={handleImportXML}
          />
        </label>
        <button className="toolbar-btn" onClick={handleExportXML}>
          Export XML
        </button>
        <button className="toolbar-btn primary" onClick={() => void executeGenerateBrd()}>
          Generate BRD
        </button>
        <button
          className="toolbar-btn"
          onClick={handleOpenCachedBrd}
          disabled={!hasCachedBrdSnapshot}
        >
          Open last BRD draft
        </button>
        <button
          className="toolbar-btn"
          onClick={handleDiscardCachedBrd}
          disabled={!hasCachedBrdSnapshot}
        >
          Discard cached BRD
        </button>
        <button className="toolbar-btn primary" onClick={handleExportPNG}>
          Export PNG
        </button>
        <span className="toolbar-status">
          {lanes.length} lane · {status}
        </span>
      </header>

      <DndPanel items={PALETTE} onStartDrag={handleStartDrag} />

      <div className="app-canvas" onMouseUp={handleCanvasMouseUp}>
        <div ref={containerRef} className="canvas-host lf-container" />
        {activeLane && laneOverlay ? (
          <>
            <div
              className="lane-toolbar"
              style={{
                left: laneOverlay.toolbarLeft,
                top: laneOverlay.toolbarTop,
              }}
            >
              <span className="lane-toolbar__label">{activeLane.title}</span>
              <button
                className="lane-toolbar__btn"
                onClick={() => handleMoveLane(activeLane.id, -1)}
                disabled={lanes[0]?.id === activeLane.id}
                title="Đưa lane sang trái"
              >
                ←
              </button>
              <button
                className="lane-toolbar__btn"
                onClick={() => handleMoveLane(activeLane.id, 1)}
                disabled={lanes[lanes.length - 1]?.id === activeLane.id}
                title="Đưa lane sang phải"
              >
                →
              </button>
              <button
                className="lane-toolbar__btn"
                onClick={() => handleRenameLane(activeLane.id)}
                title="Đổi tên lane"
              >
                Rename
              </button>
              <button
                className="lane-toolbar__btn danger"
                onClick={() => handleDeleteLane(activeLane.id)}
                title="Xoá lane"
              >
                Delete
              </button>
              <span className="lane-toolbar__meta">
                {Math.round(activeLane.width)} × {Math.round(laneHeightRef.current)}
              </span>
            </div>
            <button
              className="lane-resize-handle"
              style={{
                left: laneOverlay.handleLeft,
                top: laneOverlay.handleTop,
                width: LANE_RESIZE_HANDLE_SIZE,
                height: LANE_RESIZE_HANDLE_SIZE,
              }}
              onMouseDown={startLaneResize}
              title="Kéo để đổi width lane và height toàn bộ swimlane"
            />
          </>
        ) : null}
        {activeNode && shapeOverlay ? (
          <button
            className="shape-resize-handle"
            style={{
              left: shapeOverlay.handleLeft,
              top: shapeOverlay.handleTop,
              width: LANE_RESIZE_HANDLE_SIZE,
              height: LANE_RESIZE_HANDLE_SIZE,
              cursor: shapeOverlay.type === 'sync-bar' ? 'ew-resize' : 'nwse-resize',
            }}
            onMouseDown={startShapeResize}
            title={
              shapeOverlay.type === 'sync-bar'
                ? `Kéo để đổi độ dài sync-bar (${Math.round(shapeOverlay.width)} × ${Math.round(shapeOverlay.height)})`
                : `Kéo để đổi kích thước ${shapeOverlay.type} (${Math.round(shapeOverlay.width)} × ${Math.round(shapeOverlay.height)})`
            }
          />
        ) : null}
        <BrdPanel
          open={brdPanelOpen}
          phase={brdPhase}
          activeTab={brdTab}
          onTabChange={setBrdTab}
          warnings={brdWarnings}
          blockingIssues={brdBlockingIssues}
          spec={brdSpec}
          draft={brdDraft}
          onDraftChange={setBrdDraft}
          onClose={() => setBrdPanelOpen(false)}
          onCopy={() => void handleCopyBrdDraft()}
          onExport={handleExportBrdDraft}
          onRetry={
            brdError?.retryable
              ? () => {
                  void executeGenerateBrd({ reuseIdempotencyKey: true });
                }
              : null
          }
          onAcknowledgeOutdated={isBrdOutdated ? handleAcknowledgeOutdatedDraft : null}
          metadata={brdMetadata}
          requestId={brdRequestId}
          runtimeStatus={brdRuntimeStatus}
          error={brdError}
          isOutdated={isBrdOutdated}
        />
      </div>
    </div>
  );
}
