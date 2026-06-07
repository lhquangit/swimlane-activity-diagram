import type { BrdSpec, ResponseEnvelope, WarningItem } from '../brd/types';
import type {
  DiagramGenerationResult,
  FeatureIntent,
  ProjectSpec,
  UseCaseDraft,
  UseCaseGenerationResult,
} from '../usecases/types';

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed';

export type ProjectResource = {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
};

export type SpecResource = {
  id: string;
  project_id: string;
  project_summary: string;
  business_context?: string | null;
  target_users: string[];
  business_rules: string[];
  glossary: string[];
  created_at: string;
  updated_at: string;
};

export type FeatureIntentResource = {
  id: string;
  spec_id: string;
  name: string;
  feature_summary: string;
  actors: string[];
  trigger?: string | null;
  inputs: string[];
  outputs: string[];
  constraints: string[];
  assumptions: string[];
  systems_involved: string[];
  success_outcome?: string | null;
  created_at: string;
  updated_at: string;
};

export type UseCaseResource = {
  id: string;
  feature_intent_id: string;
  use_case_key: string;
  title: string;
  content: UseCaseDraft;
  review_status: UseCaseDraft['review_status'];
  created_at: string;
  updated_at: string;
};

export type DiagramSavePayload = {
  title: string;
  graph_data: Record<string, unknown>;
  lanes_data: Array<Record<string, unknown>>;
  lane_height: number;
  semantic_edited: boolean;
};

export type DiagramResource = DiagramSavePayload & {
  id: string;
  use_case_id: string;
  source_use_case_updated_at: string;
  created_at: string;
  updated_at: string;
  is_outdated: boolean;
};

export type BrdSavePayload = {
  title: string;
  structured_spec: BrdSpec;
  markdown_content: string;
  warnings: WarningItem[];
  template: 'default' | 'full';
};

export type BrdResource = BrdSavePayload & {
  id: string;
  diagram_id: string;
  source_diagram_updated_at: string;
  created_at: string;
  updated_at: string;
  is_outdated: boolean;
};

export type WorkspaceGenerationResponse = ResponseEnvelope<UseCaseGenerationResult>;
export type WorkspaceDiagramGenerationResponse = ResponseEnvelope<DiagramGenerationResult>;

export function projectSpecFromResources(
  project: ProjectResource,
  spec: SpecResource,
): ProjectSpec {
  return {
    project_name: project.name,
    project_summary: spec.project_summary || project.description || project.name,
    business_context: spec.business_context,
    target_users: spec.target_users,
    business_rules: spec.business_rules,
    glossary: spec.glossary,
  };
}

export function featureIntentFromResource(feature: FeatureIntentResource): FeatureIntent {
  return {
    feature_name: feature.name,
    feature_summary: feature.feature_summary,
    actors: feature.actors,
    primary_actor: feature.actors[0] ?? null,
    trigger: feature.trigger,
    inputs: feature.inputs,
    outputs: feature.outputs,
    constraints: feature.constraints,
    assumptions: feature.assumptions,
    systems_involved: feature.systems_involved,
    success_outcome: feature.success_outcome,
  };
}
