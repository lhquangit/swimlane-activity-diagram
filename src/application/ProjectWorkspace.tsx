import { UserButton, useUser } from '@clerk/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import App from '../App';
import type { ResponseMetadata } from '../brd/types';
import { featurePayload, usePersistenceApi } from '../persistence/api';
import {
  clearFeatureScopes,
  clearScopesByPredicate,
  confirmDirtyScopeSwitch,
  dirtyScopes,
  formatDirtyScopes,
  getScopeState,
  isAnyDirty,
  makeBrdScope,
  makeDiagramScope,
  makeUseCaseScope,
  makeUseCasesScope,
  setScopeState,
  type SaveScope,
  type SaveScopeEntry,
  type SaveStateRegistry,
} from '../persistence/save-state';
import { WorkspacePersistenceProvider, type WorkspacePersistence } from '../persistence/WorkspaceContext';
import {
  featureIntentFromResource,
  projectSpecFromResources,
  type BrdResource,
  type DiagramResource,
  type FeatureIntentResource,
  type ProjectArtifactTree,
  type SaveState,
  type UseCaseResource,
} from '../persistence/types';
import type { FeatureIntent, ProjectSpec, UseCaseDraft } from '../usecases/types';
import PersistedUseCaseWorkspace from '../usecases/PersistedUseCaseWorkspace';
import ArtifactTree from './ArtifactTree';
import { artifactPath, sameArtifact, type ActiveArtifact } from './artifact-routing';

export type WorkspaceRouteKind =
  | 'root'
  | 'spec'
  | 'feature'
  | 'use-cases'
  | 'use-case'
  | 'diagram'
  | 'brd';

const emptyFeature = (): FeatureIntent => ({
  feature_name: '',
  feature_summary: '',
  actors: [],
  primary_actor: null,
  trigger: null,
  inputs: [],
  outputs: [],
  constraints: [],
  assumptions: [],
  systems_involved: [],
  success_outcome: null,
});

