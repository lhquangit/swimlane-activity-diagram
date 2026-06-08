import { useRef, useState } from 'react';

import type { ProjectArtifactTree } from '../persistence/types';
import type { ActiveArtifact } from './artifact-routing';
import { sameArtifact } from './artifact-routing';

type ArtifactTreeProps = {
  tree: ProjectArtifactTree;
  active: ActiveArtifact;
  onSelect: (artifact: ActiveArtifact) => void;
  onCreateFeature: () => void;
};

export default function ArtifactTree({
  tree,
  active,
  onSelect,
  onCreateFeature,
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

  return (
    <aside className="artifact-sidebar">
      <div className="artifact-sidebar__header">
        <div>
          <span>Project</span>
          <strong>{tree.project.name}</strong>
        </div>
        <button
          type="button"
          className="artifact-tree__toggle"
          onClick={() => toggle('project')}
          aria-label={collapsed.project ? 'Mở cây project' : 'Thu gọn cây project'}
        >
          {collapsed.project ? '›' : '⌄'}
        </button>
      </div>

      {!collapsed.project ? (
        <div
          ref={treeRef}
          className="artifact-tree"
          role="tree"
          aria-label="Cấu trúc project"
          onKeyDown={handleTreeKeyDown}
        >
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
                          {feature.use_cases.map((useCase) => (
                            <div className="artifact-tree__branch" key={useCase.id}>
                              <TreeItem
                                label={useCase.title}
                                meta={`${useCase.use_case_key} · ${useCase.review_status}`}
                                active={sameArtifact(active, {
                                  kind: 'use-case',
                                  featureId: feature.id,
                                  useCaseId: useCase.id,
                                })}
                                onClick={() =>
                                  onSelect({
                                    kind: 'use-case',
                                    featureId: feature.id,
                                    useCaseId: useCase.id,
                                  })
                                }
                              />
                              <div role="group" className="artifact-tree__children">
                                <TreeItem
                                  label={
                                    useCase.diagram?.title ?? 'Diagram chưa tạo'
                                  }
                                  meta={
                                    useCase.diagram
                                      ? useCase.diagram.is_outdated
                                        ? 'Diagram outdated'
                                        : 'Diagram'
                                      : 'Tạo từ Use Case đã duyệt'
                                  }
                                  muted={!useCase.diagram}
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
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function TreeItem({
  label,
  meta,
  active,
  muted = false,
  onClick,
}: {
  label: string;
  meta: string;
  active: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="treeitem"
      aria-current={active ? 'page' : undefined}
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
