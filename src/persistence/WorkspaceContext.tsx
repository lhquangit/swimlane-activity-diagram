import { createContext, useContext } from 'react';

import type { BrdSpec, WarningItem } from '../brd/types';
import type { BrdWorkspaceCacheScope } from '../brd/cache';
import type { GenerateResult, ResponseEnvelope } from '../brd/types';
import type { LaneConfig } from '../lane-config';
import type {
  FeatureIntent,
  ProjectSpec,
  UseCaseDraft,
  UseCaseGenerationPreference,
} from '../usecases/types';
import type {
  BrdResource,
  DiagramResource,
  FeatureIntentResource,
  ProjectResource,
  SaveState,
  SpecResource,
  UseCaseResource,
  WorkspaceDiagramGenerationResponse,
  WorkspaceGenerationResponse,
} from './types';
import type { SaveScopeEntry } from './save-state';

export type WorkspacePersistence = {
  project: ProjectResource;
  spec: SpecResource;
  activeFeature: FeatureIntentResource;
  projectSpec: ProjectSpec;
  featureIntent: FeatureIntent;
  openProjectSpecEditor: () => void;
  openFeatureIntentEditor: () => void;
  useCaseResources: UseCaseResource[];
  useCaseSaveState: SaveState;
  diagramSaveState: SaveState;
  brdSaveState: SaveState;
  dirtyScopes: SaveScopeEntry[];
  canSwitchDiagramScope: (nextBusinessKey: string) => boolean;
  markUseCasesDirty: () => void;
  markDiagramDirty: (businessKey?: string | null) => void;
  markBrdDirty: (diagramId?: string | null) => void;
  markBrdLoaded: (diagramId: string) => void;
  generateUseCases: (
    preference: UseCaseGenerationPreference,
  ) => Promise<WorkspaceGenerationResponse>;
  saveUseCases: (drafts: UseCaseDraft[]) => Promise<UseCaseResource[]>;
  generateDiagram: (businessKey: string) => Promise<WorkspaceDiagramGenerationResponse>;
  loadDiagram: (businessKey: string) => Promise<DiagramResource | null>;
  saveDiagram: (
    businessKey: string,
    graphData: Record<string, unknown>,
    lanes: LaneConfig[],
    laneHeight: number,
    semanticEdited: boolean,
  ) => Promise<DiagramResource>;
  activeDiagram: DiagramResource | null;
  setActiveDiagram: (diagram: DiagramResource | null) => void;
  brdCacheScope: BrdWorkspaceCacheScope | null;
  deleteUseCase: (businessKey: string) => Promise<void>;
  loadBrd: (diagramId: string) => Promise<BrdResource | null>;
  generateBrd: (
    diagramId: string,
    idempotencyKey: string,
    template: 'default' | 'full',
  ) => Promise<ResponseEnvelope<GenerateResult>>;
  saveBrd: (
    diagramId: string,
    payload: {
      title: string;
      structured_spec: BrdSpec;
      markdown_content: string;
      warnings: WarningItem[];
      template: 'default' | 'full';
    },
  ) => Promise<BrdResource>;
};

const WorkspaceContext = createContext<WorkspacePersistence | null>(null);

export const WorkspacePersistenceProvider = WorkspaceContext.Provider;

export function useWorkspacePersistence() {
  return useContext(WorkspaceContext);
}
