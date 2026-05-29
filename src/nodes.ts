import LogicFlow from '@logicflow/core';
import {
  RectNode,
  RectNodeModel,
  EllipseNode,
  EllipseNodeModel,
  PolygonNode,
  PolygonNodeModel,
  h,
} from '@logicflow/core';

/**
 * Lane background — non-interactive rectangle with a header label.
 * Rendered as a real LogicFlow node so it zooms/pans together with the diagram.
 */
class LaneModel extends RectNodeModel {
  initNodeData(data: any) {
    super.initNodeData(data);
    this.width = data.properties?.width ?? 320;
    this.height = data.properties?.height ?? 1100;
    // Lanes sit underneath every other node. We pick a very low zIndex so
    // even nodes that LogicFlow brings to the front (selection / autoToFront)
    // never end up beneath a lane in the SVG stacking order.
    this.zIndex = -1000;
    // Disable all interactions
    this.draggable = false;
    this.selectable = false;
    this.isShowAnchor = false;
    this.text.editable = false;
    this.text.draggable = false;
  }

  getNodeStyle() {
    const style = super.getNodeStyle();
    style.fill = '#ffffff';
    style.stroke = '#9c2a47';
    style.strokeWidth = 1.5;
    return style;
  }

  getTextStyle() {
    const style = super.getTextStyle();
    style.fontSize = 14;
    style.fontWeight = '600';
    style.color = '#111827';
    return style;
  }

  // Lanes cannot be deleted via DELETE key
  getConnectedSourceRules() {
    return [
      {
        message: 'Lane không phải là node logic',
        validate: () => false,
      },
    ];
  }
  getConnectedTargetRules() {
    return [
      {
        message: 'Lane không phải là node logic',
        validate: () => false,
      },
    ];
  }
}

class LaneView extends RectNode {
  getShape() {
    const { x, y, width, height } = this.props.model;
    const style = this.props.model.getNodeStyle();
    // Render lane: full body rect + header strip on top
    const left = x - width / 2;
    const top = y - height / 2;
    const headerHeight = 36;
    return h('g', {}, [
      // Lane body
      h('rect', {
        x: left,
        y: top,
        width,
        height,
        fill: style.fill,
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
      }),
      // Header strip
      h('rect', {
        x: left,
        y: top,
        width,
        height: headerHeight,
        fill: '#f3f4f6',
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
      }),
    ]);
  }

  // Render header text at top of the lane (overrides default centered text)
  getText() {
    const { x, y, height, text } = this.props.model;
    if (!text) return '';
    const top = y - height / 2 + 18;
    return h(
      'text',
      {
        x,
        y: top,
        textAnchor: 'middle',
        fontSize: 14,
        fontWeight: 600,
        fill: '#111827',
      },
      text.value,
    );
  }
}

/** Start node — filled black circle */
class StartModel extends EllipseNodeModel {
  initNodeData(data: any) {
    super.initNodeData(data);
    this.rx = 14;
    this.ry = 14;
  }
  getNodeStyle() {
    const s = super.getNodeStyle();
    s.fill = '#111827';
    s.stroke = '#111827';
    return s;
  }
}

/** End node — outer circle + inner filled dot */
class EndModel extends EllipseNodeModel {
  initNodeData(data: any) {
    super.initNodeData(data);
    this.rx = 16;
    this.ry = 16;
  }
  getNodeStyle() {
    const s = super.getNodeStyle();
    s.fill = '#ffffff';
    s.stroke = '#111827';
    s.strokeWidth = 1.5;
    return s;
  }
}

class EndView extends EllipseNode {
  getShape() {
    const original = super.getShape();
    const { x, y } = this.props.model;
    // Add inner solid dot
    return h('g', {}, [
      original,
      h('circle', {
        cx: x,
        cy: y,
        r: 7,
        fill: '#111827',
      }),
    ]);
  }
}

/** Activity — yellow rounded rect */
class ActivityModel extends RectNodeModel {
  initNodeData(data: any) {
    super.initNodeData(data);
    this.width = data.properties?.width ?? 180;
    this.height = data.properties?.height ?? 44;
    this.radius = 12;
  }
  getNodeStyle() {
    const s = super.getNodeStyle();
    s.fill = '#fff2cc';
    s.stroke = '#d6b656';
    s.strokeWidth = 1.5;
    return s;
  }
  getTextStyle() {
    const s = super.getTextStyle();
    s.fontSize = 12;
    s.color = '#111827';
    return s;
  }
}

