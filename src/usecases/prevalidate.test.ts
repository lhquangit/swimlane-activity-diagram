import { describe, expect, it } from 'vitest';

import {
  USECASE_CANONICAL_NORMALIZATION_FIELDS,
  USECASE_INPUT_CONSUMER_MAP,
  USECASE_LOCAL_REQUIRED_FIELDS,
  buildUseCaseDraftFingerprint,
  buildUseCaseGenerationRequest,
  buildUseCaseRequestFingerprint,
  runLocalUseCasePreValidation,
} from './prevalidate';
import type { FeatureIntent, ProjectSpec, UseCaseDraft } from './types';

const baseProjectSpec: ProjectSpec = {
  project_name: '  Smart Diagram  ',
  project_summary: ' Nen tang   quan ly cu dan va dich vu noi khu. ',
  business_context: ' Ban quan ly can xu ly yeu cau GPS cho thu nuoi. ',
  target_users: [' Ban quan ly ', 'Cu dan', 'Cu dan'],
  business_rules: [' Rule A ', 'Rule A', ' Rule B '],
  glossary: [' GPS Device ', 'Portal'],
};

const baseFeatureIntent: FeatureIntent = {
  feature_name: '  Cap phat GPS Device ',
  function_name: ' gps-device-issue ',
  feature_summary: ' Xu ly yeu cau cap phat va lap dat GPS cho thu nuoi. ',
  primary_actor: ' Ban quan ly ',
  trigger: ' Co yeu cau dang ky GPS hop le tu cu dan. ',
  inputs: [' Yeu cau GPS ', 'Yeu cau GPS'],
  outputs: [' Trang thai yeu cau '],
  constraints: [' Thiet bi phai o trang thai Trong kho truoc khi giu cho. '],
  assumptions: [' Portal la he thong thao tac chinh cua BQL. '],
  systems_involved: [' Portal ', 'Portal'],
  success_outcome: ' Yeu cau GPS duoc cap phat thanh cong. ',
};

describe('use case prevalidation helpers', () => {
  it('exposes the shared validation contract boundaries', () => {
    expect(USECASE_LOCAL_REQUIRED_FIELDS).toEqual([
      'project_spec.project_name',
      'project_spec.project_summary',
      'feature_intent.feature_name',
      'feature_intent.feature_summary',
      'actors',
    ]);
    expect(USECASE_INPUT_CONSUMER_MAP.actors).toContain('lanes');
    expect(USECASE_CANONICAL_NORMALIZATION_FIELDS.projectSpecListFields).toEqual([
      'target_users',
      'business_rules',
      'glossary',
    ]);
    expect(USECASE_CANONICAL_NORMALIZATION_FIELDS.featureIntentListFields).toEqual([
      'inputs',
      'outputs',
      'constraints',
      'assumptions',
      'systems_involved',
    ]);
  });

  it('normalizes strings and lists before request building', () => {
    const request = buildUseCaseGenerationRequest(baseProjectSpec, baseFeatureIntent);

    expect(request.project_spec.project_name).toBe('Smart Diagram');
    expect(request.project_spec.project_summary).toContain(
      'Ban quan ly can xu ly yeu cau GPS cho thu nuoi.',
    );
    expect(request.project_spec.target_users).toEqual(['Ban quan ly', 'Cu dan', 'Portal']);
    expect(request.project_spec.business_rules).toEqual([]);
    expect(request.project_spec.glossary).toEqual([]);
    expect(request.feature_intent.feature_name).toBe('Cap phat GPS Device');
    expect(request.feature_intent.function_name).toBeNull();
    expect(request.feature_intent.inputs).toEqual(['Yeu cau GPS']);
    expect(request.feature_intent.constraints).toEqual([
      'Rule A',
      'Rule B',
      'Thiet bi phai o trang thai Trong kho truoc khi giu cho.',
    ]);
    expect(request.feature_intent.assumptions).toEqual([]);
    expect(request.feature_intent.systems_involved).toEqual([]);
  });

  it('reports required-field issues locally', () => {
    const errors = runLocalUseCasePreValidation(
      {
        ...baseProjectSpec,
        project_name: '   ',
        target_users: [],
      },
      {
        ...baseFeatureIntent,
        feature_summary: '   ',
        primary_actor: '   ',
        systems_involved: [],
      },
    );

    expect(errors).toContain('Project name là bắt buộc.');
    expect(errors).toContain('Mô tả chức năng là bắt buộc.');
    expect(errors).toContain('Actors / swimlanes là bắt buộc.');
  });

  it('builds stable fingerprint from normalized request', () => {
    const first = buildUseCaseRequestFingerprint(baseProjectSpec, baseFeatureIntent);
    const second = buildUseCaseRequestFingerprint(
      {
        ...baseProjectSpec,
        project_name: 'Smart Diagram',
      },
      {
        ...baseFeatureIntent,
        feature_name: 'Cap phat GPS Device',
      },
    );

    expect(first).toBe(second);
  });

  it('builds stable fingerprint for generated use case drafts', () => {
    const first: UseCaseDraft[] = [
      {
        use_case_id: 'UC-01',
        title: 'Title',
        objective: 'Objective',
        primary_actor: 'Actor',
        supporting_actors: ['Support'],
        preconditions: ['P1'],
        happy_path_summary: ['H1'],
        key_exceptions: ['E1'],
        main_flow_steps: [],
        alternate_flows: [],
        success_outcome: 'Done',
        review_status: 'draft',
      },
    ];
    const second: UseCaseDraft[] = [
      {
        ...first[0],
      },
    ];

    expect(buildUseCaseDraftFingerprint(first)).toBe(buildUseCaseDraftFingerprint(second));
  });
});
