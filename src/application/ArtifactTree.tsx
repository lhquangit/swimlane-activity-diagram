import { useEffect, useRef, useState } from 'react';

import type { ProjectArtifactTree } from '../persistence/types';
import type { ActiveArtifact } from './artifact-routing';
import { sameArtifact } from './artifact-routing';

type ArtifactTreeProps = {
  tree: ProjectArtifactTree;
  active: ActiveArtifact;
  onSelect: (artifact: ActiveArtifact) => void;
  onCreateFeature: () => void;
  onDeleteUseCase?: (payload: {
    featureId: string;
    useCaseId: string;
    businessKey: string;
    title: string;
  }) => void;
  deletingUseCaseIds?: Record<string, boolean>;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
};

export default function ArtifactTree({
  tree,
  active,
  onSelect,
  onCreateFeature,
  onDeleteUseCase,
  deletingUseCaseIds = {},
  sidebarCollapsed = false,
  onToggleSidebar,
}: ArtifactTreeProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const treeRef = useRef<HTMLDivElement>(null);
  const toggle = (key: string) =>
    setCollapsed((current) => ({ ...current, [key]: !current[key] }));
  const handleTreeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(
      treeRef.current?.querySelectorAll<HTMLButtonElement>('[role="treeitem"]') ?? [],
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? Math.min(currentIndex + 1, items.length - 1)
            : Math.max(currentIndex - 1, 0);
    event.preventDefault();
    items[nextIndex]?.focus();
  };

  useEffect(() => {
    setCollapsed((current) => {
      const next = { ...current };
      if (active.kind === 'feature' || active.kind === 'use-cases' || active.kind === 'use-case' || active.kind === 'diagram' || active.kind === 'brd') {
        next.project = false;
        next.features = false;
        next[`feature:${active.featureId}`] = false;
      }
      if (active.kind === 'use-case' || active.kind === 'diagram' || active.kind === 'brd') {
        next[`usecase:${active.useCaseId}`] = false;
      }
      return next;
    });
  }, [active]);

  if (sidebarCollapsed) {
    return (
      <aside className="artifact-sidebar artifact-sidebar--collapsed">
        <button
          type="button"
          className="artifact-sidebar__collapse-toggle"
          onClick={onToggleSidebar}
          aria-label="Mở thanh điều hướng artifact"
          title="Mở thanh điều hướng artifact"
        >
          <span aria-hidden="true">{'>'}</span>
        </button>
        <div className="artifact-sidebar__rail-badge" aria-hidden="true">
          {projectInitials(tree.project.name)}
        </div>
      </aside>
    );
  }

  return (
    <aside className="artifact-sidebar">
      <div className="artifact-sidebar__header">
        <div>
          <span>Project</span>
          <strong>{tree.project.name}</strong>
        </div>
        <button
          type="button"
          className="artifact-sidebar__collapse-toggle"
          onClick={onToggleSidebar}
          aria-label="Thu gọn thanh điều hướng artifact"
          title="Thu gọn thanh điều hướng artifact"
        >
          <span aria-hidden="true">{'<'}</span>
        </button>
      </div>

      <div
        ref={treeRef}
        className="artifact-tree"
        role="tree"
        aria-label="Cấu trúc project"
        onKeyDown={handleTreeKeyDown}
      >
        <div className="artifact-tree__branch-heading artifact-tree__branch-heading--project">
          <button
            type="button"
            className="artifact-tree__toggle"
            onClick={() => toggle('project')}
            aria-expanded={!collapsed.project}
            aria-label={collapsed.project ? 'Mở cây project' : 'Thu gọn cây project'}
          >
            {collapsed.project ? '>' : 'v'} Project
          </button>
        </div>

        {!collapsed.project ? (
          <>
          <TreeItem
            label="Project Spec"
            meta="Bối cảnh dự án"
            active={sameArtifact(active, { kind: 'spec' })}
            onClick={() => onSelect({ kind: 'spec' })}
          />

          <div className="artifact-tree__branch">
            <div className="artifact-tree__branch-heading">
              <button
                type="button"
                className="artifact-tree__toggle"
                onClick={() => toggle('features')}
                aria-expanded={!collapsed.features}
              >
                {collapsed.features ? '›' : '⌄'} Features
              </button>
              <button
                type="button"
                className="artifact-tree__add"
                onClick={onCreateFeature}
                aria-label="Tạo Feature"
              >
                +
              </button>
            </div>

            {!collapsed.features ? (
              <div role="group" className="artifact-tree__children">
                {tree.features.length === 0 ? (
                  <p className="artifact-tree__empty">Chưa có Feature Intent.</p>
                ) : null}
                {tree.features.map((feature) => {
                  const featureKey = `feature:${feature.id}`;
                  return (
                    <div className="artifact-tree__branch" key={feature.id}>
                      <div className="artifact-tree__row-with-toggle">
                        <button
                          type="button"
                          className="artifact-tree__toggle"
                          onClick={() => toggle(featureKey)}
                          aria-label={
                            collapsed[featureKey]
                              ? `Mở ${feature.name}`
                              : `Thu gọn ${feature.name}`
                          }
                          aria-expanded={!collapsed[featureKey]}
                        >
                          {collapsed[featureKey] ? '›' : '⌄'}
                        </button>
                        <TreeItem
                          label={feature.name}
                          meta="Feature Intent"
                          active={sameArtifact(active, {
                            kind: 'feature',
                            featureId: feature.id,
                          })}
                          onClick={() =>
                            onSelect({ kind: 'feature', featureId: feature.id })
                          }
                        />
                      </div>

                      {!collapsed[featureKey] ? (
                        <div role="group" className="artifact-tree__children">
                          <TreeItem
                            label="Use Cases"
                            meta={`${feature.use_cases.length} artifact`}
                            active={sameArtifact(active, {
                              kind: 'use-cases',
                              featureId: feature.id,
                            })}
                            onClick={() =>
                              onSelect({ kind: 'use-cases', featureId: feature.id })
                            }
                          />
                          {feature.use_cases.length === 0 ? (
                            <p className="artifact-tree__empty">Chưa có Use Case.</p>
                          ) : null}
                          {feature.use_cases.map((useCase) => {
                            const useCaseKey = `usecase:${useCase.id}`;
                            const useCaseDeleting = Boolean(deletingUseCaseIds[useCase.id]);
                            const useCaseActive =
                              sameArtifact(active, {
                                kind: 'use-case',
                                featureId: feature.id,
                                useCaseId: useCase.id,
                              }) ||
                              sameArtifact(active, {
                                kind: 'diagram',
                                featureId: feature.id,
                                useCaseId: useCase.id,
                              }) ||
                              sameArtifact(active, {
                                kind: 'brd',
                                featureId: feature.id,
                                useCaseId: useCase.id,
                              });
                            return (
                              <div className="artifact-tree__branch" key={useCase.id}>
                                <div className="artifact-tree__row-with-toggle artifact-tree__row-with-actions">
                                  <button
                                    type="button"
                                    className="artifact-tree__toggle"
                                    disabled={useCaseDeleting}
                                    onClick={() => toggle(useCaseKey)}
                                    aria-label={
                                      collapsed[useCaseKey]
                                        ? `Mở ${useCase.title}`
                                        : `Thu gọn ${useCase.title}`
                                    }
                                    aria-expanded={!collapsed[useCaseKey]}
                                  >
                                    {collapsed[useCaseKey] ? '›' : '⌄'}
                                  </button>
                                  <TreeItem
                                    label={useCase.title}
                                    meta={`${useCase.use_case_key} · ${useCase.review_status}`}
                                    active={useCaseActive}
                                    disabled={useCaseDeleting}
                                    onClick={() =>
                                      onSelect({
                                        kind: 'use-case',
                                        featureId: feature.id,
                                        useCaseId: useCase.id,
                                      })
                                    }
                                  />
                                  {onDeleteUseCase ? (
                                    <button
                                      type="button"
                                      className="artifact-tree__row-action artifact-tree__row-action--danger"
                                      aria-label={
                                        useCaseDeleting
                                          ? `Đang xóa ${useCase.title}`
                                          : `Xóa ${useCase.title}`
                                      }
                                      title={
                                        useCaseDeleting
                                          ? `Đang xóa ${useCase.title}`
                                          : `Xóa ${useCase.title}`
                                      }
                                      disabled={useCaseDeleting}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        onDeleteUseCase({
                                          featureId: feature.id,
                                          useCaseId: useCase.id,
                                          businessKey: useCase.use_case_key,
                                          title: useCase.title,
                                        });
                                      }}
                                    >
                                      {useCaseDeleting ? '…' : '×'}
                                    </button>
                                  ) : null}
                                </div>
                                {!collapsed[useCaseKey] ? (
                                  <div role="group" className="artifact-tree__children">
                                    <TreeItem
                                      label={useCase.diagram?.title ?? 'Diagram chưa tạo'}
                                      meta={
                                        useCase.diagram
                                          ? useCase.diagram.is_outdated
                                            ? 'Diagram outdated'
                                            : 'Diagram'
                                          : 'Tạo từ Use Case đã duyệt'
                                      }
                                      muted={!useCase.diagram}
                                      disabled={useCaseDeleting}
                                      active={sameArtifact(active, {
                                        kind: 'diagram',
                                        featureId: feature.id,
                                        useCaseId: useCase.id,
                                      })}
                                      onClick={() =>
                                        onSelect({
                                          kind: 'diagram',
                                          featureId: feature.id,
                                          useCaseId: useCase.id,
                                        })
                                      }
                                    />
                                    <TreeItem
                                      label={
                                        useCase.diagram?.brd?.title ??
                                        (useCase.diagram ? 'BRD chưa tạo' : 'BRD cần Diagram')
                                      }
                                      meta={
                                        useCase.diagram?.brd
                                          ? useCase.diagram.brd.is_outdated
                                            ? 'BRD outdated'
                                            : 'BRD'
                                          : 'Chưa có dữ liệu'
                                      }
                                      muted={!useCase.diagram?.brd}
                                      disabled={useCaseDeleting}
                                      active={sameArtifact(active, {
                                        kind: 'brd',
                                        featureId: feature.id,
                                        useCaseId: useCase.id,
                                      })}
                                      onClick={() =>
                                        onSelect({
                                          kind: 'brd',
                                          featureId: feature.id,
                                          useCaseId: useCase.id,
                                        })
                                      }
                                    />
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}

function projectInitials(projectName: string) {
  return projectName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function TreeItem({
  label,
  meta,
  active,
  muted = false,
  disabled = false,
  onClick,
}: {
  label: string;
  meta: string;
  active: boolean;
  muted?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="treeitem"
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      className={[
        'artifact-tree__item',
        active ? 'active' : '',
        muted ? 'muted' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
    >
      <span>{label}</span>
      <small>{meta}</small>
    </button>
  );
}
