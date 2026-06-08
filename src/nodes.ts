import LogicFlow from '@logicflow/core';
import {
  RectNodeModel,
  EllipseNode,
  EllipseNodeModel,
  h,
} from '@logicflow/core';
import { RectResize, DiamondResize } from '@logicflow/extension';
import {
  DEFAULT_LANES,
  LANE_HEIGHT,
  LANE_LEFT_PADDING,
  LANES,
  LANE_TOP,
  LANE_Y,
  type LaneConfig,
  withPositions,
} from './lane-config';
import { getAutoNodeSize, getShapeTextWrapWidth, getTextValue, TEXT_LINE_HEIGHT } from './node-text';

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
    // Lane is a visual background node; it must never jump above real shapes.
    this.autoToFront = false;
    // Disable all interactions
    this.draggable = false;
    this.selectable = true;
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

class LaneView extends RectResize.view {
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
class ActivityModel extends RectResize.model {
  initNodeData(data: any) {
    super.initNodeData(data);
    const size = getAutoNodeSize('activity', getTextValue(data), data.properties);
    this.width = size?.width ?? 180;
    this.height = size?.height ?? 44;
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
    s.lineHeight = `${TEXT_LINE_HEIGHT}px`;
    s.color = '#111827';
    s.overflowMode = 'autoWrap';
    s.whiteSpace = 'pre-wrap';
    s.overflowWrap = 'break-word';
    s.wordBreak = 'break-word';
    s.textWidth = getShapeTextWrapWidth('activity', this.width);
    return s;
  }
}

/** Decision — diamond */
class DecisionModel extends DiamondResize.model {
  initNodeData(data: any) {
    super.initNodeData(data);
    const size = getAutoNodeSize('decision', getTextValue(data), data.properties);
    const width = size?.width ?? 160;
    const height = size?.height ?? 80;
    this.rx = width / 2;
    this.ry = height / 2;
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
    s.lineHeight = '16px';
    s.color = '#111827';
    s.overflowMode = 'autoWrap';
    s.whiteSpace = 'pre-wrap';
    s.overflowWrap = 'break-word';
    s.wordBreak = 'break-word';
    s.textWidth = getShapeTextWrapWidth('decision', this.width);
    return s;
  }
}

/** Sync Bar — thick horizontal black bar (fork/join) */
class SyncBarModel extends RectResize.model {
  initNodeData(data: any) {
    super.initNodeData(data);
    const size = getAutoNodeSize('sync-bar', '', data.properties);
    this.width = size?.width ?? 320;
    this.height = size?.height ?? 8;
    this.radius = 2;
    this.minHeight = 8;
    this.maxHeight = 8;
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
class NoteModel extends RectResize.model {
  initNodeData(data: any) {
    super.initNodeData(data);
    const size = getAutoNodeSize('note', getTextValue(data), data.properties);
    this.width = size?.width ?? 220;
    this.height = size?.height ?? 90;
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
    s.lineHeight = '16px';
    s.color = '#111827';
    s.textAlign = 'left';
    s.overflowMode = 'autoWrap';
    s.whiteSpace = 'pre-wrap';
    s.overflowWrap = 'break-word';
    s.wordBreak = 'break-word';
    s.textWidth = getShapeTextWrapWidth('note', this.width);
    return s;
  }
}

export function registerNodes(lf: LogicFlow) {
  lf.register({ type: 'lane', view: LaneView, model: LaneModel });
  lf.register({ type: 'start', view: EllipseNode, model: StartModel });
  lf.register({ type: 'end', view: EndView, model: EndModel });
  lf.register({ type: 'activity', view: RectResize.view, model: ActivityModel });
  lf.register({ type: 'decision', view: DiamondResize.view, model: DecisionModel });
  lf.register({ type: 'sync-bar', view: RectResize.view, model: SyncBarModel });
  lf.register({ type: 'note', view: RectResize.view, model: NoteModel });
}

export {
  DEFAULT_LANES,
  getAutoNodeSize,
  getShapeTextWrapWidth,
  LANE_HEIGHT,
  LANE_LEFT_PADDING,
  LANES,
  LANE_TOP,
  LANE_Y,
  type LaneConfig,
  withPositions,
};
