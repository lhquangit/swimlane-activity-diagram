import { useEffect, useState } from 'react';

import type { ResponseMetadata } from '../brd/types';
import type { WorkspacePersistence } from '../persistence/WorkspaceContext';
import { useWorkspacePersistence } from '../persistence/WorkspaceContext';
import type {
  ArtifactTreeUseCase,
  UseCaseGenerationRuntime,
  UseCaseResource,
} from '../persistence/types';
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
  const [useCaseError, setUseCaseError] = useState<string | null>(null);
  const [pendingGenerationMetadata, setPendingGenerationMetadata] =
    useState<ResponseMetadata | null>(workspace?.pendingUseCaseGenerationMetadata ?? null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [diagramActionPending, setDiagramActionPending] = useState(false);
  const [deleteActionPending, setDeleteActionPending] = useState(false);
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
    setPendingGenerationMetadata(workspace.pendingUseCaseGenerationMetadata ?? null);
  }, [
    workspace,
    workspace?.activeFeature.id,
    workspace?.pendingUseCaseGenerationMetadata,
  ]);

  useEffect(() => {
    setDiagramActionPending(false);
    setDeleteActionPending(false);
  }, [activeUseCaseResource?.id, mode]);

  if (!workspace) return null;

  const validationErrors = runLocalUseCasePreValidation(
    workspace.projectSpec,
    workspace.featureIntent,
  );
  const generationRuntime = workspace.activeFeature.usecase_generation_runtime ?? null;
  const effectiveGenerationPreference: UseCaseGenerationPreference = 'ai';
  const diagramBlockedBySaveState =
    workspace.useCaseSaveState === 'dirty' ||
    workspace.useCaseSaveState === 'saving' ||
    workspace.useCaseSaveState === 'failed';
  const selectedDraft =
    activeUseCaseResource == null
      ? null
      : useCaseDrafts.find((useCase) => useCase.use_case_id === activeUseCaseResource.use_case_key) ??
        canonicalizeUseCaseDraft(activeUseCaseResource.content);
  const canGenerate =
    !isGenerating && validationErrors.length === 0 && generationRuntime?.can_generate === true;
  const canPersistSelected = Boolean(selectedDraft && activeUseCaseResource);
  const canPersistDraftList =
    useCaseDrafts.length > 0 && workspace.useCaseSaveState !== 'saving' && !isGenerating;
  const generationMetadata =
    pendingGenerationMetadata ?? workspace.activeFeature.latest_usecase_generation ?? null;
  const generationPending = pendingGenerationMetadata != null;

  const persistDraftList = async (
    drafts: UseCaseDraft[],
    generationMetadataToCommit: ResponseMetadata | null = pendingGenerationMetadata,
  ) => {
    await workspace.saveUseCases(drafts, {
      generationMetadata: generationMetadataToCommit,
    });
    await workspace.refreshArtifactTree();
    setHasUnsavedGeneratedDrafts(false);
    setUseCaseError(null);
    setPendingGenerationMetadata(null);
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
      const envelope = await workspace.generateUseCases(effectiveGenerationPreference);
      const result = envelope.result;
      if (!result) {
        throw new Error('Use case generation trả về kết quả rỗng.');
      }
      const generatedDrafts = result.use_cases.map(canonicalizeUseCaseDraft);
      setUseCaseDrafts(generatedDrafts);
      setHasUnsavedGeneratedDrafts(true);
      setPendingGenerationMetadata(envelope.metadata ?? null);

      await persistDraftList(generatedDrafts, envelope.metadata ?? null);
      setUseCaseDrafts(generatedDrafts);
      setUseCaseError(null);
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
      await persistDraftList(useCaseDrafts, pendingGenerationMetadata);
    } catch (error) {
      setUseCaseError(
        error instanceof Error ? error.message : 'Không thể lưu danh sách use case hiện tại.',
      );
    }
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
        generationMetadata: pendingGenerationMetadata,
        labelsByBusinessKey: {
          [selectedDraft.use_case_id]: selectedDraft.title || selectedDraft.use_case_id,
        },
      });
      await workspace.refreshArtifactTree();
    } catch (error) {
      setUseCaseError(error instanceof Error ? error.message : 'Không thể lưu Use Case.');
    }
  };

  const handleGenerateDiagram = async () => {
    if (!selectedDraft || !activeUseCaseResource) return;
    if (diagramActionPending) return;
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
    setDiagramActionPending(true);
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
    } finally {
      setDiagramActionPending(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedDraft) return;
    const confirmed = window.confirm(
      `Xóa use case "${selectedDraft.title}"? Diagram và BRD đã lưu bên dưới use case này cũng sẽ bị xóa.`,
    );
    if (!confirmed) return;
    setUseCaseError(null);
    setDeleteActionPending(true);
    try {
      await workspace.deleteUseCase(selectedDraft.use_case_id);
    } catch (error) {
      setUseCaseError(error instanceof Error ? error.message : 'Không thể xóa Use Case.');
      setDeleteActionPending(false);
    }
  };

  if (mode === 'list') {
    return (
      <section className="usecase-workspace-page">
        <div className="workspace-section-heading">
          <div>
            <h2>Use Cases</h2>
            <p>Sinh và rà soát danh sách use case cho feature hiện tại.</p>
          </div>
          <div className="workspace-header__actions">
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
              {isGenerating
                ? 'Đang sinh và lưu…'
                : generationCtaLabel(generationRuntime)}
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
            <p className="persisted-usecase__runtime-note">{generationRuntimeNote(generationRuntime)}</p>
            {generationMetadata ? (
              <GenerationMetadataCard
                metadata={generationMetadata}
                isPending={generationPending}
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
              Danh sách vừa sinh chưa được lưu. Hãy lưu trước khi tiếp tục các bước tiếp theo.
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
                      {!resource ? (
                        <span className="usecase-card__pending-pill">Chưa persist</span>
                      ) : null}
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
      issues.length === 0 &&
      !diagramBlockedBySaveState;
    const createDiagramLabel = diagramBlockedBySaveState
      ? diagramBlockedBySaveStateLabel(workspace.useCaseSaveState)
      : 'Tạo diagram';
    return (
      <section className="workspace-empty artifact-state">
        <h2>Diagram chưa tạo</h2>
        <p>
          {selectedDraft
            ? `Use Case ${selectedDraft.use_case_id} chưa có diagram đã lưu.`
            : 'Diagram cho Use Case này chưa tồn tại.'}
        </p>
        {selectedDraft ? (
          <p>
            {diagramBlockedBySaveState
              ? diagramBlockedBySaveStateHint(workspace.useCaseSaveState)
              : selectedDraft.review_status === 'approved'
              ? 'Use Case đã sẵn sàng để tạo diagram.'
              : 'Hãy lưu và phê duyệt Use Case trước khi tạo diagram.'}
          </p>
        ) : null}
        {useCaseError ? <p className="workspace-error">{useCaseError}</p> : null}
        <div className="workspace-header__actions">
          <button
            className="workspace-button primary"
            type="button"
            onClick={() => void handleGenerateDiagram()}
            disabled={!canCreateDiagram || diagramActionPending}
          >
            {diagramActionPending ? 'Đang tạo diagram…' : createDiagramLabel}
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
  const canGenerateDiagram =
    diagramLifecycle.status === 'ready_to_generate' ||
    diagramLifecycle.status === 'outdated' ||
    diagramLifecycle.status === 'diverged';
  const diagramActionLabel =
    diagramLifecycle.status === 'outdated' || diagramLifecycle.status === 'diverged'
      ? 'Tạo lại diagram'
      : 'Tạo diagram';
  const diagramCtaLabel = diagramBlockedBySaveState
    ? diagramBlockedBySaveStateLabel(workspace.useCaseSaveState)
    : diagramActionLabel;
  const actorOptions = [selectedDraft.primary_actor, ...selectedDraft.supporting_actors].filter(
    Boolean,
  );

  return (
    <section className="usecase-workspace-page persisted-usecase">
      <div className="workspace-section-heading">
        <div>
          <h2>Use Case</h2>
          <p>Rà soát và chỉnh nội dung use case hiện tại.</p>
        </div>
        <div className="workspace-header__actions">
          <span className={`usecase-card__status usecase-card__status--${selectedDraft.review_status}`}>
            {reviewStatusPillLabel(selectedDraft.review_status)}
          </span>
          <button
            className="workspace-button danger"
            type="button"
            onClick={() => void handleDeleteSelected()}
            disabled={deleteActionPending}
          >
            {deleteActionPending ? 'Đang xóa…' : 'Xóa use case'}
          </button>
          <button
            className="workspace-button primary"
            type="button"
            onClick={() => void handleSaveSelected()}
            disabled={
              !canPersistSelected ||
              workspace.useCaseSaveState === 'saving' ||
              deleteActionPending
            }
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
            {canGenerateDiagram ? (
              <button
                className="workspace-button primary"
                type="button"
                onClick={() => void handleGenerateDiagram()}
                disabled={
                  diagramActionPending ||
                  diagramBlockedBySaveState ||
                  selectedDraft.review_status !== 'approved' ||
                  contractIssues.length > 0
                }
              >
                {diagramActionPending ? 'Đang tạo diagram…' : diagramCtaLabel}
              </button>
            ) : null}
            {canGenerateDiagram && diagramBlockedBySaveState ? (
              <p className="persisted-usecase__hero-helper">
                {diagramBlockedBySaveStateHint(workspace.useCaseSaveState)}
              </p>
            ) : null}
          </div>
        </header>

        <p className="persisted-usecase__hero-note">{diagramLifecycle.note}</p>
        {generationMetadata ? (
          <GenerationMetadataCard
            metadata={generationMetadata}
            isPending={generationPending}
          />
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

function diagramBlockedBySaveStateLabel(saveState: WorkspacePersistence['useCaseSaveState']) {
  if (saveState === 'saving') return 'Đợi lưu Use Case xong';
  if (saveState === 'failed') return 'Lưu lại Use Case trước';
  return 'Lưu Use Case trước';
}

function diagramBlockedBySaveStateHint(saveState: WorkspacePersistence['useCaseSaveState']) {
  if (saveState === 'saving') {
    return 'Đợi lưu Use Case hiện tại xong rồi tạo hoặc tạo lại diagram.';
  }
  if (saveState === 'failed') {
    return 'Cần lưu lại Use Case thành công trước khi tạo hoặc tạo lại diagram.';
  }
  return 'Lưu Use Case mới nhất trước khi tạo hoặc tạo lại diagram.';
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
  isPending = false,
  compact = false,
}: {
  metadata: ResponseMetadata;
  isPending?: boolean;
  compact?: boolean;
}) {
  const sourceLabel =
    metadata.generation_source === 'ai' ? 'Bản nháp AI' : 'Bản nháp degraded';
  const note =
    isPending
      ? 'Bản nháp mới nhất chưa được lưu.'
      : metadata.generation_source === 'deterministic_fallback'
        ? fallbackDraftNote(metadata.fallback_reason)
        : 'Bản nháp hiện tại được tạo bằng AI.';

  return (
    <section
      className={`persisted-usecase__generation-card${
        compact ? ' persisted-usecase__generation-card--compact' : ''
      }`}
      aria-label="Thông tin lần sinh use case gần nhất"
    >
      <div className="persisted-usecase__generation-header">
        <div className="persisted-usecase__generation-source">
          <span
            className={`usecase-panel__source-badge usecase-panel__source-badge--${metadata.generation_source}`}
          >
            {sourceLabel}
          </span>
        </div>
      </div>
      <p className="persisted-usecase__generation-note">{note}</p>
    </section>
  );
}

function generationCtaLabel(runtime: UseCaseGenerationRuntime | null) {
  if (runtime?.can_generate === false) {
    return 'AI chưa khả dụng';
  }
  return 'Sinh use case bằng AI';
}

function generationRuntimeNote(runtime: UseCaseGenerationRuntime | null) {
  if (!runtime) {
    return 'Không xác định được trạng thái AI authoring của môi trường này.';
  }
  return runtime.note;
}

function fallbackDraftNote(reason: string | null | undefined) {
  if (reason === 'USECASE_AI_PROVIDER_FAILURE') {
    return 'Bản nháp này đến từ lần sinh AI bị lỗi provider. Không nên dùng để BA review.';
  }
  if (reason === 'USECASE_AI_OUTPUT_REJECTED') {
    return 'Bản nháp này đến từ lần sinh AI không qua quality gate. Không nên dùng làm output cuối.';
  }
  return 'Bản nháp này là dữ liệu fallback cũ từ contract trước đây. Không nên dùng để BA review.';
}
