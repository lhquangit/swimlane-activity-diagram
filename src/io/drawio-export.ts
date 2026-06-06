import { LANE_TOP, type LaneConfig } from '../lane-config';
import type { EditorGraphData } from './drawio-types';
import { encodeTextForDrawio, escapeXml } from './drawio-shared';
import { serializeProvenance } from './provenance';

const OUTER_CONTAINER_ID = 'lf-root-swimlane';
const OUTER_CONTAINER_TOP_OFFSET = 20;

export function exportDrawioXml(
  graphData: EditorGraphData,
  lanes: LaneConfig[],
  laneHeight: number,
  diagramName = 'Swimlane Activity Diagram',
) {
  const outerX = lanes.length > 0 ? Math.min(...lanes.map((lane) => lane.x - lane.width / 2)) : 40;
  const outerY = 0;
  const outerWidth = lanes.reduce((total, lane) => total + lane.width, 0);
  const outerHeight = laneHeight + OUTER_CONTAINER_TOP_OFFSET;

  const laneCells = lanes.map((lane) => {
    const laneLeft = lane.x - lane.width / 2;
    return `
        <mxCell id="${escapeXml(lane.id)}" parent="${OUTER_CONTAINER_ID}" style="${laneStyle()}" value="${encodeTextForDrawio(lane.title)}" vertex="1">
          <mxGeometry height="${laneHeight}" width="${lane.width}" x="${laneLeft - outerX}" y="${OUTER_CONTAINER_TOP_OFFSET}" as="geometry" />
        </mxCell>`;
  });

  const nodeCells = (graphData.nodes ?? [])
    .filter((node) => node.type !== 'lane')
    .map((node) => {
      const parentLane = resolveNodeLane(node, lanes);
      if (!parentLane) return '';
      const laneLeft = parentLane.x - parentLane.width / 2;
      const { width, height } = getNodeDimensions(node);
      const x = round(node.x - laneLeft - width / 2);
      const y = round(node.y - LANE_TOP - height / 2);
      const text = readNodeText(node);
      return `
        <mxCell id="${escapeXml(node.id)}" parent="${escapeXml(parentLane.id)}" style="${nodeStyle(node.type)}" value="${encodeTextForDrawio(text)}" vertex="1"${provenanceAttribute(node.properties)}>
          <mxGeometry height="${height}" width="${width}" x="${x}" y="${y}" as="geometry" />
        </mxCell>`;
    })
    .join('');

  const edgeCells = (graphData.edges ?? [])
    .map((edge) => {
      const label = readEdgeText(edge);
      const labelCell = label
        ? `
        <mxCell id="${escapeXml(`${edge.id}__label`)}" connectable="0" parent="${escapeXml(edge.id)}" style="edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];" value="${encodeTextForDrawio(label)}" vertex="1">
          <mxGeometry relative="1" as="geometry">
            <mxPoint as="offset" />
          </mxGeometry>
        </mxCell>`
        : '';
      return `
        <mxCell id="${escapeXml(edge.id)}" edge="1" parent="${OUTER_CONTAINER_ID}" source="${escapeXml(edge.sourceNodeId)}" target="${escapeXml(edge.targetNodeId)}" style="${edgeStyle()}" value=""${provenanceAttribute(edge.properties)}>
          <mxGeometry relative="1" as="geometry" />
        </mxCell>${labelCell}`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net">
  <diagram name="${escapeXml(diagramName)}" id="logicflow-swimlane-diagram">
    <mxGraphModel dx="1600" dy="1200" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" background="#FFFFFF" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="${OUTER_CONTAINER_ID}" parent="1" style="${outerContainerStyle()}" value="" vertex="1">
          <mxGeometry height="${outerHeight}" width="${round(outerWidth)}" x="${round(outerX)}" y="${outerY}" as="geometry" />
        </mxCell>${laneCells.join('')}${nodeCells}${edgeCells}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

function outerContainerStyle() {
  return 'swimlane;childLayout=stackLayout;resizeParent=1;resizeParentMax=0;startSize=20;html=1;fillColor=#e3c800;fontColor=#000000;strokeColor=#B09500;swimlaneFillColor=default;gradientColor=none;swimlaneLine=1;fontSize=14;';
}

function laneStyle() {
  return 'swimlane;lfType=lane;startSize=40;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;swimlaneLine=1;fontSize=14;';
}

function nodeStyle(type: string) {
  switch (type) {
    case 'start':
      return 'ellipse;lfType=start;html=1;shape=startState;fillColor=#000000;strokeColor=#ff0000;swimlaneLine=1;fontSize=14;';
    case 'end':
      return 'ellipse;lfType=end;html=1;shape=endState;fillColor=#000000;strokeColor=#ff0000;fontSize=14;';
    case 'decision':
      return 'rhombus;lfType=decision;whiteSpace=wrap;html=1;fontColor=#000000;fillColor=#ffffc0;strokeColor=#ff0000;fontSize=14;';
    case 'sync-bar':
      return 'shape=line;lfType=sync-bar;html=1;strokeWidth=6;strokeColor=#ff0000;swimlaneLine=1;fontSize=14;';
    case 'note':
      return 'points=[[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0.25,0],[1,0.5,0],[1,0.75,0],[0.75,1,0],[0.5,1,0],[0.25,1,0],[0,0.75,0],[0,0.5,0],[0,0.25,0]];lfType=note;shape=mxgraph.bpmn.task2;whiteSpace=wrap;rectStyle=rounded;size=10;html=1;container=1;expand=0;collapsible=0;bpmnShapeType=call;align=left;fillColor=#fff2cc;strokeColor=#d6b656;swimlaneLine=1;fontSize=14;';
    case 'activity':
    default:
      return 'points=[[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0.25,0],[1,0.5,0],[1,0.75,0],[0.75,1,0],[0.5,1,0],[0.25,1,0],[0,0.75,0],[0,0.5,0],[0,0.25,0]];lfType=activity;shape=mxgraph.bpmn.task2;whiteSpace=wrap;rectStyle=rounded;size=10;html=1;container=1;expand=0;collapsible=0;bpmnShapeType=call;align=left;swimlaneLine=1;fontSize=14;';
  }
}

function edgeStyle() {
  return 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;swimlaneLine=1;fontSize=14;';
}

function resolveNodeLane(
  node: NonNullable<EditorGraphData['nodes']>[number],
  lanes: LaneConfig[],
) {
  const storedLaneId =
    typeof node.properties?.laneId === 'string' ? (node.properties.laneId as string) : undefined;
  if (storedLaneId) {
    const storedLane = lanes.find((lane) => lane.id === storedLaneId);
    if (storedLane) return storedLane;
  }
  return lanes.find((lane) => {
    const left = lane.x - lane.width / 2;
    const right = lane.x + lane.width / 2;
    return node.x > left && node.x < right;
  });
}

function readNodeText(node: NonNullable<EditorGraphData['nodes']>[number]) {
  if (typeof node.text === 'string') return node.text;
  if (node.text && typeof node.text.value === 'string') return node.text.value;
  return '';
}

function readEdgeText(edge: NonNullable<EditorGraphData['edges']>[number]) {
  if (typeof edge.text === 'string') return edge.text;
  if (edge.text && typeof edge.text.value === 'string') return edge.text.value;
  return '';
}

function getNodeDimensions(node: NonNullable<EditorGraphData['nodes']>[number]) {
  const width =
    Number((node.properties?.nodeSize as { width?: number } | undefined)?.width) ||
    Number(node.properties?.width) ||
    Number((node.properties?.nodeSize as { rx?: number } | undefined)?.rx) * 2 ||
    (node.type === 'sync-bar' ? 320 : node.type === 'decision' ? 160 : node.type === 'note' ? 220 : 180);
  const height =
    Number((node.properties?.nodeSize as { height?: number } | undefined)?.height) ||
    Number(node.properties?.height) ||
    Number((node.properties?.nodeSize as { ry?: number } | undefined)?.ry) * 2 ||
    (node.type === 'sync-bar' ? 8 : node.type === 'decision' ? 80 : node.type === 'note' ? 90 : 44);
  return { width: round(width), height: round(height) };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function provenanceAttribute(properties?: Record<string, unknown>) {
  const serialized = serializeProvenance(properties);
  return serialized ? ` data-lf-provenance="${escapeXml(serialized)}"` : '';
}
