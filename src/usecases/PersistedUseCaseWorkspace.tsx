import { useEffect, useState } from 'react';

import type { ResponseMetadata } from '../brd/types';
import { useWorkspacePersistence } from '../persistence/WorkspaceContext';
import type { ArtifactTreeUseCase, UseCaseResource } from '../persistence/types';
import { validateUseCaseContract } from './contract';
import {
  addAlternateFlow,
  addAlternateStep,
  addMainStep,
  canonicalizeUseCaseDraft,
  getMainStepReferenceReason,
  moveAlternateStep,
  moveMainStep,
  removeAlternateFlow,
  removeAlternateStep,
  removeMainStep,
  setAlternateFlowOutcomeMode,
  updateAlternateFlow,
  updateAlternateStep,
  updateMainStep,
} from './editor';
import { diagramDraftToWorkspace } from './diagram';
import {
  applyUseCaseEditLifecycle,
  deriveUseCaseDiagramLifecycle,
  diagramStatusLabel,
} from './lifecycle';
import { migratePrimaryActor } from './contract';
import {
  collectUseCaseActors,
  runLocalUseCasePreValidation,
} from './prevalidate';
import type {
  UseCaseDiagramArtifactState,
  UseCaseDraft,
  UseCaseGenerationPreference,
} from './types';

type PersistedUseCaseWorkspaceProps = {
  mode: 'list' | 'editor' | 'missing-diagram';
  activeUseCaseResource?: UseCaseResource | null;
  activeTreeUseCase?: ArtifactTreeUseCase | null;
  treeUseCases?: ArtifactTreeUseCase[];
};

