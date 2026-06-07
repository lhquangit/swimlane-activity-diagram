import { UserButton, useUser } from '@clerk/react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import App from '../App';
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
  type ProjectResource,
  type SaveState,
  type SpecResource,
  type UseCaseResource,
} from '../persistence/types';
import type { FeatureIntent, ProjectSpec, UseCaseDraft } from '../usecases/types';

type WorkspaceTab = 'spec' | 'features' | 'editor';

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

export default function ProjectWorkspace() {
  const { projectId = '', featureId: routeFeatureId } = useParams();
  const api = usePersistenceApi();
  const navigate = useNavigate();
  const { user } = useUser();
  const [project, setProject] = useState<ProjectResource | null>(null);
  const [spec, setSpec] = useState<SpecResource | null>(null);
  const [features, setFeatures] = useState<FeatureIntentResource[]>([]);
  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(null);
  const [useCaseResources, setUseCaseResources] = useState<UseCaseResource[]>([]);
  const [activeDiagram, setActiveDiagram] = useState<DiagramResource | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>('spec');
  const [projectDraft, setProjectDraft] = useState({ name: '', description: '' });
  const [specDraft, setSpecDraft] = useState<ProjectSpec | null>(null);
  const [featureDraft, setFeatureDraft] = useState<FeatureIntent>(emptyFeature);
  const [featureDraftId, setFeatureDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectSaveState, setProjectSaveState] = useState<SaveState>('idle');
  const [specSaveState, setSpecSaveState] = useState<SaveState>('idle');
  const [featureSaveState, setFeatureSaveState] = useState<SaveState>('idle');
  const [saveStateRegistry, setSaveStateRegistry] = useState<SaveStateRegistry>({});
  const [activeDiagramBusinessKey, setActiveDiagramBusinessKey] = useState<string | null>(null);
  const [missingFeatureRouteId, setMissingFeatureRouteId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api.getProject(projectId), api.getSpec(projectId)])
      .then(async ([nextProject, nextSpec]) => {
        const nextFeatures = await api.listFeatures(nextSpec.id);
        if (!active) return;
        setProject(nextProject);
        setSpec(nextSpec);
        setProjectDraft({
          name: nextProject.name,
          description: nextProject.description ?? '',
        });
        setSpecDraft(projectSpecFromResources(nextProject, nextSpec));
        setFeatures(nextFeatures);
        const routedFeature = routeFeatureId
          ? nextFeatures.find((feature) => feature.id === routeFeatureId) ?? null
          : null;
        const selectedFeature = routedFeature ?? (!routeFeatureId ? nextFeatures[0] ?? null : null);
        const missingRoutedFeature = Boolean(routeFeatureId && !routedFeature);
        setMissingFeatureRouteId(missingRoutedFeature ? routeFeatureId! : null);
        if (missingRoutedFeature) {
          setActiveFeatureId(null);
          setFeatureDraftId(null);
          setFeatureDraft(emptyFeature());
          setFeatureSaveState('idle');
          setActiveDiagram(null);
          setActiveDiagramBusinessKey(null);
          setTab('features');
        }
        if (selectedFeature) {
          setActiveFeatureId(selectedFeature.id);
          setFeatureDraftId(selectedFeature.id);
          setFeatureDraft(featureIntentFromResource(selectedFeature));
          if (routeFeatureId !== selectedFeature.id) {
            navigate(`/projects/${projectId}/features/${selectedFeature.id}`, { replace: true });
          }
        }
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : 'Không tải được project.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [api, navigate, projectId, routeFeatureId]);

  const activeFeature = features.find((feature) => feature.id === activeFeatureId) ?? null;
  const useCaseScope = activeFeature
    ? makeUseCasesScope(activeFeature.id, `Use cases của ${activeFeature.name}`)
    : null;
  const diagramScope =
    activeFeature && activeDiagramBusinessKey
      ? makeDiagramScope(activeFeature.id, activeDiagramBusinessKey)
      : null;
  const brdScope = activeDiagram && activeFeature
    ? makeBrdScope(activeDiagram.id, activeFeature.id, `BRD ${activeDiagram.title}`)
    : null;
  const useCaseSaveState = getScopeState(saveStateRegistry, useCaseScope);
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

  useEffect(() => {
    if (!activeFeature) {
      setUseCaseResources([]);
      return;
    }
    let active = true;
    api
      .listUseCases(activeFeature.id)
      .then((items) => active && setUseCaseResources(items))
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : 'Không tải được use case.'));
    return () => {
      active = false;
    };
  }, [activeFeature, api]);

  const setScopedSaveState = (scope: SaveScope | null, state: SaveState) => {
    setSaveStateRegistry((current) => setScopeState(current, scope, state));
  };

  const confirmDiscardActiveChanges = (message: string) => {
    const details = allDirtyScopes.length > 0
      ? `\n\nArtifact chưa lưu: ${formatDirtyScopes(allDirtyScopes)}`
      : '';
    return !hasUnsavedChanges || window.confirm(`${message}${details}`);
  };

  const selectFeature = (feature: FeatureIntentResource) => {
    if (!confirmDiscardActiveChanges('Bỏ các thay đổi chưa lưu của feature hiện tại?')) return;
    setSaveStateRegistry((current) => clearFeatureScopes(current, activeFeatureId));
    setActiveFeatureId(feature.id);
    setFeatureDraftId(feature.id);
    setFeatureDraft(featureIntentFromResource(feature));
    setFeatureSaveState('idle');
    setActiveDiagram(null);
    setActiveDiagramBusinessKey(null);
    setMissingFeatureRouteId(null);
    setTab('editor');
    navigate(`/projects/${projectId}/features/${feature.id}`);
  };

  const startNewFeature = () => {
    if (!confirmDiscardActiveChanges('Bỏ các thay đổi chưa lưu của feature hiện tại?')) return;
    setSaveStateRegistry((current) => clearFeatureScopes(current, activeFeatureId));
    setFeatureDraftId(null);
    setFeatureDraft(emptyFeature());
    setFeatureSaveState('dirty');
    setActiveDiagram(null);
    setActiveDiagramBusinessKey(null);
    setMissingFeatureRouteId(null);
    setTab('features');
    navigate(`/projects/${projectId}`);
  };

  const saveSpec = async () => {
    if (!project || !spec || !specDraft) return;
    setProjectSaveState('saving');
    setSpecSaveState('saving');
    setError(null);
    try {
      const [savedProject, savedSpec] = await Promise.all([
        api.updateProject(project.id, {
          name: projectDraft.name,
          description: projectDraft.description || null,
        }),
        api.updateSpec(project.id, {
          project_summary: specDraft.project_summary,
          business_context: specDraft.business_context,
          target_users: specDraft.target_users,
          business_rules: specDraft.business_rules,
          glossary: specDraft.glossary,
        }),
      ]);
      setProject(savedProject);
      setSpec(savedSpec);
      setSpecDraft(projectSpecFromResources(savedProject, savedSpec));
      setProjectSaveState('saved');
      setSpecSaveState('saved');
    } catch (reason) {
      setProjectSaveState('failed');
      setSpecSaveState('failed');
      setError(reason instanceof Error ? reason.message : 'Không lưu được Spec.');
    }
  };

  const saveFeature = async () => {
    if (!spec || !featureDraft.feature_name.trim() || !featureDraft.feature_summary.trim()) return;
    setFeatureSaveState('saving');
    setError(null);
    try {
      const saved = featureDraftId
        ? await api.updateFeature(featureDraftId, featurePayload(featureDraft))
        : await api.createFeature(spec.id, featurePayload(featureDraft));
      setFeatures((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setFeatureDraftId(saved.id);
      setActiveFeatureId(saved.id);
      setFeatureDraft(featureIntentFromResource(saved));
      setFeatureSaveState('saved');
      setTab('editor');
      navigate(`/projects/${projectId}/features/${saved.id}`, { replace: !featureDraftId });
    } catch (reason) {
      setFeatureSaveState('failed');
      setError(reason instanceof Error ? reason.message : 'Không lưu được Feature Intent.');
    }
  };

  const deleteFeature = async (feature: FeatureIntentResource) => {
    if (!confirmDiscardActiveChanges('Bỏ các thay đổi chưa lưu trước khi xóa feature?')) return;
    if (!window.confirm(`Xóa feature "${feature.name}" và toàn bộ use case liên quan?`)) return;
    await api.deleteFeature(feature.id);
    setSaveStateRegistry((current) => clearFeatureScopes(current, feature.id));
    const next = features.filter((item) => item.id !== feature.id);
    setFeatures(next);
    const replacement = next[0] ?? null;
    setActiveFeatureId(replacement?.id ?? null);
    setFeatureDraftId(replacement?.id ?? null);
    setFeatureDraft(replacement ? featureIntentFromResource(replacement) : emptyFeature());
    setFeatureSaveState('idle');
    setActiveDiagram(null);
    setActiveDiagramBusinessKey(null);
    setTab('features');
    navigate(replacement ? `/projects/${projectId}/features/${replacement.id}` : `/projects/${projectId}`, {
      replace: true,
    });
  };

  const contextValue = useMemo<WorkspacePersistence | null>(() => {
    if (!project || !spec || !activeFeature) return null;
    const projectSpec = projectSpecFromResources(project, spec);
    return {
      project,
      spec,
      activeFeature,
      projectSpec,
      featureIntent: featureIntentFromResource(activeFeature),
      openProjectSpecEditor: () => setTab('spec'),
      openFeatureIntentEditor: () => setTab('features'),
      useCaseResources,
      useCaseSaveState,
      diagramSaveState,
      brdSaveState,
      dirtyScopes: allDirtyScopes,
      canSwitchDiagramScope: (nextBusinessKey) => {
        if (!activeDiagramBusinessKey || activeDiagramBusinessKey === nextBusinessKey) return true;
        const currentDiagramScope = activeFeature
          ? makeDiagramScope(activeFeature.id, activeDiagramBusinessKey)
          : null;
        const activeDirtyScopes = [
          currentDiagramScope && getScopeState(saveStateRegistry, currentDiagramScope) === 'dirty'
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
      markUseCasesDirty: () => setScopedSaveState(useCaseScope, 'dirty'),
      markDiagramDirty: (businessKey) => {
        const key = businessKey ?? activeDiagramBusinessKey;
        if (key) setActiveDiagramBusinessKey(key);
        setScopedSaveState(activeFeature && key ? makeDiagramScope(activeFeature.id, key) : null, 'dirty');
      },
      markBrdDirty: (diagramId) => setScopedSaveState(
        diagramId || activeDiagram?.id
          ? makeBrdScope(
              diagramId || activeDiagram!.id,
              activeFeature.id,
              activeDiagram?.title ? `BRD ${activeDiagram.title}` : 'BRD',
            )
          : null,
        'dirty',
      ),
      markBrdLoaded: (diagramId) => setScopedSaveState(
        makeBrdScope(
          diagramId,
          activeFeature.id,
          activeDiagram?.title ? `BRD ${activeDiagram.title}` : 'BRD',
        ),
        'idle',
      ),
      generateUseCases: (preference) => api.generateUseCases(activeFeature.id, preference),
      saveUseCases: async (drafts: UseCaseDraft[]) => {
        setScopedSaveState(useCaseScope, 'saving');
        try {
          const saved = await api.saveUseCases(activeFeature.id, useCaseResources, drafts);
          setUseCaseResources(saved);
          setScopedSaveState(useCaseScope, 'saved');
          return saved;
        } catch (reason) {
          setScopedSaveState(useCaseScope, 'failed');
          throw reason;
        }
      },
      generateDiagram: async (businessKey) => {
        if (useCaseSaveState === 'dirty' || useCaseSaveState === 'saving' || useCaseSaveState === 'failed') {
          throw new Error('Hãy lưu Use Case mới nhất trước khi sinh Diagram.');
        }
        const resource = useCaseResources.find((item) => item.use_case_key === businessKey);
        if (!resource) throw new Error('Hãy lưu Use Case trước khi sinh Diagram.');
        const generated = await api.generateDiagram(resource.id);
        setActiveDiagramBusinessKey(businessKey);
        return generated;
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
        setActiveDiagramBusinessKey(businessKey);
        setScopedSaveState(nextDiagramScope, 'saving');
        try {
          const saved = await api.saveDiagram(resource.id, {
            title: useCaseResources.find((item) => item.use_case_key === businessKey)?.title || businessKey,
            graph_data: graphData,
            lanes_data: lanes as unknown as Array<Record<string, unknown>>,
            lane_height: Math.round(laneHeight),
            semantic_edited: semanticEdited,
          });
          setActiveDiagram(saved);
          setScopedSaveState(nextDiagramScope, 'saved');
          return saved;
        } catch (reason) {
          setScopedSaveState(nextDiagramScope, 'failed');
          throw reason;
        }
      },
      activeDiagram,
      setActiveDiagram,
      brdCacheScope:
        user?.id && project && activeDiagram
          ? { userId: user.id, projectId: project.id, diagramId: activeDiagram.id }
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
              (activeDiagram?.use_case_id === resource.id && scope.resourceId === activeDiagram.id),
          ),
        );
        if (activeDiagram?.use_case_id === resource.id) {
          setActiveDiagram(null);
          setActiveDiagramBusinessKey(null);
        }
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
          setScopedSaveState(nextBrdScope, 'saved');
          return saved;
        } catch (reason) {
          setScopedSaveState(nextBrdScope, 'failed');
          throw reason;
        }
      },
    };
  }, [
    activeDiagram,
    activeFeature,
    api,
    brdSaveState,
    brdScope,
    diagramSaveState,
    featureSaveState,
    allDirtyScopes,
    activeDiagramBusinessKey,
    saveStateRegistry,
    project,
    spec,
    useCaseScope,
    useCaseResources,
    useCaseSaveState,
    user?.id,
  ]);

  if (loading) return <main className="workspace-loading">Đang tải project…</main>;
  if (!project || !spec || !specDraft) {
    return <main className="workspace-loading">{error || 'Không tìm thấy project.'}</main>;
  }

  const leaveWorkspace = () => {
    if (hasUnsavedChanges && !window.confirm('Bạn có thay đổi chưa lưu. Rời project?')) return;
    navigate('/projects');
  };

  return (
    <main className="project-workspace">
      <header className="workspace-header compact">
        <div>
          <button className="workspace-back" onClick={leaveWorkspace}>← Projects</button>
          <h1>{project.name}</h1>
          <p>Spec → Feature Intent → Use Case → Diagram → BRD</p>
        </div>
        <div className="workspace-header__actions">
          {hasUnsavedChanges ? <span className="save-state dirty">Có thay đổi chưa lưu</span> : null}
          <UserButton />
        </div>
      </header>

      <nav className="workspace-tabs">
        <button className={tab === 'spec' ? 'active' : ''} onClick={() => setTab('spec')}>1. Project Spec</button>
        <button className={tab === 'features' ? 'active' : ''} onClick={() => setTab('features')}>2. Features</button>
        <button
          className={tab === 'editor' ? 'active' : ''}
          disabled={!activeFeature}
          onClick={() => setTab('editor')}
        >
          3. Use Case, Diagram & BRD
        </button>
      </nav>

      {error ? <p className="workspace-error workspace-error--floating">{error}</p> : null}

      {missingFeatureRouteId ? (
        <section className="workspace-error">
          <strong>Feature không tồn tại trong project này hoặc bạn không có quyền.</strong>
          <p>URL đang trỏ tới một feature không thuộc danh sách hiện tại. Chọn feature khác để tiếp tục.</p>
          <div className="workspace-header__actions">
            {features[0] ? (
              <button className="workspace-button primary" onClick={() => selectFeature(features[0])}>
                Mở feature đầu tiên
              </button>
            ) : null}
            <button className="workspace-button" onClick={() => {
              setMissingFeatureRouteId(null);
              setTab('features');
              navigate(`/projects/${projectId}`, { replace: true });
            }}>
              Về danh sách feature
            </button>
          </div>
        </section>
      ) : null}

      {tab === 'spec' ? (
        <section className="workspace-form-card">
          <div className="workspace-section-heading">
            <div><h2>Project Spec</h2><p>Một project chỉ có một Spec, luôn ghi đè bản mới nhất.</p></div>
            <SaveButton state={aggregateSaveState(projectSaveState, specSaveState)} onClick={() => void saveSpec()} />
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

      {tab === 'features' ? (
        <section className="feature-workspace">
          <aside className="feature-list">
            <button className="workspace-button primary" onClick={startNewFeature}>+ Feature</button>
            {features.map((feature) => (
              <div className={`feature-list-item ${featureDraftId === feature.id ? 'active' : ''}`} key={feature.id}>
                <button onClick={() => selectFeature(feature)}>{feature.name}</button>
                <button className="feature-delete" onClick={() => void deleteFeature(feature)}>×</button>
              </div>
            ))}
          </aside>
          <section className="workspace-form-card feature-editor">
            <div className="workspace-section-heading">
              <div><h2>{featureDraftId ? 'Feature Intent' : 'Feature mới'}</h2><p>Mỗi Spec có thể có nhiều Feature Intent.</p></div>
              <SaveButton state={featureSaveState} onClick={() => void saveFeature()} />
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
        </section>
      ) : null}

      {tab === 'editor' && contextValue ? (
        <section className="editor-workspace">
          <div className="editor-workspace__feature">
            <span>Feature đang mở</span>
            <strong>{activeFeature?.name}</strong>
            <button className="workspace-button" onClick={() => setTab('features')}>Đổi feature</button>
          </div>
          <WorkspacePersistenceProvider value={contextValue}>
            <App />
          </WorkspacePersistenceProvider>
        </section>
      ) : null}
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
