const TEXT_CHAR_WIDTH = 7;
const TEXT_LINE_HEIGHT = 18;
const TEXT_HORIZONTAL_PADDING = 36;
const TEXT_VERTICAL_PADDING = 26;
const ACTIVITY_TEXT_PADDING = 24;
const DECISION_TEXT_PADDING = 44;
const NOTE_TEXT_PADDING = 24;

export function getTextValue(data: any): string {
  if (typeof data.text === 'string') return data.text;
  if (typeof data.text?.value === 'string') return data.text.value;
  return '';
}

function measureTextBox(
  text: string,
  {
    minWidth,
    minHeight,
    maxWidth,
  }: { minWidth: number; minHeight: number; maxWidth: number },
) {
  const lines = text.length > 0 ? text.split('\n') : [''];
  const longestLine = Math.max(...lines.map((line) => line.length), 1);
  const width = Math.min(
    Math.max(minWidth, longestLine * TEXT_CHAR_WIDTH + TEXT_HORIZONTAL_PADDING),
    maxWidth,
  );
  const estimatedWrappedLines = lines.reduce((total, line) => {
    const charsPerLine = Math.max(
      1,
      Math.floor((width - TEXT_HORIZONTAL_PADDING) / TEXT_CHAR_WIDTH),
    );
    return total + Math.max(1, Math.ceil(Math.max(line.length, 1) / charsPerLine));
  }, 0);
  const height = Math.max(
    minHeight,
    estimatedWrappedLines * TEXT_LINE_HEIGHT + TEXT_VERTICAL_PADDING,
  );
  return { width, height };
}

export function getAutoNodeSize(type: string, text: string, properties?: Record<string, unknown>) {
  const propertyWidth = Number(properties?.width);
  const propertyHeight = Number(properties?.height);
  const nodeSizeWidth = Number((properties?.nodeSize as { width?: number } | undefined)?.width);
  const nodeSizeHeight = Number((properties?.nodeSize as { height?: number } | undefined)?.height);
  const nodeSizeRx = Number((properties?.nodeSize as { rx?: number } | undefined)?.rx);
  const nodeSizeRy = Number((properties?.nodeSize as { ry?: number } | undefined)?.ry);
  const baseWidth = Number.isFinite(nodeSizeWidth)
    ? nodeSizeWidth
    : Number.isFinite(nodeSizeRx)
      ? nodeSizeRx * 2
      : Number.isFinite(propertyWidth)
        ? propertyWidth
        : undefined;
  const baseHeight = Number.isFinite(nodeSizeHeight)
    ? nodeSizeHeight
    : Number.isFinite(nodeSizeRy)
      ? nodeSizeRy * 2
      : Number.isFinite(propertyHeight)
        ? propertyHeight
        : undefined;

  if (type === 'activity') {
    return measureTextBox(text, {
      minWidth: baseWidth ?? 180,
      minHeight: baseHeight ?? 44,
      maxWidth: 320,
    });
  }
  if (type === 'decision') {
    return measureTextBox(text, {
      minWidth: baseWidth ?? 160,
      minHeight: baseHeight ?? 80,
      maxWidth: 260,
    });
  }
  if (type === 'note') {
    return measureTextBox(text, {
      minWidth: baseWidth ?? 220,
      minHeight: baseHeight ?? 90,
      maxWidth: 360,
    });
  }
  if (type === 'sync-bar') {
    return { width: baseWidth ?? 320, height: baseHeight ?? 8 };
  }
  return undefined;
}

export function getShapeTextWrapWidth(type: string, width: number) {
  if (type === 'decision') {
    return Math.max(40, width - DECISION_TEXT_PADDING);
  }
  if (type === 'note') {
    return Math.max(60, width - NOTE_TEXT_PADDING);
  }
  if (type === 'activity') {
    return Math.max(40, width - ACTIVITY_TEXT_PADDING);
  }
  return Math.max(40, width);
}

export { TEXT_LINE_HEIGHT };