export default function PersistedUseCaseWorkspace({
  mode,
  activeUseCaseResource = null,
  activeTreeUseCase = null,
  treeUseCases = [],
}: PersistedUseCaseWorkspaceProps) {
  const workspace = useWorkspacePersistence();
  const [useCaseDrafts, setUseCaseDrafts] = useState<UseCaseDraft[]>([]);
  const [generationPreference, setGenerationPreference] =
    useState<UseCaseGenerationPreference>('auto');
  const [useCaseError, setUseCaseError] = useState<string | null>(null);
  const [useCaseRequestId, setUseCaseRequestId] = useState<string | null>(null);
  const [latestGenerationMetadata, setLatestGenerationMetadata] =
    useState<ResponseMetadata | null>(workspace?.activeFeature.latest_usecase_generation ?? null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasUnsavedGeneratedDrafts, setHasUnsavedGeneratedDrafts] = useState(false);
  const [optimisticDiagramState, setOptimisticDiagramState] =
    useState<UseCaseDiagramArtifactState | null>(null);

  useEffect(() => {
    if (!workspace) return;
    if (workspace.useCaseSaveState === 'dirty' || hasUnsavedGeneratedDrafts) return;
    setUseCaseDrafts(resourceDrafts(workspace.useCaseResources));
  }, [
    workspace,
    workspace?.useCaseResources,
    workspace?.useCaseSaveState,
    hasUnsavedGeneratedDrafts,
  ]);

  useEffect(() => {
    if (!activeUseCaseResource) {
      setOptimisticDiagramState(null);
      return;
    }
    if (activeTreeUseCase?.diagram) {
      setOptimisticDiagramState(null);
    }
  }, [activeUseCaseResource, activeTreeUseCase?.diagram]);

  useEffect(() => {
    if (!workspace) return;
    setLatestGenerationMetadata(workspace.activeFeature.latest_usecase_generation ?? null);
  }, [workspace, workspace?.activeFeature.id, workspace?.activeFeature.latest_usecase_generation]);

  if (!workspace) return null;

  const validationErrors = runLocalUseCasePreValidation(
    workspace.projectSpec,
    workspace.featureIntent,
  );
  const selectedDraft =
    activeUseCaseResource == null
      ? null
      : useCaseDrafts.find((useCase) => useCase.use_case_id === activeUseCaseResource.use_case_key) ??
        canonicalizeUseCaseDraft(activeUseCaseResource.content);
  const canGenerate = !isGenerating && validationErrors.length === 0;
  const canPersistSelected = Boolean(selectedDraft && activeUseCaseResource);
  const canPersistDraftList =
    useCaseDrafts.length > 0 && workspace.useCaseSaveState !== 'saving' && !isGenerating;
  const generationMetadata =
    latestGenerationMetadata ?? workspace.activeFeature.latest_usecase_generation ?? null;

  const persistDraftList = async (drafts: UseCaseDraft[]) => {
    await workspace.saveUseCases(drafts);
    await workspace.refreshArtifactTree();
    setHasUnsavedGeneratedDrafts(false);
    setUseCaseError(null);
  };

  const handleGenerateAndPersist = async () => {
    if (!canGenerate) return;
    if (useCaseDrafts.length > 0) {
      const confirmed = window.confirm(
        'Sinh lại sẽ thay thế danh sách Use Case hiện tại. Các Use Case bị loại khỏi danh sách mới sẽ bị xóa cùng Diagram và BRD nằm dưới chúng.\n\nBạn có muốn tiếp tục không?',
      );
      if (!confirmed) return;
    }
    setIsGenerating(true);
    setUseCaseError(null);
    try {
      const envelope = await workspace.generateUseCases(generationPreference);
      const result = envelope.result;
      if (!result) {
        throw new Error('Use case generation trả về kết quả rỗng.');
      }
      const generatedDrafts = result.use_cases.map(canonicalizeUseCaseDraft);
      setUseCaseDrafts(generatedDrafts);
      setHasUnsavedGeneratedDrafts(true);
      setUseCaseRequestId(envelope.request_id);
      setLatestGenerationMetadata(envelope.metadata ?? null);

      await persistDraftList(generatedDrafts);
      setUseCaseDrafts(generatedDrafts);
      setUseCaseError(null);
      setUseCaseRequestId(envelope.request_id);
      setLatestGenerationMetadata(envelope.metadata ?? null);
    } catch (error) {
      setUseCaseError(
        error instanceof Error ? error.message : 'Không thể sinh và lưu danh sách use case.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePersistCurrentList = async () => {
    if (!canPersistDraftList) return;
    setUseCaseError(null);
    try {
      await persistDraftList(useCaseDrafts);
    } catch (error) {
      setUseCaseError(
        error instanceof Error ? error.message : 'Không thể lưu danh sách use case hiện tại.',
      );
    }
  };

  const handleOpenUseCase = (resourceId: string) => {
    workspace.navigateToArtifact({
      kind: 'use-case',
      featureId: workspace.activeFeature.id,
      useCaseId: resourceId,
    });
  };

  const handleUseCaseChange = (useCaseId: string, next: UseCaseDraft) => {
    setUseCaseDrafts((current) =>
      current.map((useCase) => {
        if (useCase.use_case_id !== useCaseId) return useCase;
        const canonicalNext = canonicalizeUseCaseDraft(next);
        return applyUseCaseEditLifecycle(useCase, canonicalNext);
      }),
    );
    workspace.markUseCaseDirty(useCaseId, next.title || useCaseId);
    if (useCaseError) setUseCaseError(null);
  };

  const handleReviewStatusChange = (
    useCaseId: string,
    nextStatus: UseCaseDraft['review_status'],
  ) => {
    const nextDraft = useCaseDrafts.find((useCase) => useCase.use_case_id === useCaseId);
    if (
      nextStatus === 'approved' &&
      (!nextDraft || validateUseCaseContract(nextDraft).length > 0)
    ) {
      return;
    }
    setUseCaseDrafts((current) =>
      current.map((useCase) =>
        useCase.use_case_id === useCaseId
          ? { ...useCase, review_status: nextStatus }
          : useCase,
      ),
    );
    if (nextDraft) {
      workspace.markUseCaseDirty(useCaseId, nextDraft.title || useCaseId);
    }
  };

  const handleSaveSelected = async () => {
    if (!selectedDraft) return;
    try {
      await workspace.saveUseCases(useCaseDrafts, {
        businessKeys: [selectedDraft.use_case_id],
        labelsByBusinessKey: {
          [selectedDraft.use_case_id]: selectedDraft.title || selectedDraft.use_case_id,
        },
      });
      await workspace.refreshArtifactTree();
    } catch (error) {
      setUseCaseError(error instanceof Error ? error.message : 'Không thể lưu Use Case.');
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedDraft) return;
    const confirmed = window.confirm(
      `Xóa use case "${selectedDraft.title}"? Diagram và BRD đã lưu bên dưới use case này cũng sẽ bị xóa.`,
    );
    if (!confirmed) return;
    try {
      await workspace.deleteUseCase(selectedDraft.use_case_id);
    } catch (error) {
      setUseCaseError(error instanceof Error ? error.message : 'Không thể xóa Use Case.');
    }
  };

  const handleOpenFeatureIntent = () => {
    workspace.openFeatureIntentEditor();
  };

  const handleBackToList = () => {
    workspace.navigateToArtifact({
      kind: 'use-cases',
      featureId: workspace.activeFeature.id,
    });
  };

  const handleOpenDiagram = () => {
    if (!activeUseCaseResource) return;
    workspace.navigateToArtifact({
      kind: 'diagram',
      featureId: workspace.activeFeature.id,
      useCaseId: activeUseCaseResource.id,
    });
  };

  const handleGenerateDiagram = async () => {
    if (!selectedDraft || !activeUseCaseResource) return;
    const contractIssues = validateUseCaseContract(selectedDraft);
    if (selectedDraft.review_status !== 'approved') {
      setUseCaseError('Cần phê duyệt use case trước khi tạo diagram.');
      return;
    }
    if (contractIssues.length > 0) {
      setUseCaseError(contractIssues[0].message);
      return;
    }
    const diagramLifecycle = deriveUseCaseDiagramLifecycle({
      reviewStatus: selectedDraft.review_status,
      artifactState: derivePersistedDiagramArtifactState(activeTreeUseCase),
      isActiveOnCanvas: false,
    });
    if (
      diagramLifecycle.status === 'outdated' ||
      diagramLifecycle.status === 'diverged'
    ) {
      const confirmed = window.confirm(
        diagramLifecycle.status === 'diverged'
          ? 'Diagram hiện tại đã được chỉnh sửa ngữ nghĩa riêng và không còn đồng bộ với Use Case. Tạo lại sẽ thay bản hiện có bằng draft mới. Bạn có muốn tiếp tục không?'
          : 'Diagram hiện tại đã lỗi thời. Tạo lại sẽ thay bản hiện có bằng draft mới. Bạn có muốn tiếp tục không?',
      );
      if (!confirmed) return;
    }
    setUseCaseError(null);
    try {
      const envelope = await workspace.generateDiagram(selectedDraft.use_case_id);
      const draft = envelope.result?.diagram;
      if (!draft) {
        throw new Error('Diagram generation trả về kết quả rỗng.');
      }
      const generated = diagramDraftToWorkspace(draft, selectedDraft);
      await workspace.saveDiagram(
        selectedDraft.use_case_id,
        generated.graph as unknown as Record<string, unknown>,
        generated.lanes,
        generated.laneHeight,
        false,
      );
      setOptimisticDiagramState('ready');
      await workspace.refreshArtifactTree();
    } catch (error) {
      setUseCaseError(error instanceof Error ? error.message : 'Không thể tạo Diagram.');
    }
  };

  if (mode === 'list') {
    return (
      <section className="usecase-workspace-page">
        <div className="workspace-section-heading">
          <div>
            <h2>Use Cases</h2>
            <p>
              Sinh danh sách use case từ Feature Intent đã lưu. Kết quả được persist ngay để left
              tree refresh theo artifact thật.
            </p>
          </div>
          <div className="workspace-header__actions">
            <button className="workspace-button" type="button" onClick={handleOpenFeatureIntent}>
              Sửa Feature Intent
            </button>
            {useCaseDrafts.length > 0 ? (
              <button
                className="workspace-button"
                type="button"
                onClick={() => void handlePersistCurrentList()}
                disabled={!canPersistDraftList}
              >
                {workspace.useCaseSaveState === 'saving'
                  ? 'Đang lưu danh sách…'
                  : workspace.useCaseSaveState === 'failed' || hasUnsavedGeneratedDrafts
                    ? 'Thử lưu lại'
                    : 'Lưu danh sách'}
              </button>
            ) : null}
            <button
              className="workspace-button primary"
              type="button"
              onClick={() => void handleGenerateAndPersist()}
              disabled={!canGenerate}
            >
              {isGenerating ? 'Đang sinh và lưu…' : 'Sinh use case'}
            </button>
          </div>
        </div>

        <section className="workspace-form-card">
          <div className="usecase-workspace-page__summary-grid">
            <ReadonlyField label="Tên feature" value={workspace.featureIntent.feature_name} />
            <ReadonlyField
              label="Mô tả feature"
              value={workspace.featureIntent.feature_summary}
            />
            <ReadonlyField
              label="Actors / swimlanes"
              value={joinLines(collectUseCaseActors(workspace.projectSpec, workspace.featureIntent))}
            />
            <ReadonlyField
              label="Kết quả mong muốn"
              value={workspace.featureIntent.success_outcome ?? 'Chưa có'}
            />
          </div>
          <div className="usecase-workspace-page__toolbar">
            <div className="usecase-panel__generation-mode" aria-label="Cách sinh use case">
              {(
                [
                  ['auto', 'Theo hệ thống'],
                  ['ai', 'Ưu tiên AI'],
                  ['deterministic', 'Theo rule'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={generationPreference === value ? 'active' : ''}
                  aria-pressed={generationPreference === value}
                  onClick={() => setGenerationPreference(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {generationMetadata ? (
              <GenerationMetadataCard
                metadata={generationMetadata}
                requestId={useCaseRequestId}
                compact
              />
            ) : null}
          </div>
          {validationErrors.length > 0 ? (
            <ul className="usecase-panel__validation-list">
              {validationErrors.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
          {useCaseError ? <p className="workspace-error">{useCaseError}</p> : null}
          {hasUnsavedGeneratedDrafts ? (
            <p className="usecase-workspace-page__draft-warning">
              Danh sách hiện mới tồn tại ở phiên làm việc này. Hãy lưu thành công để left tree và
              các trang artifact khác dùng đúng dữ liệu persisted.
            </p>
          ) : null}
        </section>

        {useCaseDrafts.length === 0 ? (
          <section className="workspace-empty">
            <h2>Chưa có Use Case</h2>
            <p>Lưu Feature Intent rồi bấm `Sinh use case` để tạo danh sách artifact đầu tiên.</p>
          </section>
        ) : (
          <section className="usecase-workspace-page__list">
            {useCaseDrafts.map((useCase) => {
              const resource = workspace.useCaseResources.find(
                (item) => item.use_case_key === useCase.use_case_id,
              );
              const treeUseCase =
                treeUseCases.find((item) => item.id === resource?.id) ?? null;
              const diagramSummary = activeDiagramSummary(useCase, treeUseCase);
              return (
                <article className="usecase-card" key={useCase.use_case_id}>
                  <div className="usecase-card__header">
                    <div>
                      <p className="usecase-card__id">{useCase.use_case_id}</p>
                      <strong>{useCase.title}</strong>
                      <p className="usecase-card__summary">
                        {useCase.main_flow_steps.length} bước chính · {useCase.alternate_flows.length}{' '}
                        luồng thay thế
                      </p>
                    </div>
                    <div className="usecase-card__header-actions">
                      <span
                        className={`usecase-card__status usecase-card__status--${useCase.review_status}`}
                      >
                        {reviewStatusPillLabel(useCase.review_status)}
                      </span>
                      {resource ? (
                        <button
                          className="toolbar-btn primary"
                          type="button"
                          onClick={() => handleOpenUseCase(resource.id)}
                        >
                          Sửa Use Case
                        </button>
                      ) : (
                        <span className="usecase-card__pending-pill">Chưa persist</span>
                      )}
                    </div>
                  </div>
                  <p className="usecase-card__next-step">{diagramSummary}</p>
                </article>
              );
            })}
          </section>
        )}
      </section>
    );
  }

  if (mode === 'missing-diagram') {
    const issues = selectedDraft ? validateUseCaseContract(selectedDraft) : [];
    const canCreateDiagram =
      selectedDraft != null &&
      selectedDraft.review_status === 'approved' &&
      issues.length === 0;
    return (
      <section className="workspace-empty artifact-state">
        <h2>Diagram chưa tạo</h2>
        <p>
          {selectedDraft
            ? `Artifact Diagram cho ${selectedDraft.use_case_id} chưa tồn tại trong database.`
            : 'Diagram cho Use Case này chưa tồn tại.'}
        </p>
        {selectedDraft ? (
          <p>
            {selectedDraft.review_status === 'approved'
              ? 'Use Case đã sẵn sàng để tạo diagram.'
              : 'Hãy lưu và phê duyệt Use Case trước khi tạo diagram.'}
          </p>
        ) : null}
        {useCaseError ? <p className="workspace-error">{useCaseError}</p> : null}
        <div className="workspace-header__actions">
          <button className="workspace-button" type="button" onClick={handleBackToList}>
            Về Use Cases
          </button>
          <button
            className="workspace-button primary"
            type="button"
            onClick={() => void handleGenerateDiagram()}
            disabled={!canCreateDiagram}
          >
            Tạo diagram
          </button>
        </div>
      </section>
    );
  }

  if (!selectedDraft || !activeUseCaseResource) {
    return (
      <section className="workspace-empty artifact-state">
        <h2>Không tìm thấy Use Case</h2>
        <p>Artifact đang chọn không còn tồn tại hoặc chưa tải xong.</p>
      </section>
    );
  }

  const contractIssues = validateUseCaseContract(selectedDraft);
  const diagramLifecycle = deriveUseCaseDiagramLifecycle({
    reviewStatus: selectedDraft.review_status,
    artifactState:
      optimisticDiagramState ?? derivePersistedDiagramArtifactState(activeTreeUseCase),
    isActiveOnCanvas: false,
  });
  const canOpenDiagram =
    (Boolean(activeTreeUseCase?.diagram) || optimisticDiagramState === 'ready') &&
    diagramLifecycle.canOpenCanvas;
  const canGenerateDiagram =
    diagramLifecycle.status === 'ready_to_generate' ||
    diagramLifecycle.status === 'outdated' ||
    diagramLifecycle.status === 'diverged';
  const diagramActionLabel =
    diagramLifecycle.status === 'outdated' || diagramLifecycle.status === 'diverged'
      ? 'Tạo lại diagram'
      : 'Tạo diagram';
  const actorOptions = [selectedDraft.primary_actor, ...selectedDraft.supporting_actors].filter(
    Boolean,
  );

  return (
    <section className="usecase-workspace-page persisted-usecase">
      <div className="workspace-section-heading">
        <div>
          <h2>Use Case</h2>
          <p>
            Chỉnh từng use case như một artifact riêng, rồi tạo diagram tương ứng khi đã sẵn sàng.
          </p>
        </div>
        <div className="workspace-header__actions">
          <span className={`usecase-card__status usecase-card__status--${selectedDraft.review_status}`}>
            {reviewStatusPillLabel(selectedDraft.review_status)}
          </span>
          <button className="workspace-button" type="button" onClick={handleBackToList}>
            Về Use Cases
          </button>
          <button className="workspace-button danger" type="button" onClick={() => void handleDeleteSelected()}>
            Xóa
          </button>
          <button
            className="workspace-button primary"
            type="button"
            onClick={() => void handleSaveSelected()}
            disabled={!canPersistSelected || workspace.useCaseSaveState === 'saving'}
          >
            {workspace.useCaseSaveState === 'saving'
              ? 'Đang lưu…'
              : workspace.useCaseSaveState === 'saved'
                ? 'Đã lưu'
                : workspace.useCaseSaveState === 'failed'
                  ? 'Lưu lại'
                  : 'Lưu Use Case'}
          </button>
        </div>
      </div>

      <section className="workspace-form-card usecase-workspace-page__editor persisted-usecase__surface">
        <header className="persisted-usecase__hero">
          <div className="persisted-usecase__identity">
            <p className="persisted-usecase__id">{selectedDraft.use_case_id}</p>
            <input
              className="persisted-usecase__title-input"
              aria-label="Tên Use Case"
              value={selectedDraft.title}
              onChange={(event) =>
                handleUseCaseChange(selectedDraft.use_case_id, {
                  ...selectedDraft,
                  title: event.target.value,
                })
              }
            />
            <div className="persisted-usecase__meta">
              <span
                className={`usecase-card__status usecase-card__status--${selectedDraft.review_status}`}
              >
                {reviewStatusPillLabel(selectedDraft.review_status)}
              </span>
              <span
                className={`usecase-card__status usecase-card__status--${diagramLifecycle.status}`}
              >
                {diagramStatusLabel(diagramLifecycle.status)}
              </span>
              <span className="persisted-usecase__meta-text">
                {selectedDraft.main_flow_steps.length} bước chính ·{' '}
                {selectedDraft.alternate_flows.length} luồng thay thế
              </span>
            </div>
          </div>
          <div className="persisted-usecase__hero-actions">
            {canOpenDiagram ? (
              <button className="workspace-button" type="button" onClick={handleOpenDiagram}>
                Mở diagram
              </button>
            ) : null}
            {canGenerateDiagram ? (
              <button
                className="workspace-button primary"
                type="button"
                onClick={() => void handleGenerateDiagram()}
                disabled={selectedDraft.review_status !== 'approved' || contractIssues.length > 0}
              >
                {diagramActionLabel}
              </button>
            ) : null}
          </div>
        </header>

        <p className="persisted-usecase__hero-note">{diagramLifecycle.note}</p>
        {generationMetadata ? (
          <GenerationMetadataCard metadata={generationMetadata} requestId={useCaseRequestId} />
        ) : null}

        <div className="persisted-usecase__section-grid">
          <article className="persisted-usecase__section">
            <div className="persisted-usecase__section-heading">
              <div>
                <h3>Tác nhân</h3>
                <p>Các actor đang tham gia vào use case này.</p>
              </div>
            </div>
            <div className="persisted-usecase__pill-list">
              {actorOptions.map((actor) => (
                <span className="persisted-usecase__pill" key={actor}>
                  {actor}
                </span>
              ))}
            </div>
            <details className="persisted-usecase__editor-panel">
              <summary>Chỉnh tác nhân</summary>
              <label className="persisted-usecase__field">
                <span>Actors</span>
                <textarea
                  rows={3}
                  value={joinLines(actorOptions)}
                  onChange={(event) =>
                    handleUseCaseChange(
                      selectedDraft.use_case_id,
                      updateUseCaseActors(selectedDraft, splitLines(event.target.value)),
                    )
                  }
                />
              </label>
            </details>
          </article>

          <article className="persisted-usecase__section">
            <div className="persisted-usecase__section-heading">
              <div>
                <h3>Thông tin chung</h3>
                <p>Mục tiêu nghiệp vụ và điều kiện trước khi luồng bắt đầu.</p>
              </div>
            </div>
            <dl className="persisted-usecase__fact-grid">
              <div>
                <dt>Mục tiêu</dt>
                <dd>{selectedDraft.objective || 'Chưa có mục tiêu.'}</dd>
              </div>
              <div>
                <dt>Điều kiện tiên quyết</dt>
                <dd>{joinLines(selectedDraft.preconditions) || 'Chưa có điều kiện tiên quyết.'}</dd>
              </div>
            </dl>
            <details className="persisted-usecase__editor-panel">
              <summary>Chỉnh thông tin chung</summary>
              <div className="persisted-usecase__field-grid">
                <label className="persisted-usecase__field">
                  <span>Mục tiêu</span>
                  <textarea
                    rows={3}
                    value={selectedDraft.objective}
                    onChange={(event) =>
                      handleUseCaseChange(selectedDraft.use_case_id, {
                        ...selectedDraft,
                        objective: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="persisted-usecase__field">
                  <span>Điều kiện tiên quyết</span>
                  <textarea
                    rows={4}
                    value={joinLines(selectedDraft.preconditions)}
                    onChange={(event) =>
                      handleUseCaseChange(selectedDraft.use_case_id, {
                        ...selectedDraft,
                        preconditions: splitLines(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
            </details>
          </article>
        </div>

        <article className="persisted-usecase__section">
          <div className="persisted-usecase__section-heading">
            <div>
              <h3>Luồng chính</h3>
              <p>Scan từng bước trước, rồi mở đúng bước cần sửa.</p>
            </div>
            <button
              className="toolbar-btn"
              type="button"
              onClick={() =>
                handleUseCaseChange(selectedDraft.use_case_id, addMainStep(selectedDraft))
              }
            >
              Thêm bước
            </button>
          </div>
          <div className="persisted-usecase__step-list">
          {selectedDraft.main_flow_steps.map((step, stepIndex) => {
            const referenceReason = getMainStepReferenceReason(selectedDraft, step.step_id);
            return (
              <article className="persisted-usecase__step-card" key={step.step_id}>
                <div className="persisted-usecase__step-summary">
                  <div className="persisted-usecase__step-copy">
                    <div className="persisted-usecase__step-kicker">
                      <strong>Bước {stepIndex + 1}</strong>
                      <span>{step.actor_ref}</span>
                    </div>
                    <p className="persisted-usecase__step-action">
                      {step.action || 'Chưa mô tả hành động cho bước này.'}
                    </p>
                    <p className="persisted-usecase__step-result">
                      {step.expected_result || 'Chưa có kết quả mong đợi.'}
                    </p>
                    {referenceReason ? (
                      <p className="persisted-usecase__reference-note">{referenceReason}</p>
                    ) : null}
                  </div>
                  <div className="persisted-usecase__step-rail">
                    <button
                      type="button"
                      className="toolbar-btn"
                      disabled={stepIndex === 0}
                      onClick={() =>
                        handleUseCaseChange(
                          selectedDraft.use_case_id,
                          moveMainStep(selectedDraft, step.step_id, -1),
                        )
                      }
                    >
                      Lên
                    </button>
                    <button
                      type="button"
                      className="toolbar-btn"
                      disabled={stepIndex === selectedDraft.main_flow_steps.length - 1}
                      onClick={() =>
                        handleUseCaseChange(
                          selectedDraft.use_case_id,
                          moveMainStep(selectedDraft, step.step_id, 1),
                        )
                      }
                    >
                      Xuống
                    </button>
                    <button
                      type="button"
                      className="toolbar-btn danger"
                      disabled={
                        selectedDraft.main_flow_steps.length <= 1 || Boolean(referenceReason)
                      }
                      title={referenceReason ?? undefined}
                      onClick={() =>
                        handleUseCaseChange(
                          selectedDraft.use_case_id,
                          removeMainStep(selectedDraft, step.step_id),
                        )
                      }
                    >
                      Xóa
                    </button>
                  </div>
                </div>
                <details className="persisted-usecase__editor-panel">
                  <summary>Chỉnh bước</summary>
                  <div className="persisted-usecase__field-grid">
                    <label className="persisted-usecase__field">
                      <span>Actor thực hiện</span>
                      <select
                        value={step.actor_ref}
                        onChange={(event) =>
                          handleUseCaseChange(
                            selectedDraft.use_case_id,
                            updateMainStep(selectedDraft, step.step_id, {
                              actor_ref: event.target.value,
                            }),
                          )
                        }
                      >
                        {actorOptions.map((actor) => (
                          <option key={actor} value={actor}>
                            {actor}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="persisted-usecase__field persisted-usecase__field--wide">
                      <span>Hành động</span>
                      <textarea
                        rows={3}
                        value={step.action}
                        onChange={(event) =>
                          handleUseCaseChange(
                            selectedDraft.use_case_id,
                            updateMainStep(selectedDraft, step.step_id, {
                              action: event.target.value,
                            }),
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="persisted-usecase__field-grid">
                    <label className="persisted-usecase__field">
                      <span>Đầu vào hoặc kích hoạt</span>
                      <textarea
                        rows={2}
                        value={step.input_or_trigger ?? ''}
                        onChange={(event) =>
                          handleUseCaseChange(
                            selectedDraft.use_case_id,
                            updateMainStep(selectedDraft, step.step_id, {
                              input_or_trigger: event.target.value,
                            }),
                          )
                        }
                      />
                    </label>
                    <label className="persisted-usecase__field">
                      <span>Kết quả mong đợi</span>
                      <textarea
                        rows={2}
                        value={step.expected_result}
                        onChange={(event) =>
                          handleUseCaseChange(
                            selectedDraft.use_case_id,
                            updateMainStep(selectedDraft, step.step_id, {
                              expected_result: event.target.value,
                            }),
                          )
                        }
                      />
                    </label>
                  </div>
                </details>
              </article>
            );
          })}
          </div>
        </article>

        <article className="persisted-usecase__section">
          <div className="persisted-usecase__section-heading">
            <div>
              <h3>Luồng thay thế</h3>
              <p>Các nhánh ngoại lệ được giữ gọn ở summary, chỉ bung khi cần chỉnh sửa.</p>
            </div>
            <button
              className="toolbar-btn"
              type="button"
              onClick={() =>
                handleUseCaseChange(selectedDraft.use_case_id, addAlternateFlow(selectedDraft))
              }
            >
              Thêm luồng
            </button>
          </div>

        {selectedDraft.alternate_flows.length > 0 ? (
          <div className="persisted-usecase__alternate-list">
            {selectedDraft.alternate_flows.map((flow, flowIndex) => (
              <article className="persisted-usecase__flow-card" key={flow.flow_id}>
                <div className="persisted-usecase__step-summary">
                  <div className="persisted-usecase__step-copy">
                    <div className="persisted-usecase__step-kicker">
                      <strong>Luồng thay thế {flowIndex + 1}</strong>
                      <span>
                        Rẽ từ {describeMainStep(selectedDraft, flow.source_step_id)} ·{' '}
                        {flow.steps.length} bước nhánh
                      </span>
                    </div>
                    <p className="persisted-usecase__step-action">
                      {flow.condition || 'Chưa mô tả điều kiện rẽ nhánh.'}
                    </p>
                    <p className="persisted-usecase__step-result">
                      {flow.rejoin_step_id
                        ? `Quay lại ${describeMainStep(selectedDraft, flow.rejoin_step_id)}.`
                        : flow.terminal_outcome || 'Kết thúc quy trình tại nhánh này.'}
                    </p>
                  </div>
                  <div className="persisted-usecase__step-rail">
                    <button
                      type="button"
                      className="toolbar-btn danger"
                      onClick={() =>
                        handleUseCaseChange(
                          selectedDraft.use_case_id,
                          removeAlternateFlow(selectedDraft, flow.flow_id),
                        )
                      }
                    >
                      Xóa luồng
                    </button>
                  </div>
                </div>
                <details className="persisted-usecase__editor-panel">
                  <summary>Chỉnh nhánh</summary>
                  <div className="persisted-usecase__field-grid">
                    <label className="persisted-usecase__field persisted-usecase__field--wide">
                      <span>Điều kiện rẽ nhánh</span>
                      <textarea
                        rows={2}
                        value={flow.condition}
                        onChange={(event) =>
                          handleUseCaseChange(
                            selectedDraft.use_case_id,
                            updateAlternateFlow(selectedDraft, flow.flow_id, {
                              condition: event.target.value,
                            }),
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="persisted-usecase__field-grid">
                    <label className="persisted-usecase__field">
                      <span>Rẽ từ bước</span>
                      <select
                        value={flow.source_step_id}
                        onChange={(event) =>
                          handleUseCaseChange(
                            selectedDraft.use_case_id,
                            updateAlternateFlow(selectedDraft, flow.flow_id, {
                              source_step_id: event.target.value,
                            }),
                          )
                        }
                      >
                        {selectedDraft.main_flow_steps.map((step, index) => (
                          <option key={step.step_id} value={step.step_id}>
                            Bước {index + 1}: {step.action}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="persisted-usecase__field">
                      <span>Hướng kết thúc</span>
                      <select
                        value={flow.rejoin_step_id ? 'rejoin' : 'terminal'}
                        onChange={(event) =>
                          handleUseCaseChange(
                            selectedDraft.use_case_id,
                            setAlternateFlowOutcomeMode(
                              selectedDraft,
                              flow.flow_id,
                              event.target.value as 'rejoin' | 'terminal',
                            ),
                          )
                        }
                      >
                        <option value="rejoin" disabled={selectedDraft.main_flow_steps.length < 2}>
                          Quay lại luồng chính
                        </option>
                        <option value="terminal">Kết thúc quy trình</option>
                      </select>
                    </label>
                  </div>
                  {flow.rejoin_step_id ? (
                    <label className="persisted-usecase__field">
                      <span>Quay lại bước</span>
                      <select
                        value={flow.rejoin_step_id}
                        onChange={(event) =>
                          handleUseCaseChange(
                            selectedDraft.use_case_id,
                            updateAlternateFlow(selectedDraft, flow.flow_id, {
                              rejoin_step_id: event.target.value,
                              terminal_outcome: null,
                            }),
                          )
                        }
                      >
                        {selectedDraft.main_flow_steps.map((step, index) =>
                          step.step_id === flow.source_step_id ? null : (
                            <option key={step.step_id} value={step.step_id}>
                              Bước {index + 1}: {step.action}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  ) : (
                    <label className="persisted-usecase__field">
                      <span>Kết quả khi kết thúc nhánh</span>
                      <textarea
                        rows={2}
                        value={flow.terminal_outcome ?? ''}
                        onChange={(event) =>
                          handleUseCaseChange(
                            selectedDraft.use_case_id,
                            updateAlternateFlow(selectedDraft, flow.flow_id, {
                              rejoin_step_id: null,
                              terminal_outcome: event.target.value,
                            }),
                          )
                        }
                      />
                    </label>
                  )}
                </details>

                <div className="persisted-usecase__nested-steps">
                  {flow.steps.map((step, stepIndex) => (
                    <article className="persisted-usecase__step-card persisted-usecase__step-card--nested" key={step.step_id}>
                      <div className="persisted-usecase__step-summary">
                        <div className="persisted-usecase__step-copy">
                          <div className="persisted-usecase__step-kicker">
                            <strong>Bước nhánh {stepIndex + 1}</strong>
                            <span>{step.actor_ref}</span>
                          </div>
                          <p className="persisted-usecase__step-action">
                            {step.action || 'Chưa mô tả hành động cho bước nhánh này.'}
                          </p>
                          <p className="persisted-usecase__step-result">
                            {step.expected_result || 'Chưa có kết quả mong đợi.'}
                          </p>
                        </div>
                        <div className="persisted-usecase__step-rail">
                          <button
                            type="button"
                            className="toolbar-btn"
                            disabled={stepIndex === 0}
                            onClick={() =>
                              handleUseCaseChange(
                                selectedDraft.use_case_id,
                                moveAlternateStep(selectedDraft, flow.flow_id, step.step_id, -1),
                              )
                            }
                          >
                            Lên
                          </button>
                          <button
                            type="button"
                            className="toolbar-btn"
                            disabled={stepIndex === flow.steps.length - 1}
                            onClick={() =>
                              handleUseCaseChange(
                                selectedDraft.use_case_id,
                                moveAlternateStep(selectedDraft, flow.flow_id, step.step_id, 1),
                              )
                            }
                          >
                            Xuống
                          </button>
                          <button
                            type="button"
                            className="toolbar-btn danger"
                            disabled={flow.steps.length <= 1}
                            onClick={() =>
                              handleUseCaseChange(
                                selectedDraft.use_case_id,
                                removeAlternateStep(selectedDraft, flow.flow_id, step.step_id),
                              )
                            }
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                      <details className="persisted-usecase__editor-panel">
                        <summary>Chỉnh bước nhánh</summary>
                        <div className="persisted-usecase__field-grid">
                          <label className="persisted-usecase__field">
                            <span>Actor thực hiện</span>
                            <select
                              value={step.actor_ref}
                              onChange={(event) =>
                                handleUseCaseChange(
                                  selectedDraft.use_case_id,
                                  updateAlternateStep(selectedDraft, flow.flow_id, step.step_id, {
                                    actor_ref: event.target.value,
                                  }),
                                )
                              }
                            >
                              {actorOptions.map((actor) => (
                                <option key={actor} value={actor}>
                                  {actor}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="persisted-usecase__field persisted-usecase__field--wide">
                            <span>Hành động</span>
                            <textarea
                              rows={3}
                              value={step.action}
                              onChange={(event) =>
                                handleUseCaseChange(
                                  selectedDraft.use_case_id,
                                  updateAlternateStep(selectedDraft, flow.flow_id, step.step_id, {
                                    action: event.target.value,
                                  }),
                                )
                              }
                            />
                          </label>
                        </div>
                        <div className="persisted-usecase__field-grid">
                          <label className="persisted-usecase__field">
                            <span>Đầu vào hoặc kích hoạt</span>
                            <textarea
                              rows={2}
                              value={step.input_or_trigger ?? ''}
                              onChange={(event) =>
                                handleUseCaseChange(
                                  selectedDraft.use_case_id,
                                  updateAlternateStep(selectedDraft, flow.flow_id, step.step_id, {
                                    input_or_trigger: event.target.value,
                                  }),
                                )
                              }
                            />
                          </label>
                          <label className="persisted-usecase__field">
                            <span>Kết quả mong đợi</span>
                            <textarea
                              rows={2}
                              value={step.expected_result}
                              onChange={(event) =>
                                handleUseCaseChange(
                                  selectedDraft.use_case_id,
                                  updateAlternateStep(selectedDraft, flow.flow_id, step.step_id, {
                                    expected_result: event.target.value,
                                  }),
                                )
                              }
                            />
                          </label>
                        </div>
                      </details>
                    </article>
                  ))}
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() =>
                      handleUseCaseChange(
                        selectedDraft.use_case_id,
                        addAlternateStep(selectedDraft, flow.flow_id),
                      )
                    }
                  >
                    Thêm bước nhánh
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="usecase-panel__empty">Chưa có luồng thay thế cho use case này.</p>
        )}
        </article>

        <article className="persisted-usecase__section">
          <div className="persisted-usecase__section-heading">
            <div>
              <h3>Kết quả và bước tiếp theo</h3>
              <p>Tóm tắt trạng thái review và hành động cần làm tiếp theo.</p>
            </div>
          </div>
          <dl className="persisted-usecase__fact-grid">
            <div>
              <dt>Kết quả thành công</dt>
              <dd>{selectedDraft.success_outcome || 'Chưa mô tả kết quả thành công.'}</dd>
            </div>
            <div>
              <dt>Bước tiếp theo</dt>
              <dd>{nextActionCopy(selectedDraft.review_status, diagramLifecycle.status)}</dd>
            </div>
          </dl>
          <details className="persisted-usecase__editor-panel">
            <summary>Chỉnh kết quả thành công</summary>
            <label className="persisted-usecase__field">
              <span>Kết quả thành công</span>
              <textarea
                rows={3}
                value={selectedDraft.success_outcome}
                onChange={(event) =>
                  handleUseCaseChange(selectedDraft.use_case_id, {
                    ...selectedDraft,
                    success_outcome: event.target.value,
                  })
                }
              />
            </label>
          </details>
        </article>

        <div className="persisted-usecase__footer">
          {contractIssues.length > 0 ? (
            <ul className="usecase-panel__validation-list">
              {contractIssues.map((issue) => (
                <li key={`${issue.path}:${issue.message}`}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
          {useCaseError ? <p className="workspace-error">{useCaseError}</p> : null}
          <div className="workspace-header__actions">
            {selectedDraft.review_status === 'draft' ? (
              <button
                className="workspace-button"
                type="button"
                disabled={contractIssues.length > 0}
                onClick={() =>
                  handleReviewStatusChange(selectedDraft.use_case_id, 'reviewed')
                }
              >
                Đánh dấu đã rà soát
              </button>
            ) : null}
            {selectedDraft.review_status === 'reviewed' ? (
              <button
                className="workspace-button primary"
                type="button"
                disabled={contractIssues.length > 0}
                onClick={() =>
                  handleReviewStatusChange(selectedDraft.use_case_id, 'approved')
                }
              >
                Phê duyệt
              </button>
            ) : null}
            {selectedDraft.review_status !== 'draft' ? (
              <button
                className="workspace-button"
                type="button"
                onClick={() => handleReviewStatusChange(selectedDraft.use_case_id, 'draft')}
              >
                Đưa về nháp
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </section>
  );
}

function resourceDrafts(resources: UseCaseResource[]) {
  return resources.map((resource) => canonicalizeUseCaseDraft(resource.content));
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinLines(values: string[]) {
  return values.join('\n');
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="usecase-panel__readonly-field">
      <span>{label}</span>
      <p>{value || 'Chưa có'}</p>
    </div>
  );
}

function uniqueLines(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function updateUseCaseActors(useCase: UseCaseDraft, nextActors: string[]): UseCaseDraft {
  const actors = uniqueLines(nextActors);
  const nextPrimaryActor = actors[0] ?? '';
  const nextUseCase =
    nextPrimaryActor !== useCase.primary_actor
      ? migratePrimaryActor(useCase, nextPrimaryActor)
      : useCase;
  return {
    ...nextUseCase,
    primary_actor: nextPrimaryActor,
    supporting_actors: actors.slice(1),
  };
}

function reviewStatusPillLabel(status: UseCaseDraft['review_status']) {
  switch (status) {
    case 'reviewed':
      return 'Đã rà soát';
    case 'approved':
      return 'Đã phê duyệt';
    default:
      return 'Nháp';
  }
}

function fallbackSourceCopy(reason?: string | null) {
  if (reason === 'quality_rejected') {
    return 'Kết quả AI chưa đạt quality gate. Hãy rà soát chi tiết nghiệp vụ.';
  }
  if (reason === 'provider_failure' || reason === 'provider_unavailable') {
    return 'AI tạm thời không khả dụng. Hãy rà soát chi tiết nghiệp vụ.';
  }
  if (reason === 'shadow_mode') {
    return 'AI chỉ chạy đánh giá nền; kết quả hiển thị vẫn theo rule.';
  }
  if (reason === 'ai_not_enabled') {
    return 'Rollout hiện không bật AI cho lần sinh này, nên hệ thống dùng deterministic path.';
  }
  return 'Kết quả được tạo theo rule và cần được rà soát trước khi phê duyệt.';
}

function activeDiagramSummary(useCase: UseCaseDraft, treeUseCase: ArtifactTreeUseCase | null) {
  const lifecycle = deriveUseCaseDiagramLifecycle({
    reviewStatus: useCase.review_status,
    artifactState: derivePersistedDiagramArtifactState(treeUseCase),
    isActiveOnCanvas: false,
  });
  return lifecycle.note;
}

function derivePersistedDiagramArtifactState(
  treeUseCase: ArtifactTreeUseCase | null | undefined,
): UseCaseDiagramArtifactState {
  if (!treeUseCase?.diagram) return 'not_started';
  if (treeUseCase.diagram.semantic_edited) return 'diverged';
  if (treeUseCase.diagram.is_outdated) return 'outdated';
  return 'ready';
}

function describeMainStep(useCase: UseCaseDraft, stepId: string) {
  const index = useCase.main_flow_steps.findIndex((step) => step.step_id === stepId);
  if (index < 0) return 'bước không xác định';
  return `Bước ${index + 1}`;
}

function nextActionCopy(
  reviewStatus: UseCaseDraft['review_status'],
  diagramStatus: ReturnType<typeof deriveUseCaseDiagramLifecycle>['status'],
) {
  if (reviewStatus === 'draft') {
    return 'Rà soát nội dung chính rồi đánh dấu đã rà soát trước khi phê duyệt.';
  }
  if (reviewStatus === 'reviewed') {
    return 'Phê duyệt Use Case này để mở đường sang Diagram.';
  }
  if (diagramStatus === 'ready_to_open') {
    return 'Diagram đã sẵn sàng để mở và tiếp tục chỉnh sửa trên canvas.';
  }
  if (diagramStatus === 'outdated' || diagramStatus === 'diverged') {
    return 'Tạo lại diagram để đồng bộ hóa Use Case với artifact downstream.';
  }
  return 'Lưu nội dung mới nhất rồi tạo diagram tương ứng cho Use Case này.';
}

function GenerationMetadataCard({
  metadata,
  requestId,
  compact = false,
}: {
  metadata: ResponseMetadata;
  requestId?: string | null;
  compact?: boolean;
}) {
  const sourceLabel =
    metadata.generation_source === 'ai' ? 'Bản nháp AI' : 'Bản nháp theo rule';
  const providerModel = [metadata.provider, metadata.model].filter(Boolean).join(' · ');
  const promptLabel =
    metadata.prompt_id && metadata.prompt_version
      ? `Prompt ${metadata.prompt_id}@${metadata.prompt_version}`
      : null;
  const modeLabel = metadata.generation_mode ? `Mode ${metadata.generation_mode}` : null;
  const qualityLabel = metadata.quality_status ? `Quality ${metadata.quality_status}` : null;
  const note =
    metadata.generation_source === 'deterministic_fallback'
      ? fallbackSourceCopy(metadata.fallback_reason)
      : 'Đã dùng semantic synthesis theo cấu hình hiện tại của project.';

  return (
    <section
      className={`persisted-usecase__generation-card${
        compact ? ' persisted-usecase__generation-card--compact' : ''
      }`}
      aria-label="Thông tin lần sinh use case gần nhất"
    >
      <div className="persisted-usecase__generation-header">
        <div>
          <p className="persisted-usecase__generation-kicker">Lần sinh gần nhất</p>
          <div className="persisted-usecase__generation-source">
            <span
              className={`usecase-panel__source-badge usecase-panel__source-badge--${metadata.generation_source}`}
            >
              {sourceLabel}
            </span>
            {requestId ? (
              <span className="persisted-usecase__generation-request">Request {requestId}</span>
            ) : null}
          </div>
        </div>
        {typeof metadata.attempt_count === 'number' ? (
          <span className="persisted-usecase__generation-attempts">
            {metadata.attempt_count} attempt{metadata.attempt_count === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      <p className="persisted-usecase__generation-note">{note}</p>
      <div className="persisted-usecase__generation-details">
        {providerModel ? <span>{providerModel}</span> : null}
        {promptLabel ? <span>{promptLabel}</span> : null}
        {modeLabel ? <span>{modeLabel}</span> : null}
        {qualityLabel ? <span>{qualityLabel}</span> : null}
        {typeof metadata.latency_ms === 'number' ? <span>{metadata.latency_ms} ms</span> : null}
        {typeof metadata.estimated_cost_usd === 'number' ? (
          <span>~ ${metadata.estimated_cost_usd.toFixed(2)}</span>
        ) : null}
      </div>
    </section>
  );
}
