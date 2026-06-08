import { useEffect, useState } from 'react';

import type {
  ArtifactChainItem,
  FeatureIntent,
  OrphanedDiagramInventoryItem,
  ProjectSpec,
  UseCaseDiagramInventoryItem,
  UseCaseDraft,
  UseCaseGenerationPreference,
  UseCasePanelPhase,
  UseCaseWorkspaceSection,
} from './types';
import type { ResponseMetadata } from '../brd/types';
import type { SaveState } from '../persistence/types';
import { diagramStatusLabel } from './lifecycle';
import { migratePrimaryActor, validateUseCaseContract } from './contract';
import { collectUseCaseActors } from './prevalidate';
import {
  addAlternateFlow,
  addAlternateStep,
  addMainStep,
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

type UseCasePanelProps = {
  open: boolean;
  phase: UseCasePanelPhase;
  activeSection: UseCaseWorkspaceSection;
  projectSpec: ProjectSpec;
  featureIntent: FeatureIntent;
  useCases: UseCaseDraft[];
  focusedUseCaseId?: string | null;
  diagramInventory: UseCaseDiagramInventoryItem[];
  orphanedDiagrams: OrphanedDiagramInventoryItem[];
  artifactChain: ArtifactChainItem[];
  requestId: string | null;
  metadata?: ResponseMetadata | null;
  generationPreference?: UseCaseGenerationPreference;
  errorMessage: string | null;
  validationErrors: string[];
  isOutdated: boolean;
  hasDraftChanges: boolean;
  onClose: () => void;
  onGenerate: () => void;
  onSave?: () => void;
  saveState?: SaveState;
  sourceMode?: 'standalone' | 'persisted';
  onEditProjectSpec?: () => void;
  onEditFeatureIntent?: () => void;
  onDeleteUseCase?: (useCaseId: string) => void;
  onGenerationPreferenceChange?: (next: UseCaseGenerationPreference) => void;
  onSectionChange: (section: UseCaseWorkspaceSection) => void;
  onProjectSpecChange: (next: ProjectSpec) => void;
  onFeatureIntentChange: (next: FeatureIntent) => void;
  onUseCaseChange: (useCaseId: string, next: UseCaseDraft) => void;
  onReviewStatusChange: (
    useCaseId: string,
    next: UseCaseDraft['review_status'],
  ) => void;
  onApproveAll: () => void;
  onOpenDiagramWorkspace: (useCaseId: string) => void;
  onGenerateDiagram: (useCaseId: string) => void;
  onOpenDiagramCanvas: (useCaseId: string) => void;
  onDiscardOrphanedDiagram: (useCaseId: string) => void;
};

export default function UseCasePanel({
  open,
  phase,
  activeSection,
  projectSpec,
  featureIntent,
  useCases,
  focusedUseCaseId = null,
  diagramInventory,
  orphanedDiagrams,
  artifactChain,
  requestId,
  metadata = null,
  generationPreference = 'auto',
  errorMessage,
  validationErrors,
  isOutdated,
  hasDraftChanges,
  onClose,
  onGenerate,
  onSave,
  saveState = 'idle',
  sourceMode = 'standalone',
  onEditProjectSpec,
  onEditFeatureIntent,
  onDeleteUseCase,
  onGenerationPreferenceChange,
  onSectionChange,
  onProjectSpecChange,
  onFeatureIntentChange,
  onUseCaseChange,
  onReviewStatusChange,
  onApproveAll,
  onOpenDiagramWorkspace,
  onGenerateDiagram,
  onOpenDiagramCanvas,
  onDiscardOrphanedDiagram,
}: UseCasePanelProps) {
  const actors = collectUseCaseActors(projectSpec, featureIntent);
  const canonicalActorsInputValue = joinLines(actors);
  const [actorsInputValue, setActorsInputValue] = useState(canonicalActorsInputValue);

  useEffect(() => {
    setActorsInputValue(canonicalActorsInputValue);
  }, [canonicalActorsInputValue]);

  if (!open) return null;
  const contractIssuesByUseCase = Object.fromEntries(
    useCases.map((useCase) => [
      useCase.use_case_id,
      validateUseCaseContract(useCase),
    ]),
  );
  const hasInvalidUseCase = Object.values(contractIssuesByUseCase).some(
    (issues) => issues.length > 0,
  );
  const rulesAndConstraints = uniqueLines([
    ...projectSpec.business_rules,
    ...featureIntent.constraints,
  ]);
  const isPersistedSource = sourceMode === 'persisted';

  return (
    <aside className="usecase-panel" aria-label="Không gian use case">
      <div className="usecase-panel__header">
        <div>
          <h2>Không gian use case</h2>
          <p>{phaseLabel(phase)}</p>
        </div>
        <div className="usecase-panel__header-actions">
          {onSave && activeSection !== 'input' ? (
            <button
              className="toolbar-btn primary"
              onClick={onSave}
              disabled={saveState === 'saving' || useCases.length === 0}
            >
              {saveState === 'saving'
                ? 'Đang lưu…'
                : saveState === 'saved'
                  ? 'Đã lưu'
                  : saveState === 'failed'
                    ? 'Lưu lại'
                    : 'Lưu use case'}
            </button>
          ) : null}
          <button className="toolbar-btn" onClick={onClose} aria-label="Đóng không gian use case">
            Đóng
          </button>
        </div>
      </div>

      <div className="usecase-panel__body">
        <nav className="usecase-panel__tabs" aria-label="Các vùng trong không gian use case">
          {WORKSPACE_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`usecase-panel__tab ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => onSectionChange(section.id)}
            >
              <span>{section.label}</span>
              <small>{section.helper}</small>
            </button>
          ))}
        </nav>

        {isOutdated ? (
          <section className="usecase-panel__banner">
            <p>
              Spec dự án hoặc intent chức năng đã đổi sau lần sinh gần nhất. Danh sách use case
              hiện tại có thể không còn khớp.
            </p>
          </section>
        ) : null}
        {hasDraftChanges ? (
          <section className="usecase-panel__banner">
            <p>
              Use case hiện tại đã khác snapshot sinh gần nhất. Không gian này sẽ hỏi lại trước khi
              ghi đè.
            </p>
          </section>
        ) : null}

        {activeSection === 'input' ? (
          <section className="usecase-panel__workspace-section">
            <div className="usecase-panel__section-intro">
              <h3>Đầu vào</h3>
              <p>
                Mô tả chức năng, actors và kết quả cần đạt để sinh danh sách use case.
              </p>
            </div>

            <div className="usecase-panel__stack">
              {isPersistedSource ? (
                <section className="usecase-panel__card usecase-panel__readonly-card">
                  <div className="usecase-panel__section-header">
                    <div>
                      <h4>Feature Intent đã lưu</h4>
                      <p>Use case được sinh từ Feature Intent mới nhất trong tab Features.</p>
                    </div>
                    <button className="toolbar-btn" type="button" onClick={onEditFeatureIntent}>
                      Sửa Feature Intent
                    </button>
                  </div>
                  <ReadonlyField label="Tên chức năng" value={featureIntent.feature_name} />
                  <ReadonlyField label="Mô tả chức năng" value={featureIntent.feature_summary} />
                  <ReadonlyField label="Actors / swimlanes" value={joinLines(actors)} />
                  <ReadonlyField label="Điều gì bắt đầu quy trình?" value={featureIntent.trigger ?? 'Chưa có'} />
                  <ReadonlyField label="Dữ liệu vào" value={joinLines(featureIntent.inputs) || 'Chưa có'} />
                  <ReadonlyField label="Dữ liệu đầu ra" value={joinLines(featureIntent.outputs) || 'Chưa có'} />
                  <ReadonlyField label="Quy tắc và ràng buộc" value={joinLines(rulesAndConstraints) || 'Chưa có'} />
                  <ReadonlyField label="Kết quả mong muốn" value={featureIntent.success_outcome ?? 'Chưa có'} />
                </section>
              ) : (
                <section className="usecase-panel__card">
                  <div className="usecase-panel__section-header">
                    <div>
                      <h4>Chức năng cần mô hình hóa</h4>
                      <p>Nhập các actor/swimlane tham gia trực tiếp vào quy trình.</p>
                    </div>
                  </div>
                  <label>
                    <span>Tên chức năng</span>
                    <input
                      value={featureIntent.feature_name}
                      onChange={(event) =>
                        onFeatureIntentChange({
                          ...featureIntent,
                          feature_name: event.target.value,
                        })
                      }
                      placeholder="VD: Cấp phát thiết bị GPS"
                    />
                  </label>
                  <label>
                    <span>Mô tả chức năng</span>
                    <textarea
                      rows={3}
                      value={featureIntent.feature_summary}
                      onChange={(event) =>
                        onFeatureIntentChange({
                          ...featureIntent,
                          feature_summary: event.target.value,
                        })
                      }
                      placeholder="Mô tả chức năng muốn build."
                    />
                  </label>
                  <label>
                    <span>Actors / swimlanes (mỗi dòng một actor)</span>
                    <textarea
                      rows={4}
                      value={actorsInputValue}
                      onChange={(event) => {
                        const nextInputValue = event.target.value;
                        const nextActors = splitLines(nextInputValue);
                        setActorsInputValue(nextInputValue);
                        onFeatureIntentChange({
                          ...featureIntent,
                          actors: nextActors,
                          primary_actor: nextActors[0] ?? '',
                        });
                      }}
                      placeholder={'Ban quản lý\nCư dân\nKỹ thuật viên'}
                    />
                  </label>
                  <label>
                    <span>Kết quả mong muốn</span>
                    <textarea
                      rows={2}
                      value={featureIntent.success_outcome ?? ''}
                      onChange={(event) =>
                        onFeatureIntentChange({
                          ...featureIntent,
                          success_outcome: event.target.value,
                        })
                      }
                      placeholder="Kết quả thành công mong muốn."
                    />
                  </label>

                  <label>
                    <span>Điều gì bắt đầu quy trình?</span>
                    <input
                      value={featureIntent.trigger ?? ''}
                      onChange={(event) =>
                        onFeatureIntentChange({
                          ...featureIntent,
                          trigger: event.target.value,
                        })
                      }
                      placeholder="VD: Có yêu cầu hợp lệ"
                    />
                  </label>
                  <label>
                    <span>Dữ liệu vào (mỗi dòng một mục)</span>
                    <textarea
                      rows={3}
                      value={joinLines(featureIntent.inputs)}
                      onChange={(event) =>
                        onFeatureIntentChange({
                          ...featureIntent,
                          inputs: splitLines(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Dữ liệu đầu ra (mỗi dòng một mục)</span>
                    <textarea
                      rows={3}
                      value={joinLines(featureIntent.outputs)}
                      onChange={(event) =>
                        onFeatureIntentChange({
                          ...featureIntent,
                          outputs: splitLines(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Quy tắc và ràng buộc (mỗi dòng một mục)</span>
                    <textarea
                      rows={3}
                      value={joinLines(rulesAndConstraints)}
                      onChange={(event) => {
                        const next = splitLines(event.target.value);
                        onProjectSpecChange({
                          ...projectSpec,
                          business_rules: [],
                        });
                        onFeatureIntentChange({
                          ...featureIntent,
                          constraints: next,
                        });
                      }}
                    />
                  </label>
                </section>
              )}

              <section className="usecase-panel__project-context" aria-label="Bối cảnh dự án">
                <div className="usecase-panel__project-context-header">
                  <div>
                    <span>ProjectSpec</span>
                    <h4>Bối cảnh dự án</h4>
                    <p>Nền nghiệp vụ dùng chung cho các use case trong workspace.</p>
                  </div>
                  <strong>{projectSpec.project_name || 'Chưa đặt tên'}</strong>
                </div>
                {isPersistedSource ? (
                  <div className="usecase-panel__project-context-fields">
                    <ReadonlyField label="Tên dự án" value={projectSpec.project_name} />
                    <ReadonlyField label="Mô tả bối cảnh" value={projectSpec.project_summary} />
                    <button className="toolbar-btn" type="button" onClick={onEditProjectSpec}>
                      Sửa Project Spec
                    </button>
                  </div>
                ) : (
                  <div className="usecase-panel__project-context-fields">
                    <label>
                      <span>Tên dự án</span>
                      <input
                        value={projectSpec.project_name}
                        onChange={(event) =>
                          onProjectSpecChange({
                            ...projectSpec,
                            project_name: event.target.value,
                          })
                        }
                        placeholder="VD: Smart Diagram"
                      />
                    </label>
                    <label>
                      <span>Mô tả bối cảnh</span>
                      <textarea
                        rows={3}
                        value={projectSpec.project_summary}
                        onChange={(event) =>
                          onProjectSpecChange({
                            ...projectSpec,
                            project_summary: event.target.value,
                            business_context: null,
                          })
                        }
                        placeholder="VD: Nền tảng quản lý cư dân, dịch vụ nội khu và yêu cầu vận hành."
                      />
                    </label>
                  </div>
                )}
              </section>
            </div>

            <div className="usecase-panel__actions">
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
                    onClick={() => onGenerationPreferenceChange?.(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                className="toolbar-btn primary"
                onClick={onGenerate}
                disabled={phase === 'generating' || validationErrors.length > 0}
              >
                {phase === 'generating' ? 'Đang sinh…' : 'Sinh use case'}
              </button>
              {onSave ? (
                <button
                  className="toolbar-btn primary"
                  onClick={onSave}
                  disabled={saveState === 'saving' || useCases.length === 0}
                >
                  {saveState === 'saving'
                    ? 'Đang lưu…'
                    : saveState === 'saved'
                      ? 'Đã lưu'
                      : saveState === 'failed'
                        ? 'Lưu lại'
                        : 'Lưu use case'}
                </button>
              ) : null}
            </div>
            {validationErrors.length > 0 ? (
              <ul className="usecase-panel__validation-list">
                {validationErrors.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
            {errorMessage ? <p className="usecase-panel__error">{errorMessage}</p> : null}

            {artifactChain.length > 0 ? (
              <details className="usecase-panel__advanced">
                <summary>Trace kỹ thuật</summary>
                <p className="usecase-panel__advanced-copy">
                  Các artifact kỹ thuật này được giữ lại để traceability, nhưng không còn chen vào
                  flow nhập liệu chính.
                </p>
                <ul className="usecase-panel__artifact-list">
                  {artifactChain.map((artifact) => (
                    <li key={artifact.artifact_type}>
                      <strong>{artifact.label}</strong>
                      <span>
                        {artifact.source_of_truth ? 'SoT' : 'Derived'} ·{' '}
                        {artifact.human_editable ? 'Editable' : 'Read-only'}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        ) : null}

        {activeSection === 'usecases' ? (
          <section className="usecase-panel__workspace-section">
            <div className="usecase-panel__section-intro">
              <h3>Danh sách use case</h3>
              <p>
                Đây là kết quả để bạn rà soát, chỉnh sửa, và phê duyệt trước khi đi sang sơ đồ cho
                từng use case.
              </p>
            </div>
            <div className="usecase-panel__section-header">
              <div>
                <h4>Danh sách use case đã sinh</h4>
                <p>{requestId ? `Request ${requestId}` : 'Chưa có request sinh nào.'}</p>
                {metadata?.generation_source ? (
                  <div className="usecase-panel__source">
                    <span
                      className={`usecase-panel__source-badge usecase-panel__source-badge--${metadata.generation_source}`}
                    >
                      {metadata.generation_source === 'ai' ? 'Bản nháp AI' : 'Bản nháp theo rule'}
                    </span>
                    {metadata.generation_source === 'deterministic_fallback' ? (
                      <small>{fallbackSourceCopy(metadata.fallback_reason)}</small>
                    ) : (
                      <small>
                        Prompt {metadata.prompt_id}@{metadata.prompt_version}
                      </small>
                    )}
                  </div>
                ) : null}
              </div>
              {useCases.length > 0 ? (
                <button
                  className="toolbar-btn"
                  onClick={onApproveAll}
                  disabled={hasInvalidUseCase}
                  title={
                    hasInvalidUseCase
                      ? 'Sửa các lỗi contract trước khi phê duyệt tất cả.'
                      : undefined
                  }
                >
                  Phê duyệt tất cả
                </button>
              ) : null}
            </div>
            {useCases.length === 0 ? (
              <p className="usecase-panel__empty">
                Chưa có use case draft. Hoàn thành phần đầu vào rồi bấm sinh để có kết quả rà soát.
              </p>
            ) : (
              <div className="usecase-panel__cards">
                {useCases.map((useCase) => {
                  const contractIssues = contractIssuesByUseCase[useCase.use_case_id] ?? [];
                  return (
                  <article
                    key={useCase.use_case_id}
                    className={`usecase-card${focusedUseCaseId === useCase.use_case_id ? ' usecase-card--focused' : ''}`}
                    data-use-case-id={useCase.use_case_id}
                    aria-current={focusedUseCaseId === useCase.use_case_id ? 'true' : undefined}
                  >
                    <div className="usecase-card__header">
                      <div>
                        <input
                          className="usecase-card__title"
                          value={useCase.title}
                          onChange={(event) =>
                            onUseCaseChange(useCase.use_case_id, {
                              ...useCase,
                              title: event.target.value,
                            })
                          }
                        />
                        <p className="usecase-card__summary">
                          {useCase.main_flow_steps.length} bước chính ·{' '}
                          {useCase.alternate_flows.length} luồng thay thế
                          {contractIssues.length > 0
                            ? ` · ${contractIssues.length} lỗi cần sửa`
                            : ''}
                        </p>
                      </div>
                      <div className="usecase-card__header-actions">
                        <span
                          className={`usecase-card__status usecase-card__status--${useCase.review_status}`}
                        >
                          {reviewStatusPillLabel(useCase.review_status)}
                        </span>
                        {useCase.review_status === 'approved' ? (
                          <button
                            className="toolbar-btn primary"
                            onClick={() => onOpenDiagramWorkspace(useCase.use_case_id)}
                          >
                            Mở ở vùng sơ đồ
                          </button>
                        ) : (
                          <button
                            className="toolbar-btn primary"
                            disabled={contractIssues.length > 0}
                            onClick={() =>
                              onReviewStatusChange(
                                useCase.use_case_id,
                                useCase.review_status === 'draft' ? 'reviewed' : 'approved',
                              )
                            }
                          >
                            {useCase.review_status === 'draft'
                              ? 'Đánh dấu đã rà soát'
                              : 'Phê duyệt'}
                          </button>
                        )}
                        {onDeleteUseCase ? (
                          <button
                            className="toolbar-btn danger"
                            type="button"
                            onClick={() => onDeleteUseCase(useCase.use_case_id)}
                          >
                            Xóa use case
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="usecase-card__grid">
                      <label>
                        <span>Actors</span>
                        <textarea
                          rows={3}
                          value={joinLines([useCase.primary_actor, ...useCase.supporting_actors])}
                          onChange={(event) =>
                            onUseCaseChange(
                              useCase.use_case_id,
                              updateUseCaseActors(useCase, splitLines(event.target.value)),
                            )
                          }
                        />
                      </label>
                    </div>

                    <details className="usecase-card__details">
                      <summary>Thông tin chung</summary>
                      <label>
                        <span>Mục tiêu</span>
                        <textarea
                          rows={3}
                          value={useCase.objective}
                          onChange={(event) =>
                            onUseCaseChange(useCase.use_case_id, {
                              ...useCase,
                              objective: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>Điều kiện tiên quyết</span>
                        <textarea
                          rows={4}
                          value={joinLines(useCase.preconditions)}
                          onChange={(event) =>
                            onUseCaseChange(useCase.use_case_id, {
                              ...useCase,
                              preconditions: splitLines(event.target.value),
                            })
                          }
                        />
                      </label>
                    </details>

                    <div className="usecase-card__flow-section-header">
                      <div>
                        <h5>Luồng chính</h5>
                        <p>Thứ tự, actor và hành động là nguồn chính để tạo sơ đồ.</p>
                      </div>
                      <button
                        className="toolbar-btn"
                        type="button"
                        onClick={() =>
                          onUseCaseChange(useCase.use_case_id, addMainStep(useCase))
                        }
                      >
                        Thêm bước
                      </button>
                    </div>
                    <div className="usecase-card__flow-list">
                      {useCase.main_flow_steps.map((step, stepIndex) => {
                        const referenceReason = getMainStepReferenceReason(
                          useCase,
                          step.step_id,
                        );
                        return (
                        <section className="usecase-card__flow-step" key={step.step_id}>
                          <div className="usecase-card__flow-heading">
                            <strong>Bước {stepIndex + 1}</strong>
                            <div className="usecase-card__flow-actions">
                              <button
                                type="button"
                                className="toolbar-btn"
                                aria-label={`Đưa bước ${stepIndex + 1} lên`}
                                disabled={stepIndex === 0}
                                onClick={() =>
                                  onUseCaseChange(
                                    useCase.use_case_id,
                                    moveMainStep(useCase, step.step_id, -1),
                                  )
                                }
                              >
                                Lên
                              </button>
                              <button
                                type="button"
                                className="toolbar-btn"
                                aria-label={`Đưa bước ${stepIndex + 1} xuống`}
                                disabled={stepIndex === useCase.main_flow_steps.length - 1}
                                onClick={() =>
                                  onUseCaseChange(
                                    useCase.use_case_id,
                                    moveMainStep(useCase, step.step_id, 1),
                                  )
                                }
                              >
                                Xuống
                              </button>
                              <button
                                type="button"
                                className="toolbar-btn danger"
                                aria-label={`Xóa bước ${stepIndex + 1}`}
                                disabled={
                                  useCase.main_flow_steps.length <= 1 ||
                                  Boolean(referenceReason)
                                }
                                title={referenceReason ?? undefined}
                                onClick={() =>
                                  onUseCaseChange(
                                    useCase.use_case_id,
                                    removeMainStep(useCase, step.step_id),
                                  )
                                }
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                          <label>
                            <span>Actor thực hiện</span>
                            <select
                              value={step.actor_ref}
                              onChange={(event) =>
                                onUseCaseChange(
                                  useCase.use_case_id,
                                  updateMainStep(useCase, step.step_id, {
                                    actor_ref: event.target.value,
                                  }),
                                )
                              }
                            >
                              {[useCase.primary_actor, ...useCase.supporting_actors].map((actor) => (
                                <option key={actor} value={actor}>
                                  {actor}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Hành động</span>
                            <textarea
                              rows={2}
                              value={step.action}
                              onChange={(event) =>
                                onUseCaseChange(
                                  useCase.use_case_id,
                                  updateMainStep(useCase, step.step_id, {
                                    action: event.target.value,
                                  }),
                                )
                              }
                            />
                          </label>
                          {referenceReason ? (
                            <p className="usecase-card__reference-note">{referenceReason}</p>
                          ) : null}
                          <details className="usecase-card__step-details">
                            <summary>Chi tiết bước</summary>
                            <label>
                              <span>Đầu vào hoặc kích hoạt</span>
                              <textarea
                                rows={2}
                                value={step.input_or_trigger ?? ''}
                                onChange={(event) =>
                                  onUseCaseChange(
                                    useCase.use_case_id,
                                    updateMainStep(useCase, step.step_id, {
                                      input_or_trigger: event.target.value,
                                    }),
                                  )
                                }
                              />
                            </label>
                            <label>
                              <span>Kết quả mong đợi</span>
                              <textarea
                                rows={2}
                                value={step.expected_result}
                                onChange={(event) =>
                                  onUseCaseChange(
                                    useCase.use_case_id,
                                    updateMainStep(useCase, step.step_id, {
                                      expected_result: event.target.value,
                                    }),
                                  )
                                }
                              />
                            </label>
                          </details>
                        </section>
                        );
                      })}
                    </div>

                    <div className="usecase-card__flow-section-header">
                      <div>
                        <h5>Luồng thay thế</h5>
                        <p>Mỗi nhánh cần điều kiện, bước xử lý và hướng kết thúc rõ ràng.</p>
                      </div>
                      <button
                        className="toolbar-btn"
                        type="button"
                        onClick={() =>
                          onUseCaseChange(useCase.use_case_id, addAlternateFlow(useCase))
                        }
                      >
                        Thêm luồng
                      </button>
                    </div>

                    {useCase.alternate_flows.length > 0 ? (
                      <div className="usecase-card__alternate-list">
                        {useCase.alternate_flows.map((flow, flowIndex) => (
                          <section className="usecase-card__flow-step" key={flow.flow_id}>
                            <div className="usecase-card__flow-heading">
                              <strong>Luồng thay thế {flowIndex + 1}</strong>
                              <button
                                type="button"
                                className="toolbar-btn danger"
                                onClick={() =>
                                  onUseCaseChange(
                                    useCase.use_case_id,
                                    removeAlternateFlow(useCase, flow.flow_id),
                                  )
                                }
                              >
                                Xóa luồng
                              </button>
                            </div>
                            <label>
                              <span>Điều kiện rẽ nhánh</span>
                              <textarea
                                rows={2}
                                value={flow.condition}
                                onChange={(event) =>
                                  onUseCaseChange(
                                    useCase.use_case_id,
                                    updateAlternateFlow(useCase, flow.flow_id, {
                                      condition: event.target.value,
                                    }),
                                  )
                                }
                              />
                            </label>
                            <div className="usecase-card__grid">
                              <label>
                                <span>Rẽ từ bước</span>
                                <select
                                  value={flow.source_step_id}
                                  onChange={(event) =>
                                    onUseCaseChange(
                                      useCase.use_case_id,
                                      updateAlternateFlow(useCase, flow.flow_id, {
                                        source_step_id: event.target.value,
                                      }),
                                    )
                                  }
                                >
                                  {useCase.main_flow_steps.map((step, index) => (
                                    <option key={step.step_id} value={step.step_id}>
                                      Bước {index + 1}: {step.action}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span>Hướng kết thúc</span>
                                <select
                                  value={flow.rejoin_step_id ? 'rejoin' : 'terminal'}
                                  onChange={(event) =>
                                    onUseCaseChange(
                                      useCase.use_case_id,
                                      setAlternateFlowOutcomeMode(
                                        useCase,
                                        flow.flow_id,
                                        event.target.value as 'rejoin' | 'terminal',
                                      ),
                                    )
                                  }
                                >
                                  <option
                                    value="rejoin"
                                    disabled={useCase.main_flow_steps.length < 2}
                                  >
                                    Quay lại luồng chính
                                  </option>
                                  <option value="terminal">Kết thúc quy trình</option>
                                </select>
                              </label>
                            </div>
                            {flow.rejoin_step_id ? (
                              <label>
                                <span>Quay lại bước</span>
                                <select
                                  value={flow.rejoin_step_id}
                                  onChange={(event) =>
                                    onUseCaseChange(
                                      useCase.use_case_id,
                                      updateAlternateFlow(useCase, flow.flow_id, {
                                        rejoin_step_id: event.target.value,
                                        terminal_outcome: null,
                                      }),
                                    )
                                  }
                                >
                                  {useCase.main_flow_steps.map((step, index) =>
                                    step.step_id === flow.source_step_id ? null : (
                                      <option key={step.step_id} value={step.step_id}>
                                        Bước {index + 1}: {step.action}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </label>
                            ) : (
                              <label>
                                <span>Kết quả khi kết thúc nhánh</span>
                                <textarea
                                  rows={2}
                                  value={flow.terminal_outcome ?? ''}
                                  onChange={(event) =>
                                    onUseCaseChange(
                                      useCase.use_case_id,
                                      updateAlternateFlow(useCase, flow.flow_id, {
                                        rejoin_step_id: null,
                                        terminal_outcome: event.target.value,
                                      }),
                                    )
                                  }
                                />
                              </label>
                            )}

                            <div className="usecase-card__alternate-steps">
                              {flow.steps.map((step, stepIndex) => (
                                <section
                                  className="usecase-card__alternate-step"
                                  key={step.step_id}
                                >
                                  <div className="usecase-card__flow-heading">
                                    <strong>Bước nhánh {stepIndex + 1}</strong>
                                    <div className="usecase-card__flow-actions">
                                      <button
                                        type="button"
                                        className="toolbar-btn"
                                        disabled={stepIndex === 0}
                                        onClick={() =>
                                          onUseCaseChange(
                                            useCase.use_case_id,
                                            moveAlternateStep(
                                              useCase,
                                              flow.flow_id,
                                              step.step_id,
                                              -1,
                                            ),
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
                                          onUseCaseChange(
                                            useCase.use_case_id,
                                            moveAlternateStep(
                                              useCase,
                                              flow.flow_id,
                                              step.step_id,
                                              1,
                                            ),
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
                                          onUseCaseChange(
                                            useCase.use_case_id,
                                            removeAlternateStep(
                                              useCase,
                                              flow.flow_id,
                                              step.step_id,
                                            ),
                                          )
                                        }
                                      >
                                        Xóa
                                      </button>
                                    </div>
                                  </div>
                                  <label>
                                    <span>Actor thực hiện</span>
                                    <select
                                      value={step.actor_ref}
                                      onChange={(event) =>
                                        onUseCaseChange(
                                          useCase.use_case_id,
                                          updateAlternateStep(
                                            useCase,
                                            flow.flow_id,
                                            step.step_id,
                                            { actor_ref: event.target.value },
                                          ),
                                        )
                                      }
                                    >
                                      {[useCase.primary_actor, ...useCase.supporting_actors].map(
                                        (actor) => (
                                          <option key={actor} value={actor}>
                                            {actor}
                                          </option>
                                        ),
                                      )}
                                    </select>
                                  </label>
                                  <label>
                                    <span>Hành động</span>
                                    <textarea
                                      rows={2}
                                      value={step.action}
                                      onChange={(event) =>
                                        onUseCaseChange(
                                          useCase.use_case_id,
                                          updateAlternateStep(
                                            useCase,
                                            flow.flow_id,
                                            step.step_id,
                                            { action: event.target.value },
                                          ),
                                        )
                                      }
                                    />
                                  </label>
                                  <details className="usecase-card__step-details">
                                    <summary>Chi tiết bước nhánh</summary>
                                    <label>
                                      <span>Đầu vào hoặc kích hoạt</span>
                                      <textarea
                                        rows={2}
                                        value={step.input_or_trigger ?? ''}
                                        onChange={(event) =>
                                          onUseCaseChange(
                                            useCase.use_case_id,
                                            updateAlternateStep(
                                              useCase,
                                              flow.flow_id,
                                              step.step_id,
                                              { input_or_trigger: event.target.value },
                                            ),
                                          )
                                        }
                                      />
                                    </label>
                                    <label>
                                      <span>Kết quả mong đợi</span>
                                      <textarea
                                        rows={2}
                                        value={step.expected_result}
                                        onChange={(event) =>
                                          onUseCaseChange(
                                            useCase.use_case_id,
                                            updateAlternateStep(
                                              useCase,
                                              flow.flow_id,
                                              step.step_id,
                                              { expected_result: event.target.value },
                                            ),
                                          )
                                        }
                                      />
                                    </label>
                                  </details>
                                </section>
                              ))}
                              <button
                                type="button"
                                className="toolbar-btn"
                                onClick={() =>
                                  onUseCaseChange(
                                    useCase.use_case_id,
                                    addAlternateStep(useCase, flow.flow_id),
                                  )
                                }
                              >
                                Thêm bước nhánh
                              </button>
                            </div>
                          </section>
                        ))}
                      </div>
                    ) : (
                      <p className="usecase-panel__empty">
                        Chưa có luồng thay thế cho use case này.
                      </p>
                    )}

                    <label>
                      <span>Kết quả thành công</span>
                      <textarea
                        rows={3}
                        value={useCase.success_outcome}
                        onChange={(event) =>
                          onUseCaseChange(useCase.use_case_id, {
                            ...useCase,
                            success_outcome: event.target.value,
                          })
                        }
                      />
                    </label>

                    <details className="usecase-card__technical">
                      <summary>Trace kỹ thuật</summary>
                      <p>Use case ID: {useCase.use_case_id}</p>
                      <ul>
                        {useCase.main_flow_steps.map((step) => (
                          <li key={step.step_id}>{step.step_id}</li>
                        ))}
                        {useCase.alternate_flows.map((flow) => (
                          <li key={flow.flow_id}>{flow.flow_id}</li>
                        ))}
                      </ul>
                    </details>

                    <div className="usecase-card__footer">
                      {contractIssues.length > 0 ? (
                        <ul className="usecase-panel__validation-list">
                          {contractIssues.map((issue) => (
                            <li key={`${issue.path}:${issue.message}`}>{issue.message}</li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="usecase-card__next-step">
                        {useCase.review_status === 'approved'
                          ? 'Bước tiếp theo: chuyển use case này sang vùng sơ đồ để bắt đầu activity diagram.'
                          : useCase.review_status === 'reviewed'
                            ? 'Bước tiếp theo: phê duyệt lại use case này trước khi đi sang sơ đồ.'
                            : 'Bước tiếp theo: rà soát và xác nhận nội dung của use case này.'}
                      </p>
                      {useCase.review_status !== 'draft' ? (
                        <button
                          className="toolbar-btn"
                          onClick={() => onReviewStatusChange(useCase.use_case_id, 'draft')}
                        >
                          Đưa về nháp
                        </button>
                      ) : null}
                    </div>
                  </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {activeSection === 'diagrams' ? (
          <section className="usecase-panel__workspace-section">
            <div className="usecase-panel__section-intro">
              <h3>Sơ đồ</h3>
              <p>
                Mỗi use case có một vị trí sơ đồ tương ứng. Ở giai đoạn hiện tại, không gian này cho
                bạn thấy mục nào đã sẵn sàng đi sang canvas và mục nào còn cần rà soát.
              </p>
            </div>
            {diagramInventory.length === 0 ? (
              <p className="usecase-panel__empty">
                Chưa có use case nào để gắn sơ đồ. Hãy sinh use case trước.
              </p>
            ) : (
              <div className="usecase-panel__diagram-list">
                {diagramInventory.map((item) => (
                  <article
                    key={item.use_case_id}
                    className={[
                      'usecase-diagram-row',
                      `usecase-diagram-row--${item.diagram_status}`,
                      item.is_focused ? 'usecase-diagram-row--focused' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={`Sơ đồ ${item.use_case_id}`}
                    aria-current={item.is_focused ? 'true' : undefined}
                  >
                    <div className="usecase-diagram-row__copy">
                      <p className="usecase-card__id">{item.use_case_id}</p>
                      <h4>{item.title}</h4>
                      {item.is_focused ? (
                        <span className="usecase-diagram-row__focus">Đang xem trong danh sách</span>
                      ) : null}
                      <p>{item.note}</p>
                    </div>
                    <div className="usecase-diagram-row__actions">
                      <span
                        className={`usecase-card__status usecase-card__status--${item.diagram_status}`}
                      >
                        {diagramStatusLabel(item.diagram_status)}
                      </span>
                      {item.operation_state === 'generating' ? (
                        <button className="toolbar-btn primary" disabled>
                          Đang tạo…
                        </button>
                      ) : item.diagram_status === 'ready_to_generate' ? (
                        <button
                          className="toolbar-btn primary"
                          onClick={() => onGenerateDiagram(item.use_case_id)}
                        >
                          Tạo sơ đồ
                        </button>
                      ) : item.diagram_status === 'outdated' ||
                        item.diagram_status === 'diverged' ? (
                        <>
                          <button
                            className="toolbar-btn"
                            onClick={() => onOpenDiagramCanvas(item.use_case_id)}
                          >
                            Mở bản hiện tại
                          </button>
                          <button
                            className="toolbar-btn primary"
                            onClick={() => onGenerateDiagram(item.use_case_id)}
                          >
                            Tạo lại sơ đồ
                          </button>
                        </>
                      ) : item.diagram_status === 'failed' ? (
                        <button
                          className="toolbar-btn primary"
                          onClick={() => onGenerateDiagram(item.use_case_id)}
                        >
                          Thử lại
                        </button>
                      ) : item.can_open_canvas ? (
                        <button
                          className="toolbar-btn primary"
                          onClick={() => onOpenDiagramCanvas(item.use_case_id)}
                        >
                          Mở canvas
                        </button>
                      ) : item.diagram_status === 'needs_review' ? (
                        <button
                          className="toolbar-btn"
                          onClick={() => onSectionChange('usecases')}
                        >
                          Quay lại use case
                        </button>
                      ) : null}
                      {item.operation_state === 'failed' &&
                      item.diagram_status !== 'failed' ? (
                        <button
                          className="toolbar-btn primary"
                          onClick={() => onGenerateDiagram(item.use_case_id)}
                        >
                          Thử tạo lại
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
            {orphanedDiagrams.length > 0 ? (
              <section className="usecase-panel__orphaned">
                <h4>Sơ đồ lưu tạm không còn use case nguồn</h4>
                <p>
                  Các bản này được giữ lại sau khi sinh lại danh sách use case. Chỉ xóa khi bạn
                  chủ động loại bỏ.
                </p>
                {orphanedDiagrams.map((item) => (
                  <article
                    className="usecase-diagram-row usecase-diagram-row--outdated"
                    key={item.use_case_id}
                  >
                    <div className="usecase-diagram-row__copy">
                      <p className="usecase-card__id">{item.use_case_id}</p>
                      <h4>{item.title}</h4>
                      <p>{item.semantic_edited ? 'Có chỉnh sửa thủ công.' : 'Bản đã tạo trước đó.'}</p>
                    </div>
                    <div className="usecase-diagram-row__actions">
                      <button
                        className="toolbar-btn"
                        onClick={() => onOpenDiagramCanvas(item.use_case_id)}
                      >
                        Mở bản lưu
                      </button>
                      <button
                        className="toolbar-btn danger"
                        onClick={() => onDiscardOrphanedDiagram(item.use_case_id)}
                      >
                        Xóa bản lưu
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            ) : null}
          </section>
        ) : null}
      </div>
    </aside>
  );
}

const WORKSPACE_SECTIONS: Array<{
  id: UseCaseWorkspaceSection;
  label: string;
  helper: string;
}> = [
  { id: 'input', label: 'Đầu vào', helper: 'Thông tin cốt lõi của chức năng' },
  { id: 'usecases', label: 'Use case', helper: 'Danh sách kết quả có thể sửa' },
  { id: 'diagrams', label: 'Sơ đồ', helper: 'Sơ đồ theo từng use case' },
];

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

function phaseLabel(phase: UseCasePanelPhase) {
  switch (phase) {
    case 'generating':
      return 'Đang sinh danh sách use case từ đầu vào hiện tại';
    case 'ready':
      return 'Use case đã sẵn sàng để rà soát và đi tiếp sang sơ đồ';
    case 'failed':
      return 'Sinh use case thất bại';
    default:
      return 'Nhập spec, rà soát use case, rồi chuẩn bị sơ đồ cho từng use case';
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
  return 'Kết quả được tạo theo rule và cần được rà soát trước khi phê duyệt.';
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
