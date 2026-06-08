export type WarningSeverity = 'info' | 'warning' | 'blocking';

export type WarningItem = {
  code: string;
  severity: WarningSeverity;
  message: string;
  related_node_ids: string[];
};

export type ErrorObject = {
  code: string;
  message: string;
  retryable: boolean;
  related_node_ids: string[];
};

export type ResponseMetadata = {
  capability?: string | null;
  provider?: string | null;
  model?: string | null;
  generation_source?: 'ai' | 'deterministic_fallback' | null;
  generation_mode?: string | null;
  fallback_reason?: string | null;
  prompt_id?: string | null;
  prompt_version?: string | null;
  prompt_fingerprint?: string | null;
  quality_status?: string | null;
  quality_score?: number | null;
  shadow_status?: string | null;
  attempt_count?: number | null;
  latency_ms?: number | null;
  estimated_cost_usd?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  cached?: boolean | null;
  first_request_at?: string | null;
};

export type ValidationResult = {
  normalized_summary: {
    lane_count: number;
    node_count: number;
    edge_count: number;
  };
};

export type BrdSpec = {
  metadata: {
    diagram_name: string;
    source_language: 'vi';
    generated_language: 'vi';
    generated_at: string;
    generator_model: string;
    generator_version: string;
  };
  summary: string;
  actors: Array<{
    lane_id: string;
    actor_name: string;
    responsibilities: string[];
  }>;
  main_flow_steps: Array<{
    step_id: string;
    node_id: string;
    actor_lane_id?: string | null;
    actor_name?: string | null;
    step_title?: string | null;
    step_purpose?: string | null;
    business_action?: string | null;
    expected_result?: string | null;
    input_or_trigger?: string | null;
    description: string;
  }>;
  branches: Array<{
    decision_node_id: string;
    decision_text: string;
    decision_actor_name?: string | null;
    outcomes: Array<{
      label?: string | null;
      target_node_id: string;
      target_node_text?: string | null;
      status: 'labeled' | 'unlabeled';
      path_summary: string[];
      rejoin_node_id?: string | null;
      rejoin_node_text?: string | null;
      continues_main_flow: boolean;
    }>;
  }>;
  parallel_blocks: Array<{
    fork_node_id: string;
    join_node_id?: string | null;
    lane_ids: string[];
    role?: 'fork' | 'join' | 'fork_join' | 'sync' | null;
    actor_names: string[];
    branch_summaries: string[];
    join_summary?: string | null;
    description: string;
  }>;
  handoffs: Array<{
    from_actor: string;
    to_actor: string;
    source_node_id: string;
    target_node_id: string;
    source_step_text?: string | null;
    target_step_text?: string | null;
    reason?: string | null;
  }>;
  loops: Array<{
    node_ids: string[];
    note: string;
  }>;
  annotations: string[];
  context_notes: string[];
  assumptions: string[];
  open_questions: string[];
  warnings: WarningItem[];
};

export type GenerateResult = {
  spec: BrdSpec;
  brd_markdown: string;
  draft_status: string;
  review_status: string;
};

export type ResponseEnvelope<T> = {
  request_id: string;
  status: string;
  schema_version: string;
  warnings: WarningItem[];
  blocking_issues: WarningItem[];
  result: T;
  error: ErrorObject | null;
  metadata: ResponseMetadata;
  idempotency_key?: string | null;
};

export type LaneSemanticInput = {
  id: string;
  title: string;
  order: number;
};

export type NodeSemanticInput = {
  id: string;
  type: 'start' | 'activity' | 'decision' | 'sync-bar' | 'end' | 'note';
  lane_id?: string;
  text?: string;
  x: number;
  y: number;
  metadata?: Record<string, unknown>;
};

export type EdgeSemanticInput = {
  id: string;
  source_node_id: string;
  target_node_id: string;
  label?: string;
};

export type DiagramSemanticRequest = {
  diagram_id?: string;
  diagram_name: string;
  language: 'vi';
  lanes: LaneSemanticInput[];
  nodes: NodeSemanticInput[];
  edges: EdgeSemanticInput[];
};

export type GenerateBrdRequest = DiagramSemanticRequest & {
  template: 'default' | 'full';
};

export type BrdTabId = 'warnings' | 'spec' | 'draft';
export type BrdPanelPhase =
  | 'idle'
  | 'validating'
  | 'blocking'
  | 'generating'
  | 'ready'
  | 'failed'
  | 'in-progress';

export type BrdWorkspaceCacheEntry = {
  version: 'v1';
  dirty?: boolean;
  draft: string;
  spec: BrdSpec | null;
  warnings: WarningItem[];
  blockingIssues: WarningItem[];
  metadata: ResponseMetadata | null;
  requestId: string | null;
  runtimeStatus: string | null;
  phase: BrdPanelPhase;
  activeTab: BrdTabId;
  error: ErrorObject | null;
  lastGenerateFingerprint: string | null;
  lastGeneratedRevision: number | null;
  idempotencyKey: string | null;
  updatedAt: string;
};