/** Decision — diamond */
class DecisionModel extends PolygonNodeModel {
  initNodeData(data: any) {
    super.initNodeData(data);
    const width = data.properties?.width ?? 160;
    const height = data.properties?.height ?? 80;
    const w2 = width / 2;
    const h2 = height / 2;
    this.points = [
      [w2, 0],
      [width, h2],
      [w2, height],
      [0, h2],
    ];
  }
  getNodeStyle() {
    const s = super.getNodeStyle();
    s.fill = '#ffffff';
    s.stroke = '#9c2a47';
    s.strokeWidth = 1.5;
    return s;
  }
  getTextStyle() {
    const s = super.getTextStyle();
    s.fontSize = 11;
    s.color = '#111827';
    return s;
  }
}

/** Sync Bar — thick horizontal black bar (fork/join) */
class SyncBarModel extends RectNodeModel {
  initNodeData(data: any) {
    super.initNodeData(data);
    this.width = data.properties?.width ?? 320;
    this.height = data.properties?.height ?? 8;
    this.radius = 2;
    this.text.editable = false;
  }
  getNodeStyle() {
    const s = super.getNodeStyle();
    s.fill = '#111827';
    s.stroke = '#111827';
    return s;
  }
}

/** Note — sticky-note yellow rect */
class NoteModel extends RectNodeModel {
  initNodeData(data: any) {
    super.initNodeData(data);
    this.width = data.properties?.width ?? 220;
    this.height = data.properties?.height ?? 90;
    this.radius = 2;
  }
  getNodeStyle() {
    const s = super.getNodeStyle();
    s.fill = '#fff2cc';
    s.stroke = '#d6b656';
    s.strokeWidth = 1;
    s.strokeDasharray = '0';
    return s;
  }
  getTextStyle() {
    const s = super.getTextStyle();
    s.fontSize = 11;
    s.color = '#111827';
    s.textAlign = 'left';
    return s;
  }
}

export function registerNodes(lf: LogicFlow) {
  lf.register({ type: 'lane', view: LaneView, model: LaneModel });
  lf.register({ type: 'start', view: EllipseNode, model: StartModel });
  lf.register({ type: 'end', view: EndView, model: EndModel });
  lf.register({ type: 'activity', view: RectNode, model: ActivityModel });
  lf.register({ type: 'decision', view: PolygonNode, model: DecisionModel });
  lf.register({ type: 'sync-bar', view: RectNode, model: SyncBarModel });
  lf.register({ type: 'note', view: RectNode, model: NoteModel });
}

/** Lane layout config — used to pre-render lanes and (optionally) snap nodes. */
export interface LaneConfig {
  id: string;
  title: string;
  x: number; // center x — computed from cumulative widths via withPositions()
  width: number;
}

/** Initial seed for lane state. Edit this to change the default lanes. */
export const DEFAULT_LANES: Omit<LaneConfig, 'x'>[] = [
  { id: 'lane-1', title: 'Nguồn phát hiện đầu tiên', width: 320 },
  { id: 'lane-2', title: 'Nhân sự vận hành liên lạc (VOC)', width: 360 },
  { id: 'lane-3', title: 'Trưởng điều phối khán giả (VOC)', width: 360 },
  { id: 'lane-4', title: 'Nhân viên hiện trường', width: 400 },
];

export const LANE_LEFT_PADDING = 40;
export const LANE_Y = 580;
export const LANE_HEIGHT = 1100;

/** Compute center-x for each lane from cumulative widths (left to right). */
export function withPositions(
  lanes: Omit<LaneConfig, 'x'>[],
  leftPadding = LANE_LEFT_PADDING,
): LaneConfig[] {
  let cursor = leftPadding;
  return lanes.map((lane) => {
    const x = cursor + lane.width / 2;
    cursor += lane.width;
    return { ...lane, x };
  });
}

/** Backwards-compat export so legacy imports don't break. */
export const LANES: LaneConfig[] = withPositions(DEFAULT_LANES);
