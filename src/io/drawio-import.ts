import { LANE_HEIGHT, LANE_LEFT_PADDING, LANE_TOP, withPositions } from '../lane-config';
import type { DrawioImportResult, EditorGraphData } from './drawio-types';
import {
  decodeDrawioText,
  parseStyleString,
  readGeometryNumber,
} from './drawio-shared';

type LaneDraft = {
  id: string;
  title: string;
  width: number;
  sourceX: number;
};

type ParsedCell = {
  id: string;
  parent: string | null;
  source: string | null;
  target: string | null;
  edge: boolean;
  vertex: boolean;
  styleText: string;
  style: Record<string, string>;
  value: string;
  geometry: Element | null;
  element: Element;
};

export function importDrawioXml(xml: string): DrawioImportResult {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml, 'application/xml');
  const parseError = document.querySelector('parsererror');
  if (parseError) {
    throw new Error('File XML không hợp lệ.');
  }

  const diagram = document.querySelector('mxfile > diagram');
  const graphModel = diagram?.querySelector('mxGraphModel > root');
  if (!diagram || !graphModel) {
    throw new Error('Không tìm thấy cấu trúc draw.io `mxfile/diagram/mxGraphModel/root`.');
  }

  const parsedCells = Array.from(graphModel.children)
    .filter((element): element is Element => element.tagName === 'mxCell')
    .map((element) => toParsedCell(element));
  const byId = new Map(parsedCells.map((cell) => [cell.id, cell]));

  const container = parsedCells.find((cell) => isContainerSwimlane(cell));
  if (!container) {
    throw new Error('Không tìm thấy swimlane container gốc trong file XML.');
  }

  const laneDrafts = parsedCells
    .filter((cell) => isLaneCell(cell, container.id))
    .map((cell) => ({
      id: cell.id,
      title: normalizeLaneTitle(cell.value, cell.id),
      width: readGeometryNumber(cell.geometry ?? cell.element, 'width', 320),
      sourceX: readGeometryNumber(cell.geometry ?? cell.element, 'x', 0),
    }))
    .sort((a, b) => a.sourceX - b.sourceX);

  if (laneDrafts.length === 0) {
    throw new Error('Không tìm thấy lane con nào trong file draw.io.');
  }

  const lanes = withPositions(
    laneDrafts.map(({ id, title, width }) => ({ id, title, width })),
    LANE_LEFT_PADDING,
  );
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));
  const laneOrderById = new Map(lanes.map((lane, index) => [lane.id, index]));
  const laneHeight = Math.max(
    ...laneDrafts.map((draft) => {
      const cell = byId.get(draft.id);
      return readGeometryNumber(cell?.geometry ?? cell?.element ?? document.documentElement, 'height', LANE_HEIGHT);
    }),
    LANE_HEIGHT,
  );

  const edgeLabels = new Map<string, string>();
  parsedCells
    .filter((cell) => isEdgeLabelCell(cell))
    .forEach((cell) => {
      if (cell.parent) {
        const text = decodeDrawioText(cell.value);
        if (text) edgeLabels.set(cell.parent, text);
      }
    });

  const edges = parsedCells
    .filter((cell) => cell.edge && cell.source && cell.target)
    .map((cell) => ({
      id: cell.id,
      type: 'polyline',
      sourceNodeId: cell.source!,
      targetNodeId: cell.target!,
      text: edgeLabels.has(cell.id) ? { value: edgeLabels.get(cell.id)! } : undefined,
    }));

  const incomingCount = new Map<string, number>();
  const outgoingCount = new Map<string, number>();
  edges.forEach((edge) => {
    incomingCount.set(edge.targetNodeId, (incomingCount.get(edge.targetNodeId) ?? 0) + 1);
    outgoingCount.set(edge.sourceNodeId, (outgoingCount.get(edge.sourceNodeId) ?? 0) + 1);
  });

  const nodes = parsedCells
    .filter((cell) => isImportableNodeCell(cell, laneById))
    .map((cell) => {
      const lane = laneById.get(cell.parent!);
      if (!lane) return null;
      const geometry = cell.geometry;
      if (!geometry) return null;
      const width = readGeometryNumber(geometry, 'width', 180);
      const height = readGeometryNumber(geometry, 'height', 44);
      const localX = readGeometryNumber(geometry, 'x', 0);
      const localY = readGeometryNumber(geometry, 'y', 0);
      const laneLeft = lane.x - lane.width / 2;
      const text = decodeDrawioText(cell.value);
      const type = inferNodeType(cell, {
        laneOrder: laneOrderById.get(lane.id) ?? 0,
        incoming: incomingCount.get(cell.id) ?? 0,
        outgoing: outgoingCount.get(cell.id) ?? 0,
        text,
      });
      const x = laneLeft + localX + width / 2;
      const y = LANE_TOP + localY + height / 2;
      return {
        id: cell.id,
        type,
        x,
        y,
        text: type === 'sync-bar' || type === 'start' || type === 'end' ? undefined : { value: text, x, y },
        properties: buildNodeProperties(type, lane.id, width, height),
      };
    })
    .filter(Boolean) as NonNullable<EditorGraphData['nodes']>[number][];

  return {
    lanes,
    laneHeight,
    graph: {
      nodes,
      edges,
    },
    diagramName: diagram.getAttribute('name') || 'Imported draw.io diagram',
  };
}

