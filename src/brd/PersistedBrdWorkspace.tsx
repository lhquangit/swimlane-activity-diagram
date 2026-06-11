import { useEffect, useState } from 'react';

import { useWorkspacePersistence } from '../persistence/WorkspaceContext';
import type { ArtifactTreeUseCase, BrdResource, UseCaseResource } from '../persistence/types';
import { EditableMarkdownDocument } from './markdown';
import type { BrdSpec, ResponseMetadata, WarningItem } from './types';

type PersistedBrdWorkspaceProps = {
  activeUseCaseResource?: UseCaseResource | null;
  activeTreeUseCase?: ArtifactTreeUseCase | null;
};

export default function PersistedBrdWorkspace({
  activeUseCaseResource = null,
  activeTreeUseCase = null,
}: PersistedBrdWorkspaceProps) {
  const workspace = useWorkspacePersistence();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagramId, setDiagramId] = useState<string | null>(null);
  const [resource, setResource] = useState<BrdResource | null>(null);
  const [title, setTitle] = useState('Business Requirements Document');
  const [draft, setDraft] = useState('');
  const [spec, setSpec] = useState<BrdSpec | null>(null);
  const [warnings, setWarnings] = useState<WarningItem[]>([]);
  const [template, setTemplate] = useState<'default' | 'full'>('default');
  const [metadata, setMetadata] = useState<ResponseMetadata | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const loadDiagram = workspace?.loadDiagram;
  const loadBrd = workspace?.loadBrd;

  useEffect(() => {
    if (!activeUseCaseResource || !loadDiagram || !loadBrd) return;
    let active = true;
    setLoading(true);
    setError(null);
    void loadDiagram(activeUseCaseResource.use_case_key)
      .then(async (savedDiagram) => {
        if (!active) return;
        if (!savedDiagram) {
          setDiagramId(null);
          setResource(null);
          setSpec(null);
          setDraft('');
          setWarnings([]);
          return;
        }
        setDiagramId(savedDiagram.id);
        const savedBrd = await loadBrd(savedDiagram.id);
        if (!active) return;
        applyBrdResource(savedBrd);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Không tải được BRD đã lưu.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeUseCaseResource?.id, activeUseCaseResource?.use_case_key, loadBrd, loadDiagram]);

  if (!workspace || !activeUseCaseResource) return null;

  const diagramArtifact = activeTreeUseCase?.diagram ?? null;
  const brdArtifact = diagramArtifact?.brd ?? null;
  const warningCount = warnings.length;
  const saveStateLabel = getSaveStateLabel(workspace.brdSaveState, isDirty);
  const sourceLabel = metadata?.generation_source
    ? metadata.generation_source === 'ai'
      ? 'Bản nháp AI'
      : 'Bản nháp theo rule'
    : 'BRD đã lưu';
  const lastUpdatedAt = resource?.updated_at ?? brdArtifact?.updated_at ?? null;

  const handleGenerate = async () => {
    if (!diagramId) {
      setError('Hãy tạo và lưu Diagram trước khi sinh BRD.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const payload = await workspace.generateBrd(diagramId, makeIdempotencyKey(), template);
      setRequestId(payload.request_id);
      setMetadata(payload.metadata ?? null);
      setWarnings(payload.warnings ?? []);
      if (payload.error) {
        setError(payload.error.message);
        return;
      }
      const nextSpec = payload.result.spec;
      const nextDraft = payload.result.brd_markdown;
      const nextTitle = nextSpec.metadata.diagram_name || 'Business Requirements Document';
      setSpec(nextSpec);
      setDraft(nextDraft);
      setTitle(nextTitle);
      try {
        const saved = await workspace.saveBrd(diagramId, {
          title: nextTitle,
          structured_spec: nextSpec,
          markdown_content: nextDraft,
          warnings: payload.warnings,
          template,
        });
        applyBrdResource(saved);
        setMetadata(payload.metadata ?? null);
        setRequestId(payload.request_id);
      } catch (reason) {
        workspace.markBrdDirty(diagramId);
        setIsDirty(true);
        setError(
          reason instanceof Error
            ? `${reason.message} BRD draft vẫn đang ở trên trang này để bạn lưu lại.`
            : 'Không thể lưu BRD vừa sinh. BRD draft vẫn đang ở trên trang này để bạn lưu lại.',
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể sinh BRD.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!diagramId || !spec || !draft.trim()) return;
    setError(null);
    try {
      const saved = await workspace.saveBrd(diagramId, {
        title: title.trim() || spec.metadata.diagram_name || 'Business Requirements Document',
        structured_spec: spec,
        markdown_content: draft,
        warnings,
        template,
      });
      applyBrdResource(saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu BRD.');
    }
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    setIsDirty(true);
    if (diagramId) workspace.markBrdDirty(diagramId);
  };

  const handleOpenDiagram = () => {
    workspace.navigateToArtifact({
      kind: 'diagram',
      featureId: workspace.activeFeature.id,
      useCaseId: activeUseCaseResource.id,
    });
  };

  const handleExportDocx = async () => {
    if (!diagramId || !draft.trim()) return;
    setError(null);
    try {
      const blob = await workspace.exportBrdDocx(diagramId, {
        title: title.trim() || spec?.metadata.diagram_name || 'Business Requirements Document',
        markdown_content: draft,
      });
      downloadBlob(blob, `${sanitizeFilename(title.trim() || 'BRD')}.docx`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể export BRD DOCX.');
    }
  };

  return (
    <div className="persisted-brd">
      <section className="workspace-form-card persisted-brd__surface">
        <div className="persisted-brd__hero">
          <div className="persisted-brd__identity">
            <p className="persisted-brd__eyebrow">BRD Artifact</p>
            <h2>{title || activeUseCaseResource.title || activeUseCaseResource.use_case_key}</h2>
            <p className="persisted-brd__lead">
              BRD được lưu như một artifact riêng dưới Diagram. Sinh mới sẽ cập nhật node BRD trong
              left bar, không mở side panel.
            </p>
            <div className="persisted-brd__meta">
              <span>{activeUseCaseResource.use_case_key}</span>
              <span>{diagramArtifact ? diagramArtifact.title : 'Diagram chưa tải'}</span>
              <span>{brdArtifact ? `Cập nhật ${formatDate(brdArtifact.updated_at)}` : 'Chưa có BRD'}</span>
              {brdArtifact?.is_outdated ? <span className="warning">BRD đang cũ</span> : null}
            </div>
          </div>
          <div className="persisted-brd__actions">
            <button className="workspace-button" onClick={handleOpenDiagram}>
              Về Diagram
            </button>
            <button
              className="workspace-button primary"
              onClick={() => void handleGenerate()}
              disabled={loading || generating || !diagramId}
            >
              {generating ? 'Đang tạo BRD…' : resource ? 'Tạo lại BRD' : 'Tạo BRD'}
            </button>
            <button
              className="workspace-button primary"
              onClick={() => void handleSave()}
              disabled={!diagramId || !spec || !draft.trim() || workspace.brdSaveState === 'saving'}
            >
              {workspace.brdSaveState === 'saving'
                ? 'Đang lưu…'
                : workspace.brdSaveState === 'saved' && !isDirty
                  ? 'Đã lưu'
                  : workspace.brdSaveState === 'failed'
                    ? 'Lưu lại'
                    : 'Lưu BRD'}
            </button>
            <button
              className="workspace-button primary"
              onClick={() => void handleExportDocx()}
              disabled={!diagramId || !draft.trim()}
            >
              Export DOCX
            </button>
          </div>
        </div>

        {metadata ? (
          <div className="persisted-brd__provenance">
            <span>{sourceLabel}</span>
            {metadata.provider ? <span>{metadata.provider}</span> : null}
            {metadata.model ? <span>{metadata.model}</span> : null}
            {metadata.generation_mode ? <span>Mode {metadata.generation_mode}</span> : null}
            {metadata.fallback_reason ? <span>{metadata.fallback_reason}</span> : null}
            {requestId ? <span>Request {requestId}</span> : null}
          </div>
        ) : null}

        {error ? <p className="workspace-error">{error}</p> : null}

        {loading ? (
          <div className="workspace-empty">
            <h3>Đang tải BRD</h3>
            <p>Đang đồng bộ Diagram và BRD đã lưu từ server…</p>
          </div>
        ) : null}

        {!loading && !diagramId ? (
          <div className="workspace-empty">
            <h3>Chưa có Diagram</h3>
            <p>Use Case này cần một Diagram đã lưu trước khi sinh BRD.</p>
            <button className="workspace-button primary" onClick={handleOpenDiagram}>
              Mở Diagram
            </button>
          </div>
        ) : null}

        {!loading && diagramId && !spec ? (
          <div className="workspace-empty">
            <h3>Chưa có BRD</h3>
            <p>BRD sẽ được sinh từ Diagram đã lưu và xuất hiện như một artifact con trong left bar.</p>
            <button
              className="workspace-button primary"
              onClick={() => void handleGenerate()}
              disabled={generating}
            >
              {generating ? 'Đang tạo BRD…' : 'Tạo BRD'}
            </button>
          </div>
        ) : null}

        {!loading && diagramId && spec ? (
          <div className="persisted-brd__layout">
            <article className="persisted-brd__document">
              <header className="persisted-brd__document-header">
                <div className="persisted-brd__document-title">
                  <p className="persisted-brd__document-kicker">Business Requirements Document</p>
                  <h3>{title || activeUseCaseResource.title || activeUseCaseResource.use_case_key}</h3>
                  <p className="persisted-brd__document-subtitle">
                    Tài liệu BRD đã lưu cho Use Case {activeUseCaseResource.use_case_key}
                    {diagramArtifact ? ` từ diagram ${diagramArtifact.title}` : ''}.
                  </p>
                </div>
                <div className="persisted-brd__document-chips">
                  <span>{sourceLabel}</span>
                  <span>{warningCount > 0 ? `${warningCount} warning` : 'Không có warning'}</span>
                  <span>{saveStateLabel}</span>
                  {lastUpdatedAt ? <span>Cập nhật {formatDate(lastUpdatedAt)}</span> : null}
                  {brdArtifact?.is_outdated ? <span className="warning">BRD đang cũ</span> : null}
                </div>
              </header>

              <div className="persisted-brd__document-body">
                <EditableMarkdownDocument markdown={draft} onChange={handleDraftChange} />
              </div>
            </article>

            <aside className="persisted-brd__sidebar">
              <section className="persisted-brd__section persisted-brd__section--sidebar">
                <div className="workspace-section-heading">
                  <div>
                    <h3>Thông tin tài liệu</h3>
                    <p>Tiêu đề, template và context của artifact BRD.</p>
                  </div>
                </div>
                <div className="persisted-brd__facts">
                  <div>
                    <span>Use Case</span>
                    <strong>{activeUseCaseResource.use_case_key}</strong>
                  </div>
                  <div>
                    <span>Diagram</span>
                    <strong>{diagramArtifact?.title ?? 'Diagram đã lưu'}</strong>
                  </div>
                  <div>
                    <span>Trạng thái</span>
                    <strong>{saveStateLabel}</strong>
                  </div>
                </div>
                <label className="workspace-field">
                  <span>Tiêu đề BRD</span>
                  <input
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      setIsDirty(true);
                      if (diagramId) workspace.markBrdDirty(diagramId);
                    }}
                  />
                </label>
                <label className="workspace-field">
                  <span>Template</span>
                  <select
                    value={template}
                    onChange={(event) => {
                      setTemplate(event.target.value as 'default' | 'full');
                      setIsDirty(true);
                      if (diagramId) workspace.markBrdDirty(diagramId);
                    }}
                  >
                    <option value="default">Default</option>
                    <option value="full">Full</option>
                  </select>
                </label>
              </section>

              <section className="persisted-brd__section persisted-brd__section--sidebar">
                <div className="workspace-section-heading">
                  <div>
                    <h3>Warnings</h3>
                    <p>Giữ lại để review trước khi downstream dùng tài liệu này.</p>
                  </div>
                </div>
                {warnings.length > 0 ? (
                  <div className="persisted-brd__warnings">
                    {warnings.map((warning, index) => (
                      <div
                        key={`${warning.code}-${index}`}
                        className={`warning-item ${warning.severity}`}
                      >
                        <div className="warning-item__code">{warning.code}</div>
                        <div className="warning-item__message">{warning.message}</div>
                        {warning.related_node_ids.length > 0 ? (
                          <div className="warning-item__nodes">
                            {warning.related_node_ids.join(', ')}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="persisted-brd__empty">Không có warning nổi bật.</p>
                )}
              </section>

              <details className="persisted-brd__details">
                <summary className="persisted-brd__details-summary">Structured Spec</summary>
                <p className="persisted-brd__details-copy">Payload gốc để trace và review.</p>
                <pre className="persisted-brd__spec">{JSON.stringify(spec, null, 2)}</pre>
              </details>
            </aside>
          </div>
        ) : null}
      </section>
    </div>
  );

  function applyBrdResource(savedBrd: BrdResource | null) {
    setResource(savedBrd);
    if (!savedBrd) {
      setTitle('Business Requirements Document');
      setDraft('');
      setSpec(null);
      setWarnings([]);
      setMetadata(null);
      setRequestId(null);
      setIsDirty(false);
      return;
    }
    setTitle(savedBrd.title);
    setDraft(savedBrd.markdown_content);
    setSpec(savedBrd.structured_spec);
    setWarnings(savedBrd.warnings);
    setTemplate(savedBrd.template);
    setIsDirty(false);
    workspace?.markBrdLoaded(savedBrd.diagram_id);
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function makeIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `brd-${crypto.randomUUID()}`;
  }
  return `brd-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const revokeObjectUrl = URL.revokeObjectURL;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (typeof revokeObjectUrl === 'function') {
    setTimeout(() => revokeObjectUrl(url), 100);
  }
}

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'BRD';
}

function getSaveStateLabel(
  state: 'idle' | 'dirty' | 'saving' | 'saved' | 'failed',
  isDirty: boolean,
) {
  if (state === 'saving') return 'Đang lưu';
  if (state === 'failed') return 'Lưu thất bại';
  if (state === 'dirty') return 'Chưa lưu thay đổi';
  if (state === 'saved' && !isDirty) return 'Đã lưu';
  if (isDirty) return 'Chưa lưu thay đổi';
  return 'Sẵn sàng';
}
