export type ActiveArtifact =
  | { kind: 'spec' }
  | { kind: 'feature'; featureId: string }
  | { kind: 'use-cases'; featureId: string }
  | { kind: 'use-case'; featureId: string; useCaseId: string }
  | { kind: 'diagram'; featureId: string; useCaseId: string }
  | { kind: 'brd'; featureId: string; useCaseId: string };

export function artifactPath(projectId: string, artifact: ActiveArtifact): string {
  const root = `/projects/${projectId}`;
  switch (artifact.kind) {
    case 'spec':
      return `${root}/spec`;
    case 'feature':
      return `${root}/features/${artifact.featureId}`;
    case 'use-cases':
      return `${root}/features/${artifact.featureId}/use-cases`;
    case 'use-case':
      return `${root}/features/${artifact.featureId}/use-cases/${artifact.useCaseId}`;
    case 'diagram':
      return `${root}/features/${artifact.featureId}/use-cases/${artifact.useCaseId}/diagram`;
    case 'brd':
      return `${root}/features/${artifact.featureId}/use-cases/${artifact.useCaseId}/diagram/brd`;
  }
}

export function sameArtifact(left: ActiveArtifact, right: ActiveArtifact): boolean {
  return artifactPath('_', left) === artifactPath('_', right);
}