export default function ProjectWorkspace({
  routeKind = 'root',
}: {
  routeKind?: WorkspaceRouteKind;
}) {
  const { projectId = '', featureId, useCaseId } = useParams();
  const api = usePersistenceApi();
  const navigate = useNavigate();
  const { user } = useUser();
  const [tree, setTree] = useState<ProjectArtifactTree | null>(null);
  const [featureResources, setFeatureResources] = useState<FeatureIntentResource[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [useCaseResources, setUseCaseResources] = useState<UseCaseResource[]>([]);
  const [activeDiagram, setActiveDiagram] = useState<DiagramResource | null>(null);
  const [projectDraft, setProjectDraft] = useState({ name: '', description: '' });
  const [specDraft, setSpecDraft] = useState<ProjectSpec | null>(null);
  const [featureDraft, setFeatureDraft] = useState<FeatureIntent>(emptyFeature);
  const [featureDraftId, setFeatureDraftId] = useState<string | null>(null);
  const [creatingFeature, setCreatingFeature] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [projectSaveState, setProjectSaveState] = useState<SaveState>('idle');
  const [specSaveState, setSpecSaveState] = useState<SaveState>('idle');
  const [featureSaveState, setFeatureSaveState] = useState<SaveState>('idle');
  const [saveStateRegistry, setSaveStateRegistry] = useState<SaveStateRegistry>({});
  const [activeDiagramBusinessKey, setActiveDiagramBusinessKey] = useState<string | null>(null);
  const [pendingUseCaseGenerationByFeature, setPendingUseCaseGenerationByFeature] = useState<
    Record<string, { metadata: ResponseMetadata; requestId: string | null }>
  >({});

  const refreshArtifactTree = useCallback(async () => {
    const nextTree = await api.getProjectArtifactTree(projectId);
    setTree(nextTree);
    setProjectDraft({
      name: nextTree.project.name,
      description: nextTree.project.description ?? '',
    });
    setSpecDraft(projectSpecFromResources(nextTree.project, nextTree.spec));
  }, [api, projectId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFeaturesLoading(true);
    setError(null);
    api
      .getProjectArtifactTree(projectId)
      .then((nextTree) => {
        if (!active) return;
        setTree(nextTree);
        setProjectDraft({
          name: nextTree.project.name,
          description: nextTree.project.description ?? '',
        });
        setSpecDraft(projectSpecFromResources(nextTree.project, nextTree.spec));
        setLoading(false);
        return api.listFeatures(nextTree.spec.id).then((nextFeatures) => {
          if (active) {
            setFeatureResources(nextFeatures);
            setFeaturesLoading(false);
          }
        });
      })
      .catch((reason) => {
        if (active) {
          setFeaturesLoading(false);
          setError(reason instanceof Error ? reason.message : 'Không tải được project.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, projectId]);

  const activeArtifact = useMemo<ActiveArtifact>(() => {
    if (routeKind === 'feature' && featureId) return { kind: 'feature', featureId };
    if (routeKind === 'use-cases' && featureId) return { kind: 'use-cases', featureId };
    if (routeKind === 'use-case' && featureId && useCaseId) {
      return { kind: 'use-case', featureId, useCaseId };
    }
    if (routeKind === 'diagram' && featureId && useCaseId) {
      return { kind: 'diagram', featureId, useCaseId };
    }
    if (routeKind === 'brd' && featureId && useCaseId) {
      return { kind: 'brd', featureId, useCaseId };
    }
    return { kind: 'spec' };
  }, [featureId, routeKind, useCaseId]);

  useEffect(() => {
    if (!tree || routeKind !== 'root') return;
    navigate(artifactPath(projectId, { kind: 'spec' }), { replace: true });
  }, [navigate, projectId, routeKind, tree]);

  const activeTreeFeature =
    activeArtifact.kind === 'spec'
      ? null
      : tree?.features.find((item) => item.id === activeArtifact.featureId) ?? null;
  const activeTreeUseCase =
    activeArtifact.kind === 'use-case' ||
    activeArtifact.kind === 'diagram' ||
    activeArtifact.kind === 'brd'
      ? activeTreeFeature?.use_cases.find((item) => item.id === activeArtifact.useCaseId) ?? null
      : null;
  const activeFeature =
    activeTreeFeature
      ? featureResources.find((item) => item.id === activeTreeFeature.id) ?? null
      : null;

  useEffect(() => {
    if (!tree || routeKind === 'root') return;
    const invalidFeature = activeArtifact.kind !== 'spec' && !activeTreeFeature;
    const invalidUseCase =
      (activeArtifact.kind === 'use-case' ||
        activeArtifact.kind === 'diagram' ||
        activeArtifact.kind === 'brd') &&
      !activeTreeUseCase;
    if (invalidFeature || invalidUseCase) {
      setRouteError('Artifact không tồn tại trong project này hoặc bạn không có quyền.');
      setActiveDiagram(null);
      setActiveDiagramBusinessKey(null);
      return;
    }
    setRouteError(null);
  }, [activeArtifact, activeTreeFeature, activeTreeUseCase, routeKind, tree]);

  useEffect(() => {
    if (!activeFeature) {
      setUseCaseResources([]);
      if (!creatingFeature) {
        setFeatureDraftId(null);
        setFeatureDraft(emptyFeature());
      }
      return;
    }
    if (featureDraftId !== activeFeature.id || featureSaveState !== 'dirty') {
      setFeatureDraftId(activeFeature.id);
      setFeatureDraft(featureIntentFromResource(activeFeature));
      setFeatureSaveState('idle');
    }
    setCreatingFeature(false);
    let active = true;
    setContentLoading(true);
    api
      .listUseCases(activeFeature.id)
      .then((items) => active && setUseCaseResources(items))
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Không tải được Use Case.');
        }
      })
      .finally(() => active && setContentLoading(false));
    return () => {
      active = false;
    };
  }, [activeFeature?.id, api]);

  const useCasesScope = activeFeature
    ? makeUseCasesScope(activeFeature.id, `Use cases của ${activeFeature.name}`)
    : null;
  const selectedUseCaseScope =
    activeFeature && activeTreeUseCase
      ? makeUseCaseScope(
          activeFeature.id,
          activeTreeUseCase.use_case_key,
          activeTreeUseCase.title || activeTreeUseCase.use_case_key,
        )
      : null;
  const diagramScope =
    activeFeature && activeDiagramBusinessKey
      ? makeDiagramScope(activeFeature.id, activeDiagramBusinessKey)
      : null;
  const brdScope =
    activeDiagram && activeFeature
      ? makeBrdScope(activeDiagram.id, activeFeature.id, `BRD ${activeDiagram.title}`)
      : null;
  const useCaseSaveState = getScopeState(
    saveStateRegistry,
    selectedUseCaseScope ?? useCasesScope,
  );
  const diagramSaveState = getScopeState(saveStateRegistry, diagramScope);
  const brdSaveState = getScopeState(saveStateRegistry, brdScope);
  const allDirtyScopes = dirtyScopes(saveStateRegistry);
  const shellDirty =
    projectSaveState === 'dirty' || specSaveState === 'dirty' || featureSaveState === 'dirty';
  const hasUnsavedChanges = shellDirty || isAnyDirty(saveStateRegistry);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [hasUnsavedChanges]);

  const setScopedSaveState = (scope: SaveScope | null, state: SaveState) => {
    setSaveStateRegistry((current) => setScopeState(current, scope, state));
  };

  const confirmDiscardActiveChanges = (message: string) => {
    const details =
      allDirtyScopes.length > 0
        ? `\n\nArtifact chưa lưu: ${formatDirtyScopes(allDirtyScopes)}`
        : '';
    return !hasUnsavedChanges || window.confirm(`${message}${details}`);
  };

  const resetDiscardedDrafts = () => {
    if (tree) {
      setProjectDraft({
        name: tree.project.name,
        description: tree.project.description ?? '',
      });
      setSpecDraft(projectSpecFromResources(tree.project, tree.spec));
    }
    if (activeFeature) {
      setFeatureDraft(featureIntentFromResource(activeFeature));
      setFeatureDraftId(activeFeature.id);
    }
    setProjectSaveState('idle');
    setSpecSaveState('idle');
    setFeatureSaveState('idle');
    setSaveStateRegistry((current) => clearFeatureScopes(current, activeFeature?.id ?? null));
  };

  const navigateToArtifact = (next: ActiveArtifact): boolean => {
    if (sameArtifact(activeArtifact, next) && !creatingFeature) return true;
    if (!confirmDiscardActiveChanges('Bỏ các thay đổi chưa lưu và chuyển sang artifact khác?')) {
      return false;
    }
    const currentUseCaseContext =
      activeArtifact.kind === 'use-case' ||
      activeArtifact.kind === 'diagram' ||
      activeArtifact.kind === 'brd'
        ? `${activeArtifact.featureId}:${activeArtifact.useCaseId}`
        : null;
    const nextUseCaseContext =
      next.kind === 'use-case' || next.kind === 'diagram' || next.kind === 'brd'
        ? `${next.featureId}:${next.useCaseId}`
        : null;
    const preservesDiagramContext =
      currentUseCaseContext !== null &&
      currentUseCaseContext === nextUseCaseContext &&
      (next.kind === 'diagram' || next.kind === 'brd');
    resetDiscardedDrafts();
    setCreatingFeature(false);
    if (!preservesDiagramContext) {
      setActiveDiagram(null);
      setActiveDiagramBusinessKey(null);
    }
    navigate(artifactPath(projectId, next));
    return true;
  };

  const startNewFeature = () => {
    if (!confirmDiscardActiveChanges('Bỏ các thay đổi chưa lưu và tạo Feature mới?')) return;
    resetDiscardedDrafts();
    setCreatingFeature(true);
    setFeatureDraftId(null);
    setFeatureDraft(emptyFeature());
    setFeatureSaveState('dirty');
  };

  const saveSpec = async () => {
    if (!tree || !specDraft) return;
    setProjectSaveState('saving');
    setSpecSaveState('saving');
    setError(null);
    try {
      const [savedProject, savedSpec] = await Promise.all([
        api.updateProject(tree.project.id, {
          name: projectDraft.name,
          description: projectDraft.description || null,
        }),
        api.updateSpec(tree.project.id, {
          project_summary: specDraft.project_summary,
          business_context: specDraft.business_context,
          target_users: specDraft.target_users,
          business_rules: specDraft.business_rules,
          glossary: specDraft.glossary,
        }),
      ]);
      setTree((current) =>
        current ? { ...current, project: savedProject, spec: savedSpec } : current,
      );
      setSpecDraft(projectSpecFromResources(savedProject, savedSpec));
      setProjectSaveState('saved');
      setSpecSaveState('saved');
    } catch (reason) {
      setProjectSaveState('failed');
      setSpecSaveState('failed');
      setError(reason instanceof Error ? reason.message : 'Không lưu được Project Spec.');
    }
  };

  const saveFeature = async () => {
    if (!tree || !featureDraft.feature_name.trim() || !featureDraft.feature_summary.trim()) return;
    setFeatureSaveState('saving');
    setError(null);
    try {
      const saved = featureDraftId
        ? await api.updateFeature(featureDraftId, featurePayload(featureDraft))
        : await api.createFeature(tree.spec.id, featurePayload(featureDraft));
      setFeatureResources((current) => [
        saved,
        ...current.filter((item) => item.id !== saved.id),
      ]);
      setFeatureDraftId(saved.id);
      setFeatureDraft(featureIntentFromResource(saved));
      setCreatingFeature(false);
      setFeatureSaveState('saved');
      await refreshArtifactTree();
      navigate(artifactPath(projectId, { kind: 'feature', featureId: saved.id }), {
        replace: !featureDraftId,
      });
    } catch (reason) {
      setFeatureSaveState('failed');
      setError(reason instanceof Error ? reason.message : 'Không lưu được Feature Intent.');
    }
  };

  const deleteFeature = async () => {
    if (!activeFeature) return;
    if (!confirmDiscardActiveChanges('Bỏ các thay đổi chưa lưu trước khi xóa Feature?')) return;
    if (!window.confirm(`Xóa feature "${activeFeature.name}" và toàn bộ artifact liên quan?`)) {
      return;
    }
    try {
      await api.deleteFeature(activeFeature.id);
      setSaveStateRegistry((current) => clearFeatureScopes(current, activeFeature.id));
      setFeatureResources((current) => current.filter((item) => item.id !== activeFeature.id));
      setPendingUseCaseGenerationByFeature((current) => {
        if (!(activeFeature.id in current)) return current;
        const next = { ...current };
        delete next[activeFeature.id];
        return next;
      });
      await refreshArtifactTree();
      navigate(artifactPath(projectId, { kind: 'spec' }), { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không xóa được Feature.');
    }
  };

  const contextValue = useMemo<WorkspacePersistence | null>(() => {
    if (!tree || !activeFeature) return null;
    const pendingUseCaseGeneration = pendingUseCaseGenerationByFeature[activeFeature.id] ?? null;
    return {
      project: tree.project,
      spec: tree.spec,
      activeFeature,
      selectedArtifact: activeArtifact,
      navigateToArtifact,
      refreshArtifactTree,
      projectSpec: projectSpecFromResources(tree.project, tree.spec),
      featureIntent: featureIntentFromResource(activeFeature),
      openProjectSpecEditor: () => {
        navigateToArtifact({ kind: 'spec' });
      },
      openFeatureIntentEditor: () => {
        navigateToArtifact({ kind: 'feature', featureId: activeFeature.id });
      },
      useCaseResources,
      useCaseSaveState,
      diagramSaveState,
      brdSaveState,
      dirtyScopes: allDirtyScopes,
      canSwitchDiagramScope: (nextBusinessKey) => {
        if (!activeDiagramBusinessKey || activeDiagramBusinessKey === nextBusinessKey) return true;
        const currentDiagramScope = makeDiagramScope(activeFeature.id, activeDiagramBusinessKey);
        const activeDirtyScopes = [
          getScopeState(saveStateRegistry, currentDiagramScope) === 'dirty'
            ? saveStateRegistry[currentDiagramScope.key]
            : null,
          brdScope && getScopeState(saveStateRegistry, brdScope) === 'dirty'
            ? saveStateRegistry[brdScope.key]
            : null,
        ].filter((scope): scope is SaveScopeEntry => Boolean(scope));
        return confirmDirtyScopeSwitch(
          activeDirtyScopes,
          activeDiagramBusinessKey,
          nextBusinessKey,
          window.confirm,
        );
      },
      markUseCasesDirty: () => setScopedSaveState(useCasesScope, 'dirty'),
      markUseCaseDirty: (businessKey, label) =>
        setScopedSaveState(makeUseCaseScope(activeFeature.id, businessKey, label), 'dirty'),
      markDiagramDirty: (businessKey) => {
        const key = businessKey ?? activeDiagramBusinessKey;
        if (key) setActiveDiagramBusinessKey(key);
        setScopedSaveState(key ? makeDiagramScope(activeFeature.id, key) : null, 'dirty');
      },
      markBrdDirty: (diagramId) =>
        setScopedSaveState(
          diagramId || activeDiagram?.id
            ? makeBrdScope(
                diagramId || activeDiagram!.id,
                activeFeature.id,
                activeDiagram?.title ? `BRD ${activeDiagram.title}` : 'BRD',
              )
            : null,
          'dirty',
        ),
      markBrdLoaded: (diagramId) =>
        setScopedSaveState(
          makeBrdScope(
            diagramId,
            activeFeature.id,
            activeDiagram?.title ? `BRD ${activeDiagram.title}` : 'BRD',
          ),
          'idle',
        ),
      pendingUseCaseGenerationMetadata: pendingUseCaseGeneration?.metadata ?? null,
      pendingUseCaseGenerationRequestId: pendingUseCaseGeneration?.requestId ?? null,
      generateUseCases: async (preference) => {
        const envelope = await api.generateUseCases(activeFeature.id, preference);
        setPendingUseCaseGenerationByFeature((current) =>
          envelope.metadata
            ? {
                ...current,
                [activeFeature.id]: {
                  metadata: envelope.metadata,
                  requestId: envelope.request_id,
                },
              }
            : (() => {
                if (!(activeFeature.id in current)) return current;
                const next = { ...current };
                delete next[activeFeature.id];
                return next;
              })(),
        );
        return envelope;
      },
      saveUseCases: async (drafts: UseCaseDraft[], options) => {
        const targetScopes =
          options?.businessKeys && options.businessKeys.length > 0
            ? options.businessKeys.map((businessKey) =>
                makeUseCaseScope(
                  activeFeature.id,
                  businessKey,
                  options.labelsByBusinessKey?.[businessKey] ?? businessKey,
                ),
              )
            : useCasesScope
              ? [useCasesScope]
              : [];
        setSaveStateRegistry((current) =>
          targetScopes.reduce(
            (next, scope) => setScopeState(next, scope, 'saving'),
            current,
          ),
        );
        try {
          const saved = await api.saveUseCases(
            activeFeature.id,
            useCaseResources,
            drafts,
            options?.generationMetadata,
          );
          setUseCaseResources(saved);
          if (options?.generationMetadata) {
            setFeatureResources((current) =>
              current.map((feature) =>
                feature.id === activeFeature.id
                  ? {
                      ...feature,
                      latest_usecase_generation: options.generationMetadata ?? null,
                    }
                  : feature,
              ),
            );
            setPendingUseCaseGenerationByFeature((current) => {
              if (!(activeFeature.id in current)) return current;
              const next = { ...current };
              delete next[activeFeature.id];
              return next;
            });
          }
          setTree((current) => {
            if (!current) return current;
            return {
              ...current,
              features: current.features.map((feature) => {
                if (feature.id !== activeFeature.id) return feature;
                const previousById = new Map(feature.use_cases.map((item) => [item.id, item]));
                return {
                  ...feature,
                  use_cases: saved.map((item) => ({
                    id: item.id,
                    use_case_key: item.use_case_key,
                    title: item.title,
                    review_status: item.review_status,
                    updated_at: item.updated_at,
                    diagram: previousById.get(item.id)?.diagram ?? null,
                  })),
                };
              }),
            };
          });
          setSaveStateRegistry((current) =>
            targetScopes.reduce(
              (next, scope) => setScopeState(next, scope, 'saved'),
              current,
            ),
          );
          void refreshArtifactTree().catch(() => undefined);
          return saved;
        } catch (reason) {
          setSaveStateRegistry((current) =>
            targetScopes.reduce(
              (next, scope) => setScopeState(next, scope, 'failed'),
              current,
            ),
          );
          throw reason;
        }
      },
      generateDiagram: async (businessKey) => {
        if (
          useCaseSaveState === 'dirty' ||
          useCaseSaveState === 'saving' ||
          useCaseSaveState === 'failed'
        ) {
          throw new Error('Hãy lưu Use Case mới nhất trước khi sinh Diagram.');
        }
        const resource = useCaseResources.find((item) => item.use_case_key === businessKey);
        if (!resource) throw new Error('Hãy lưu Use Case trước khi sinh Diagram.');
        return api.generateDiagram(resource.id);
      },
      loadDiagram: async (businessKey) => {
        const resource = useCaseResources.find((item) => item.use_case_key === businessKey);
        if (!resource) return null;
        const saved = await api.getDiagram(resource.id);
        if (!saved) return null;
        setActiveDiagramBusinessKey(businessKey);
        setActiveDiagram(saved);
        setScopedSaveState(makeDiagramScope(activeFeature.id, businessKey), 'idle');
        return saved;
      },
      saveDiagram: async (businessKey, graphData, lanes, laneHeight, semanticEdited) => {
        const resource = useCaseResources.find((item) => item.use_case_key === businessKey);
        if (!resource) throw new Error('Hãy lưu Use Case trước khi lưu Diagram.');
        const nextDiagramScope = makeDiagramScope(activeFeature.id, businessKey);
        setScopedSaveState(nextDiagramScope, 'saving');
        try {
          const saved = await api.saveDiagram(resource.id, {
            title: resource.title || businessKey,
            graph_data: graphData,
            lanes_data: lanes as unknown as Array<Record<string, unknown>>,
            lane_height: Math.round(laneHeight),
            semantic_edited: semanticEdited,
          });
          setActiveDiagramBusinessKey(businessKey);
          setActiveDiagram(saved);
          setScopedSaveState(nextDiagramScope, 'saved');
          await refreshArtifactTree();
          return saved;
        } catch (reason) {
          setScopedSaveState(nextDiagramScope, 'failed');
          throw reason;
        }
      },
      activeDiagram,
      setActiveDiagram,
      brdCacheScope:
        user?.id && activeDiagram
          ? { userId: user.id, projectId: tree.project.id, diagramId: activeDiagram.id }
          : null,
      deleteUseCase: async (businessKey) => {
        const resource = useCaseResources.find((item) => item.use_case_key === businessKey);
        if (!resource) throw new Error('Không tìm thấy Use Case đã lưu để xóa.');
        await api.deleteUseCase(resource.id);
        setUseCaseResources((current) => current.filter((item) => item.id !== resource.id));
        setSaveStateRegistry((current) =>
          clearScopesByPredicate(
            current,
            (scope) =>
              scope.resourceId === businessKey ||
              scope.key.includes(`:diagram:${businessKey}`) ||
              (activeDiagram?.use_case_id === resource.id &&
                scope.resourceId === activeDiagram.id),
          ),
        );
        if (activeDiagram?.use_case_id === resource.id) {
          setActiveDiagram(null);
          setActiveDiagramBusinessKey(null);
        }
        await refreshArtifactTree();
        navigateToArtifact({ kind: 'use-cases', featureId: activeFeature.id });
      },
      loadBrd: (diagramId) => api.getBrd(diagramId),
      generateBrd: (diagramId, idempotencyKey, template) =>
        api.generateBrd(diagramId, idempotencyKey, template),
      saveBrd: async (diagramId, payload) => {
        const nextBrdScope = makeBrdScope(
          diagramId,
          activeFeature.id,
          activeDiagram?.title ? `BRD ${activeDiagram.title}` : 'BRD',
        );
        setScopedSaveState(nextBrdScope, 'saving');
        try {
          const saved = await api.saveBrd(diagramId, payload);
          setTree((current) => {
            if (!current) return current;
            return {
              ...current,
              features: current.features.map((feature) => ({
                ...feature,
                use_cases: feature.use_cases.map((useCase) =>
                  useCase.diagram?.id === diagramId
                    ? {
                        ...useCase,
                        diagram: {
                          ...useCase.diagram,
                          brd: {
                            id: saved.id,
                            title: saved.title,
                            template: saved.template,
                            is_outdated: saved.is_outdated,
                            updated_at: saved.updated_at,
                          },
                        },
                      }
                    : useCase,
                ),
              })),
            };
          });
          setScopedSaveState(nextBrdScope, 'saved');
          void refreshArtifactTree().catch(() => undefined);
          return saved;
        } catch (reason) {
          setScopedSaveState(nextBrdScope, 'failed');
          throw reason;
        }
      },
    };
  }, [
    activeArtifact,
    activeDiagram,
    activeDiagramBusinessKey,
    activeFeature,
    allDirtyScopes,
    api,
    brdSaveState,
    brdScope,
    diagramSaveState,
    projectId,
    pendingUseCaseGenerationByFeature,
    refreshArtifactTree,
    saveStateRegistry,
    tree,
    useCaseResources,
    useCaseSaveState,
    selectedUseCaseScope,
    useCasesScope,
    user?.id,
  ]);

  if (loading) return <main className="workspace-loading">Đang tải project…</main>;
  if (!tree || !specDraft) {
    return <main className="workspace-loading">{error || 'Không tìm thấy project.'}</main>;
  }

  const leaveWorkspace = () => {
    if (hasUnsavedChanges && !window.confirm('Bạn có thay đổi chưa lưu. Rời project?')) return;
    navigate('/projects');
  };

  const showFeatureEditor = creatingFeature || activeArtifact.kind === 'feature';
  const showUseCaseList = !routeError && activeArtifact.kind === 'use-cases';
  const showUseCaseEditor = !routeError && activeArtifact.kind === 'use-case';
  const showDiagramEditor = !routeError && activeArtifact.kind === 'diagram';
  const showBrdEditor = !routeError && activeArtifact.kind === 'brd';
  const showCanvasEditor = showDiagramEditor || showBrdEditor;
  const showMissingDiagramState =
    showDiagramEditor && activeTreeUseCase != null && !activeTreeUseCase.diagram;
  const artifactContentLoading =
    contentLoading || (activeArtifact.kind !== 'spec' && featuresLoading);

  return (
    <main className="project-workspace">
      <header className="workspace-header compact">
        <div>
          <button className="workspace-back" onClick={leaveWorkspace}>← Projects</button>
          <h1>{tree.project.name}</h1>
          <p>Project Spec → Feature Intent → Use Case → Diagram → BRD</p>
        </div>
        <div className="workspace-header__actions">
          {hasUnsavedChanges ? <span className="save-state dirty">Có thay đổi chưa lưu</span> : null}
          <UserButton />
        </div>
      </header>

      {error ? <p className="workspace-error workspace-error--floating">{error}</p> : null}

      <div className="artifact-workspace-shell">
        <ArtifactTree
          tree={tree}
          active={activeArtifact}
          onSelect={navigateToArtifact}
          onCreateFeature={startNewFeature}
        />

        <section className="artifact-workspace-content">
          {routeError ? (
            <ArtifactState
              title="Không mở được artifact"
              message={routeError}
              actionLabel="Về Project Spec"
              onAction={() => navigateToArtifact({ kind: 'spec' })}
            />
          ) : null}

          {!routeError && activeArtifact.kind === 'spec' && !creatingFeature ? (
            <section className="workspace-form-card">
              <div className="workspace-section-heading">
                <div>
                  <h2>Project Spec</h2>
                  <p>Một project có một Spec và luôn lưu phiên bản mới nhất.</p>
                </div>
                <SaveButton
                  state={aggregateSaveState(projectSaveState, specSaveState)}
                  onClick={() => void saveSpec()}
                />
              </div>
              <TextField label="Tên project" value={projectDraft.name} onChange={(name) => {
                setProjectDraft((current) => ({ ...current, name }));
                setSpecDraft((current) => current ? { ...current, project_name: name } : current);
                setProjectSaveState('dirty');
                setSpecSaveState('dirty');
              }} />
              <TextArea label="Tóm tắt project" value={specDraft.project_summary} onChange={(project_summary) => {
                setSpecDraft({ ...specDraft, project_summary });
                setSpecSaveState('dirty');
              }} />
              <TextArea label="Bối cảnh nghiệp vụ" value={specDraft.business_context ?? ''} onChange={(business_context) => {
                setSpecDraft({ ...specDraft, business_context });
                setSpecSaveState('dirty');
              }} />
              <ListField label="Người dùng mục tiêu" value={specDraft.target_users} onChange={(target_users) => {
                setSpecDraft({ ...specDraft, target_users });
                setSpecSaveState('dirty');
              }} />
              <ListField label="Business rules" value={specDraft.business_rules} onChange={(business_rules) => {
                setSpecDraft({ ...specDraft, business_rules });
                setSpecSaveState('dirty');
              }} />
              <ListField label="Glossary" value={specDraft.glossary} onChange={(glossary) => {
                setSpecDraft({ ...specDraft, glossary });
                setSpecSaveState('dirty');
              }} />
            </section>
          ) : null}

          {!routeError && showFeatureEditor ? (
            <section className="workspace-form-card feature-editor">
              <div className="workspace-section-heading">
                <div>
                  <h2>{featureDraftId ? 'Feature Intent' : 'Feature mới'}</h2>
                  <p>Mỗi Spec có thể có nhiều Feature Intent.</p>
                </div>
                <div className="workspace-header__actions">
                  {featureDraftId ? (
                    <button className="workspace-button danger" onClick={() => void deleteFeature()}>
                      Xóa
                    </button>
                  ) : null}
                  {featureDraftId ? (
                    <button
                      className="workspace-button"
                      onClick={() =>
                        navigateToArtifact({
                          kind: 'use-cases',
                          featureId: featureDraftId,
                        })
                      }
                    >
                      Use Cases
                    </button>
                  ) : null}
                  <SaveButton state={featureSaveState} onClick={() => void saveFeature()} />
                </div>
              </div>
              <TextField label="Tên feature" value={featureDraft.feature_name} onChange={(feature_name) => updateFeatureDraft({ feature_name })} />
              <TextArea label="Mô tả feature" value={featureDraft.feature_summary} onChange={(feature_summary) => updateFeatureDraft({ feature_summary })} />
              <ListField label="Actors" value={featureDraft.actors ?? []} onChange={(actors) => updateFeatureDraft({ actors, primary_actor: actors[0] ?? null })} />
              <TextField label="Trigger" value={featureDraft.trigger ?? ''} onChange={(trigger) => updateFeatureDraft({ trigger })} />
              <ListField label="Inputs" value={featureDraft.inputs} onChange={(inputs) => updateFeatureDraft({ inputs })} />
              <ListField label="Outputs" value={featureDraft.outputs} onChange={(outputs) => updateFeatureDraft({ outputs })} />
              <ListField label="Constraints" value={featureDraft.constraints} onChange={(constraints) => updateFeatureDraft({ constraints })} />
              <ListField label="Assumptions" value={featureDraft.assumptions} onChange={(assumptions) => updateFeatureDraft({ assumptions })} />
              <ListField label="Systems involved" value={featureDraft.systems_involved} onChange={(systems_involved) => updateFeatureDraft({ systems_involved })} />
              <TextField label="Success outcome" value={featureDraft.success_outcome ?? ''} onChange={(success_outcome) => updateFeatureDraft({ success_outcome })} />
            </section>
          ) : null}

          {(showUseCaseList || showUseCaseEditor || showCanvasEditor) && artifactContentLoading ? (
            <ArtifactState title="Đang tải artifact" message="Đang tải dữ liệu thật từ server…" />
          ) : null}

          {(showUseCaseList || showUseCaseEditor || showMissingDiagramState) &&
          !artifactContentLoading &&
          contextValue ? (
            <section className="artifact-workspace-content__section">
              <WorkspacePersistenceProvider value={contextValue}>
                <PersistedUseCaseWorkspace
                  mode={
                    showUseCaseList
                      ? 'list'
                      : showUseCaseEditor
                        ? 'editor'
                        : 'missing-diagram'
                  }
                  activeUseCaseResource={
                    activeArtifact.kind === 'use-case' || activeArtifact.kind === 'diagram'
                      ? useCaseResources.find((item) => item.id === activeArtifact.useCaseId) ?? null
                      : null
                  }
                  activeTreeUseCase={activeTreeUseCase}
                  treeUseCases={activeTreeFeature?.use_cases ?? []}
                />
              </WorkspacePersistenceProvider>
            </section>
          ) : null}

          {showCanvasEditor && !showMissingDiagramState && !artifactContentLoading && contextValue ? (
            <section className="editor-workspace">
              <WorkspacePersistenceProvider value={contextValue}>
                <App />
              </WorkspacePersistenceProvider>
            </section>
          ) : null}

          {(showUseCaseList || showUseCaseEditor || showCanvasEditor) &&
          !artifactContentLoading &&
          !contextValue ? (
            <ArtifactState
              title="Không tải được editor"
              message="Feature nguồn chưa sẵn sàng hoặc không còn tồn tại."
              actionLabel="Về Project Spec"
              onAction={() => navigateToArtifact({ kind: 'spec' })}
            />
          ) : null}
        </section>
      </div>
    </main>
  );

  function updateFeatureDraft(patch: Partial<FeatureIntent>) {
    setFeatureDraft((current) => ({ ...current, ...patch }));
    setFeatureSaveState('dirty');
  }
}

function aggregateSaveState(...states: SaveState[]): SaveState {
  if (states.includes('saving')) return 'saving';
  if (states.includes('failed')) return 'failed';
  if (states.includes('dirty')) return 'dirty';
  if (states.includes('saved')) return 'saved';
  return 'idle';
}

function SaveButton({ state, onClick }: { state: SaveState; onClick: () => void }) {
  return (
    <button className="workspace-button primary" onClick={onClick} disabled={state === 'saving'}>
      {state === 'saving' ? 'Đang lưu…' : state === 'saved' ? 'Đã lưu' : state === 'failed' ? 'Thử lưu lại' : 'Lưu'}
    </button>
  );
}

function ArtifactState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="workspace-empty artifact-state">
      <h2>{title}</h2>
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button className="workspace-button primary" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="workspace-field">{label}<input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="workspace-field">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  const [draft, setDraft] = useState(() => value.join('\n'));

  useEffect(() => {
    if (!sameTextList(parseTextList(draft), value)) {
      setDraft(value.join('\n'));
    }
  }, [draft, value]);

  return (
    <label className="workspace-field">
      {label}
      <textarea
        value={draft}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);
          onChange(parseTextList(nextDraft));
        }}
        placeholder="Mỗi dòng một giá trị"
      />
    </label>
  );
}

function parseTextList(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sameTextList(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
