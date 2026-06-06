import { describe, expect, it } from 'vitest';

import { getLogicFlowOptions } from './lf-config';

describe('LogicFlow interaction config', () => {
  it('uses node labels as part of the shape drag surface', () => {
    const container = document.createElement('div');
    const options = getLogicFlowOptions(container);

    expect(options.nodeTextDraggable).toBe(false);
    expect(options.edgeTextDraggable).toBe(true);
  });
});
