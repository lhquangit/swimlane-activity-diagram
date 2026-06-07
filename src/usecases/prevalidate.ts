import type {
  FeatureIntent,
  ProjectSpec,
  UseCaseDraft,
  UseCaseGenerationPreference,
  UseCaseGenerationRequest,
} from './types';
import { canonicalizeUseCaseDraft } from './editor';

export const USECASE_LOCAL_REQUIRED_FIELDS = [
  'project_spec.project_name',
  'project_spec.project_summary',
  'feature_intent.feature_name',
  'feature_intent.feature_summary',
  'actors',
] as const;

export const USECASE_INPUT_CONSUMER_MAP = {
  project_context: ['use_case_id', 'preconditions', 'segmentation'],
  actors: ['actor_refs', 'lanes', 'handoffs', 'coordination'],
  trigger: ['intake_segmentation', 'preconditions', 'first_step_trace'],
  inputs: ['intake_segmentation', 'preconditions'],
  outputs: ['workflow_steps', 'coordination', 'success_outcome'],
  constraints: ['preconditions', 'exceptions', 'exception_segmentation'],
  success_outcome: ['success_outcome', 'last_step_expected_result'],
} as const;

export const USECASE_CANONICAL_NORMALIZATION_FIELDS = {
  projectSpecTextFields: ['project_name', 'project_summary', 'business_context'] as const,
  projectSpecListFields: ['target_users', 'business_rules', 'glossary'] as const,
  featureIntentTextFields: [
    'feature_name',
    'function_name',
    'feature_summary',
    'primary_actor',
    'trigger',
    'success_outcome',
  ] as const,
  featureIntentListFields: [
    'inputs',
    'outputs',
    'constraints',
    'assumptions',
    'systems_involved',
  ] as const,
} as const;

export function buildUseCaseGenerationRequest(
  projectSpec: ProjectSpec,
  featureIntent: FeatureIntent,
  generationPreference: UseCaseGenerationPreference = 'auto',
): UseCaseGenerationRequest {
  const canonicalInputs = canonicalizeUseCaseInputs(projectSpec, featureIntent);
  return {
    project_spec: normalizeProjectSpec(canonicalInputs.projectSpec),
    feature_intent: normalizeFeatureIntent(canonicalInputs.featureIntent),
    language: 'vi',
    generation_preference: generationPreference,
  };
}

export function buildUseCaseRequestFingerprint(
  projectSpec: ProjectSpec,
  featureIntent: FeatureIntent,
  generationPreference: UseCaseGenerationPreference = 'auto',
) {
  return JSON.stringify(
    buildUseCaseGenerationRequest(projectSpec, featureIntent, generationPreference),
  );
}

export function buildUseCaseDraftFingerprint(useCases: UseCaseDraft[]) {
  return JSON.stringify(useCases.map(canonicalizeUseCaseDraft));
}

export function runLocalUseCasePreValidation(
  projectSpec: ProjectSpec,
  featureIntent: FeatureIntent,
): string[] {
  const issues: string[] = [];
  if (!normalizeText(projectSpec.project_name)) {
    issues.push('Project name là bắt buộc.');
  }
  if (!normalizeText(projectSpec.project_summary)) {
    issues.push('Project summary là bắt buộc.');
  }
  if (!normalizeText(featureIntent.feature_name)) {
    issues.push('Feature name là bắt buộc.');
  }
  if (!normalizeText(featureIntent.feature_summary)) {
    issues.push('Mô tả chức năng là bắt buộc.');
  }
  if (collectUseCaseActors(projectSpec, featureIntent).length === 0) {
    issues.push('Actors / swimlanes là bắt buộc.');
  }
  return issues;
}

export function collectUseCaseActors(projectSpec: ProjectSpec, featureIntent: FeatureIntent) {
  return normalizeTextList([
    ...(featureIntent.actors ?? []),
    featureIntent.primary_actor ?? '',
    ...projectSpec.target_users,
    ...featureIntent.systems_involved,
  ]);
}

export function canonicalizeUseCaseInputs(
  projectSpec: ProjectSpec,
  featureIntent: FeatureIntent,
) {
  const projectDescription = joinDistinctText([
    projectSpec.project_summary,
    projectSpec.business_context,
  ]);
  const actors = collectUseCaseActors(projectSpec, featureIntent);
  const constraints = normalizeTextList([
    ...projectSpec.business_rules,
    ...featureIntent.constraints,
  ]);
  return {
    projectSpec: {
      ...projectSpec,
      project_summary: projectDescription,
      business_context: null,
      target_users: actors,
      business_rules: [],
      glossary: [],
    },
    featureIntent: {
      ...featureIntent,
      function_name: null,
      primary_actor: actors[0] ?? null,
      constraints,
      assumptions: [],
      systems_involved: [],
    },
  };
}

export function normalizeProjectSpec(projectSpec: ProjectSpec): ProjectSpec {
  return {
    project_name: normalizeText(projectSpec.project_name),
    project_summary: normalizeText(projectSpec.project_summary),
    business_context: normalizeOptionalText(projectSpec.business_context),
    target_users: normalizeTextList(projectSpec.target_users),
    business_rules: normalizeTextList(projectSpec.business_rules),
    glossary: normalizeTextList(projectSpec.glossary),
  };
}

export function normalizeFeatureIntent(featureIntent: FeatureIntent): FeatureIntent {
  const actors = normalizeTextList([
    ...(featureIntent.actors ?? []),
    featureIntent.primary_actor ?? '',
  ]);
  return {
    feature_name: normalizeText(featureIntent.feature_name),
    function_name: normalizeOptionalText(featureIntent.function_name),
    feature_summary: normalizeText(featureIntent.feature_summary),
    actors,
    primary_actor: actors[0] ?? null,
    trigger: normalizeOptionalText(featureIntent.trigger),
    inputs: normalizeTextList(featureIntent.inputs),
    outputs: normalizeTextList(featureIntent.outputs),
    constraints: normalizeTextList(featureIntent.constraints),
    assumptions: normalizeTextList(featureIntent.assumptions),
    systems_involved: normalizeTextList(featureIntent.systems_involved),
    success_outcome: normalizeOptionalText(featureIntent.success_outcome),
  };
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeTextList(values: string[]) {
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || result.includes(normalized)) {
      continue;
    }
    result.push(normalized);
  }
  return result;
}

function joinDistinctText(values: Array<string | null | undefined>) {
  const normalized = values.map(normalizeText).filter(Boolean);
  return [...new Set(normalized)].join(' ');
}
