import { describe, expect, it } from 'vitest';

import { getAutoNodeSize, getShapeTextWrapWidth } from './node-text';

describe('node text wrapping', () => {
  it('keeps rendered text width inside each resizable shape', () => {
    expect(getShapeTextWrapWidth('activity', 180)).toBeLessThan(180);
    expect(getShapeTextWrapWidth('decision', 160)).toBeLessThan(160);
    expect(getShapeTextWrapWidth('note', 220)).toBeLessThan(220);
  });

  it('wraps long generated text by growing height within the shape width cap', () => {
    const size = getAutoNodeSize(
      'activity',
      'Điều phối nhân viên hiện trường gần nhất qua bộ đàm đến điểm nghi vấn và cập nhật kết quả xác minh',
    );

    expect(size?.width).toBeLessThanOrEqual(320);
    expect(size?.height).toBeGreaterThan(44);
  });
});
