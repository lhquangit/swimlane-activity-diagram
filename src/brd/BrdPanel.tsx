import {
  BrdPanelPhase,
  BrdSpec,
  BrdTabId,
  ErrorObject,
  ResponseMetadata,
  WarningItem,
} from './types';
import type { SaveState } from '../persistence/types';

type Props = {
  open: boolean;
  phase: BrdPanelPhase;
  activeTab: BrdTabId;
  onTabChange: (tab: BrdTabId) => void;
  warnings: WarningItem[];
  blockingIssues: WarningItem[];
  spec: BrdSpec | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onClose: () => void;
  onCopy: () => void;
  onExport: () => void;
  onSave?: () => void;
  saveState?: SaveState;
  onRetry: (() => void) | null;
  onLoadServerVersion?: (() => void) | null;
  onAcknowledgeOutdated: (() => void) | null;
  metadata: ResponseMetadata | null;
  requestId: string | null;
  runtimeStatus: string | null;
  error: ErrorObject | null;
  isOutdated: boolean;
};

const TABS: Array<{ id: BrdTabId; label: string }> = [
  { id: 'warnings', label: 'Warnings' },
  { id: 'draft', label: 'BRD Draft' },
];

export default function BrdPanel({
  open,
  phase,
  activeTab,
  onTabChange,
  warnings,
  blockingIssues,
  spec,
  draft,
  onDraftChange,
  onClose,
  onCopy,
  onExport,
  onSave,
  saveState = 'idle',
  onRetry,
  onLoadServerVersion = null,
  onAcknowledgeOutdated,
  metadata,
  requestId,
  runtimeStatus,
  error,
  isOutdated,
}: Props) {
  if (!open) return null;

  const combinedWarnings = [...blockingIssues, ...warnings];

  return (
    <aside className="brd-panel">
      <div className="brd-panel__header">
        <div>
          <h2>AI BRD Draft</h2>
          <p>
            {phaseLabel(phase)}
            {runtimeStatus ? ` · ${runtimeStatus}` : ''}
          </p>
        </div>
        <button
          className="brd-panel__icon-btn"
          onClick={onClose}
          title="Đóng panel"
          aria-label="Đóng panel"
        >
          ×
        </button>
      </div>

      {isOutdated ? (
        <div className="brd-panel__banner warning">
          <div>
            <strong>Outdated</strong>
            <p>Diagram đã thay đổi sau lần generate gần nhất.</p>
          </div>
          {onAcknowledgeOutdated ? (
            <button className="brd-panel__banner-btn" onClick={onAcknowledgeOutdated}>
              Giữ bản này
            </button>
          ) : null}
        </div>
      ) : null}

      {onLoadServerVersion ? (
        <div className="brd-panel__banner warning">
          <div>
            <strong>Có BRD đã lưu trên server</strong>
            <p>Bản recovery cục bộ chưa lưu đang được giữ. Chỉ thay thế khi bạn chủ động chọn.</p>
          </div>
          <button className="brd-panel__banner-btn" onClick={onLoadServerVersion}>
            Dùng bản server
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="brd-panel__banner danger">
          <div>
            <strong>{error.code}</strong>
            <p>{error.message}</p>
          </div>
          {error.retryable && onRetry ? (
            <button className="brd-panel__banner-btn" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="brd-panel__tabs" role="tablist" aria-label="BRD output">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`brd-panel__tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="brd-panel__content">
        {activeTab === 'warnings' ? (
          <div className="brd-panel__list">
            {combinedWarnings.length > 0 ? (
              combinedWarnings.map((warning, index) => (
                <div key={`${warning.code}-${index}`} className={`warning-item ${warning.severity}`}>
                  <div className="warning-item__code">{warning.code}</div>
                  <div className="warning-item__message">{warning.message}</div>
                </div>
              ))
            ) : (
              <p className="brd-panel__empty">Không có warning nổi bật.</p>
            )}
          </div>
        ) : null}

        {activeTab === 'draft' ? (
          <div className="brd-panel__draft">
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="BRD draft sẽ xuất hiện ở đây sau khi generate."
            />
          </div>
        ) : null}
      </div>

      <div className="brd-panel__footer">
        <button className="toolbar-btn" onClick={onCopy} disabled={!draft}>
          Copy
        </button>
        <button className="toolbar-btn primary" onClick={onExport} disabled={!draft}>
          Export markdown
        </button>
        {onSave ? (
          <button
            className="toolbar-btn primary"
            onClick={onSave}
            disabled={!draft || !spec || saveState === 'saving'}
          >
            {saveState === 'saving'
              ? 'Đang lưu…'
              : saveState === 'saved'
                ? 'Đã lưu'
                : saveState === 'failed'
                  ? 'Lưu lại'
                  : 'Lưu BRD'}
          </button>
        ) : null}
      </div>
    </aside>
  );
}

function phaseLabel(phase: BrdPanelPhase) {
  switch (phase) {
    case 'validating':
      return 'Validating';
    case 'blocking':
      return 'Blocking issues';
    case 'generating':
      return 'Generating';
    case 'ready':
      return 'Ready';
    case 'failed':
      return 'Failed';
    case 'in-progress':
      return 'In progress';
    default:
      return 'Idle';
  }
}
