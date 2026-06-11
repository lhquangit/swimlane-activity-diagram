import type { ErrorObject, ResponseEnvelope, ResponseMetadata } from '../brd/types';

export type ArtifactType =
  | 'project_spec'
  | 'feature_intent'
  | 'use_case_draft'
  | 'diagram_draft'
  | 'formal_brd_draft';

export type ArtifactChainItem = {
  artifact_type: ArtifactType;
  label: string;
  source_of_truth: boolean;
  human_editable: boolean;
  generated_from: ArtifactType[];
  notes?: string | null;
};

export type ProjectSpec = {
  project_name: string;
  project_summary: string;
  business_context?: string | null;
  target_users: string[];
  business_rules: string[];
  glossary: string[];
};

export type FeatureIntent = {
  feature_name: string;
  function_name?: string | null;
  feature_summary: string;
  actors?: string[];
  primary_actor?: string | null;
  trigger?: string | null;
  inputs: string[];
  outputs: string[];
  constraints: string[];
  assumptions: string[];
  systems_involved: string[];
  success_outcome?: string | null;
};

export type UseCaseDraft = {
  use_case_id: string;
  title: string;
  objective: string;
  primary_actor: string;
  supporting_actors: string[];
  preconditions: string[];
  happy_path_summary: string[];
  key_exceptions: string[];
  main_flow_steps: UseCaseFlowStep[];
  alternate_flows: UseCaseAlternateFlow[];
  success_outcome: string;
  review_status: 'draft' | 'reviewed' | 'approved';
};

export type UseCaseFlowStep = {
  step_id: string;
  actor_ref: string;
  action: string;
  input_or_trigger?: string | null;
  expected_result: string;
};

export type UseCaseAlternateFlow = {
  flow_id: string;
  source_step_id: string;
  condition: string;
  steps: UseCaseFlowStep[];
  rejoin_step_id?: string | null;
  terminal_outcome?: string | null;
};

export type UseCaseWorkspaceSection = 'input' | 'usecases' | 'diagrams';

export type UseCaseDiagramArtifactState =
  | 'not_started'
  | 'ready'
  | 'outdated'
  | 'diverged'
  | 'generating'
  | 'failed';

export type UseCaseDiagramStatus =
  | 'needs_review'
  | 'ready_to_generate'
  | 'ready_to_open'
  | 'active_on_canvas'
  | Exclude<UseCaseDiagramArtifactState, 'not_started' | 'ready'>;

export type UseCaseDiagramInventoryItem = {
  use_case_id: string;
  title: string;
  review_status: UseCaseDraft['review_status'];
  // Label, note, styling, and action permission must all derive from this lifecycle status.
  diagram_status: UseCaseDiagramStatus;
  note: string;
  can_open_canvas: boolean;
  is_focused: boolean;
  is_active_on_canvas: boolean;
  operation_state?: 'generating' | 'opening' | 'failed';
};

export type OrphanedDiagramInventoryItem = {
  use_case_id: string;
  title: string;
  semantic_edited: boolean;
};

export type UseCaseGenerationRequest = {
  project_spec: ProjectSpec;
  feature_intent: FeatureIntent;
  language: 'vi';
  generation_preference: UseCaseGenerationPreference;
};

export type UseCaseGenerationPreference = 'ai';

export type UseCaseGenerationResult = {
  generation_source: 'ai';
  artifact_chain: ArtifactChainItem[];
  project_spec: ProjectSpec;
  feature_intent: FeatureIntent;
  use_cases: UseCaseDraft[];
};

export type UseCaseGenerationResponse = ResponseEnvelope<UseCaseGenerationResult>;

export type DiagramTrace = {
  use_case_id: string;
  source_kind:
    | 'use_case'
    | 'main_step'
    | 'alternate_flow'
    | 'precondition'
    | 'success_outcome'
    | 'terminal_outcome';
  source_id: string;
};

export type DiagramLaneDraft = {
  id: string;
  title: string;
  order: number;
  width: number;
};

export type DiagramNodeDraft = {
  id: string;
  type: 'start' | 'end' | 'activity' | 'decision' | 'note';
  lane_id?: string | null;
  text: string;
  x: number;
  y: number;
  properties: Record<string, unknown>;
  trace: DiagramTrace;
};

export type DiagramEdgeDraft = {
  id: string;
  source_node_id: string;
  target_node_id: string;
  label?: string | null;
  trace: DiagramTrace;
};

export type DiagramDraft = {
  diagram_id: string;
  use_case_id: string;
  title: string;
  lanes: DiagramLaneDraft[];
  nodes: DiagramNodeDraft[];
  edges: DiagramEdgeDraft[];
  generation_status: 'ready';
};

export type DiagramGenerationResult = {
  diagram: DiagramDraft;
};

export type UseCasePanelPhase = 'idle' | 'generating' | 'ready' | 'failed';

export type UseCasePanelState = {
  phase: UseCasePanelPhase;
  artifactChain: ArtifactChainItem[];
  useCases: UseCaseDraft[];
  requestId: string | null;
  metadata: ResponseMetadata | null;
  error: ErrorObject | null;
};
