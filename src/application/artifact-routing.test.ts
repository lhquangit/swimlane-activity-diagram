import { describe, expect, it } from 'vitest';

import { artifactPath } from './artifact-routing';

describe('artifactPath', () => {
  it('builds stable nested paths for every persisted artifact kind', () => {
    expect(artifactPath('project-1', { kind: 'spec' })).toBe('/projects/project-1/spec');
    expect(
      artifactPath('project-1', { kind: 'feature', featureId: 'feature-1' }),
    ).toBe('/projects/project-1/features/feature-1');
    expect(
      artifactPath('project-1', { kind: 'use-cases', featureId: 'feature-1' }),
    ).toBe('/projects/project-1/features/feature-1/use-cases');
    expect(
      artifactPath('project-1', {
        kind: 'use-case',
        featureId: 'feature-1',
        useCaseId: 'usecase-1',
      }),
    ).toBe('/projects/project-1/features/feature-1/use-cases/usecase-1');
    expect(
      artifactPath('project-1', {
        kind: 'diagram',
        featureId: 'feature-1',
        useCaseId: 'usecase-1',
      }),
    ).toBe('/projects/project-1/features/feature-1/use-cases/usecase-1/diagram');
    expect(
      artifactPath('project-1', {
        kind: 'brd',
        featureId: 'feature-1',
        useCaseId: 'usecase-1',
      }),
    ).toBe('/projects/project-1/features/feature-1/use-cases/usecase-1/diagram/brd');
  });
});