function toParsedCell(element: Element): ParsedCell {
  const styleText = element.getAttribute('style') || '';
  return {
    id: element.getAttribute('id') || '',
    parent: element.getAttribute('parent'),
    source: element.getAttribute('source'),
    target: element.getAttribute('target'),
    edge: element.getAttribute('edge') === '1',
    vertex: element.getAttribute('vertex') === '1',
    styleText,
    style: parseStyleString(styleText),
    value: element.getAttribute('value') || '',
    geometry: Array.from(element.children).find(
      (child): child is Element => child.tagName === 'mxGeometry',
    ) ?? null,
    element,
  };
}

function isContainerSwimlane(cell: ParsedCell) {
  return cell.vertex && isSwimlaneCell(cell) && cell.style.childLayout === 'stackLayout';
}

function isLaneCell(cell: ParsedCell, containerId: string) {
  return cell.vertex && cell.parent === containerId && isSwimlaneCell(cell);
}

function isEdgeLabelCell(cell: ParsedCell) {
  return cell.vertex && cell.styleText.includes('edgeLabel');
}

function isImportableNodeCell(cell: ParsedCell, laneById: Map<string, unknown>) {
  return cell.vertex && !!cell.parent && laneById.has(cell.parent) && !isSwimlaneCell(cell);
}

function isSwimlaneCell(cell: ParsedCell) {
  return cell.styleText.startsWith('swimlane;');
}

function normalizeLaneTitle(rawValue: string, fallbackId: string) {
  const decoded = decodeDrawioText(rawValue);
  return decoded || fallbackId;
}

function inferNodeType(
  cell: ParsedCell,
  context: { laneOrder: number; incoming: number; outgoing: number; text: string },
) {
  const { style } = cell;
  const lfType = style.lfType;
  if (lfType === 'start' || lfType === 'end' || lfType === 'activity' || lfType === 'decision' || lfType === 'sync-bar' || lfType === 'note') {
    return lfType;
  }
  if (style.shape === 'startState') return 'start';
  if (style.shape === 'endState') return 'end';
  if ('rhombus' in style || style.shape === 'rhombus') return 'decision';
  if (style.shape === 'line') return 'sync-bar';

  if (style.shape === 'mxgraph.bpmn.task2') {
    const lines = context.text.split('\n').map((line) => line.trim()).filter(Boolean);
    const bulletCount = (context.text.match(/-\s/g) ?? []).length;
    const looksLikeContextNote =
      context.laneOrder === 0 &&
      context.incoming === 0 &&
      context.outgoing <= 1 &&
      (lines.length >= 4 || bulletCount >= 3);
    return looksLikeContextNote ? 'note' : 'activity';
  }

  return 'activity';
}

function buildNodeProperties(type: string, laneId: string, width: number, height: number) {
  if (type === 'start' || type === 'end') {
    return { laneId };
  }
  if (type === 'decision') {
    return {
      laneId,
      width,
      height,
      nodeSize: { rx: width / 2, ry: height / 2 },
    };
  }
  return {
    laneId,
    width,
    height,
    nodeSize: { width, height },
  };
}
