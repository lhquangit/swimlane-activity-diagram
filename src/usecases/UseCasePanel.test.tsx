import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import UseCasePanel from './UseCasePanel';
import { applyUseCaseEditLifecycle, buildDiagramInventory } from './lifecycle';
import type {
  ArtifactChainItem,
  FeatureIntent,
  ProjectSpec,
  UseCaseDiagramInventoryItem,
  UseCaseDraft,
  UseCaseWorkspaceSection,
} from './types';

const baseProjectSpec: ProjectSpec = {
  project_name: 'V-PetSafe',
  project_summary: 'Nen tang quan ly cu dan va dich vu noi khu.',
  business_context: 'Ban quan ly can xu ly yeu cau GPS cho thu nuoi.',
  target_users: ['Ban quan ly', 'Cu dan'],
  business_rules: ['Chi cap phat thiet bi khi co GPS Device kha dung.'],
  glossary: ['GPS Device', 'Portal'],
};

const baseFeatureIntent: FeatureIntent = {
  feature_name: 'Cap phat GPS Device',
  function_name: 'gps-device-issue',
  feature_summary: 'Xu ly yeu cau cap phat va lap dat GPS cho thu nuoi.',
  primary_actor: 'Ban quan ly',
  trigger: 'Co yeu cau dang ky GPS hop le tu cu dan.',
  inputs: ['Yeu cau GPS'],
  outputs: ['Trang thai yeu cau'],
  constraints: ['Thiet bi phai o trang thai Trong kho truoc khi giu cho.'],
  assumptions: ['Portal la he thong thao tac chinh cua BQL.'],
  systems_involved: ['Portal'],
  success_outcome: 'Yeu cau GPS duoc cap phat thanh cong.',
};

const baseUseCases: UseCaseDraft[] = [
  {
    use_case_id: 'UC-VPET-GPS-01',
    title: 'Ban quan ly tiep nhan va khoi tao xu ly Cap phat GPS Device',
    objective: 'Tiep nhan dung thong tin va khoi tao xu ly.',
    primary_actor: 'Ban quan ly',
    supporting_actors: ['Cu dan', 'Portal'],
    preconditions: ['Da co yeu cau hop le.'],
    happy_path_summary: ['Tiep nhan yeu cau', 'Kiem tra du lieu ban dau'],
    key_exceptions: ['Thong tin dau vao thieu'],
    main_flow_steps: [
      {
        step_id: 'UC-VPET-GPS-01-S01',
        actor_ref: 'Ban quan ly',
        action: 'Tiep nhan yeu cau',
        input_or_trigger: 'Co yeu cau GPS',
        expected_result: 'Yeu cau duoc tiep nhan.',
      },
      {
        step_id: 'UC-VPET-GPS-01-S02',
        actor_ref: 'Portal',
        action: 'Kiem tra du lieu ban dau',
        expected_result: 'Du lieu duoc xac minh.',
      },
    ],
    alternate_flows: [
      {
        flow_id: 'UC-VPET-GPS-01-AF01',
        source_step_id: 'UC-VPET-GPS-01-S02',
        condition: 'Thong tin dau vao thieu',
        steps: [
          {
            step_id: 'UC-VPET-GPS-01-AF01-S01',
            actor_ref: 'Ban quan ly',
            action: 'Yeu cau bo sung thong tin',
            expected_result: 'Nguoi dung nhan yeu cau bo sung.',
          },
        ],
        terminal_outcome: 'Tam dung xu ly.',
      },
    ],
    success_outcome: 'Ho so xu ly da san sang.',
    review_status: 'draft',
  },
];

const baseArtifactChain: ArtifactChainItem[] = [
  {
    artifact_type: 'project_spec',
    label: 'ProjectSpec',
    source_of_truth: true,
    human_editable: true,
    generated_from: [],
    notes: 'Spec cap du an.',
  },
  {
    artifact_type: 'use_case_draft',
    label: 'UseCaseDraft',
    source_of_truth: false,
    human_editable: true,
    generated_from: ['project_spec', 'feature_intent'],
    notes: 'Danh sach use case.',
  },
];

const baseDiagramInventory: UseCaseDiagramInventoryItem[] = [
  {
    use_case_id: 'UC-VPET-GPS-01',
    title: 'Ban quan ly tiep nhan va khoi tao xu ly Cap phat GPS Device',
    review_status: 'approved',
    diagram_status: 'ready_to_open',
    note: 'So do da duoc tao va co the mo tren canvas.',
    can_open_canvas: true,
    is_focused: false,
    is_active_on_canvas: false,
  },
];

function UseCasePanelHarness({
  metadata = null,
}: {
  metadata?: {
    generation_source?: 'ai' | 'deterministic_fallback';
    fallback_reason?: string;
    prompt_id?: string;
    prompt_version?: string;
  } | null;
}) {
  const [projectSpec, setProjectSpec] = useState(baseProjectSpec);
  const [featureIntent, setFeatureIntent] = useState(baseFeatureIntent);
  const [useCases, setUseCases] = useState(baseUseCases);
  const [activeSection, setActiveSection] = useState<UseCaseWorkspaceSection>('input');

  const diagramInventory = buildDiagramInventory(useCases, {
    focusedUseCaseId: null,
    activeCanvasUseCaseId: null,
  });

  return (
    <UseCasePanel
      open
      phase="ready"
      activeSection={activeSection}
      projectSpec={projectSpec}
      featureIntent={featureIntent}
      useCases={useCases}
      diagramInventory={diagramInventory}
      orphanedDiagrams={[]}
      artifactChain={baseArtifactChain}
      requestId="req_usecase_001"
      metadata={metadata}
      errorMessage={null}
      validationErrors={[]}
      isOutdated={false}
      hasDraftChanges={false}
      onClose={vi.fn()}
      onGenerate={vi.fn()}
      onSectionChange={setActiveSection}
      onProjectSpecChange={setProjectSpec}
      onFeatureIntentChange={setFeatureIntent}
      onUseCaseChange={(useCaseId, next) =>
        setUseCases((current) =>
          current.map((useCase) =>
            useCase.use_case_id === useCaseId
              ? applyUseCaseEditLifecycle(useCase, next)
              : useCase,
          ),
        )
      }
      onReviewStatusChange={(useCaseId, nextStatus) =>
        setUseCases((current) =>
          current.map((useCase) =>
            useCase.use_case_id === useCaseId
              ? { ...useCase, review_status: nextStatus }
              : useCase,
          ),
        )
      }
      onApproveAll={() =>
        setUseCases((current) =>
          current.map((useCase) => ({ ...useCase, review_status: 'approved' })),
        )
      }
      onOpenDiagramWorkspace={() => setActiveSection('diagrams')}
      onGenerateDiagram={vi.fn()}
      onOpenDiagramCanvas={vi.fn()}
      onDiscardOrphanedDiagram={vi.fn()}
    />
  );
}

describe('UseCasePanel', () => {
  it('shows the deterministic source and review guidance', () => {
    render(
      <UseCasePanelHarness
        metadata={{
          generation_source: 'deterministic_fallback',
          fallback_reason: 'quality_rejected',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Use case/ }));
    expect(screen.getByText('Bản nháp theo rule')).toBeInTheDocument();
    expect(screen.getByText(/chưa đạt quality gate/)).toBeInTheDocument();
  });

  it('shows AI source with the prompt version', () => {
    render(
      <UseCasePanelHarness
        metadata={{
          generation_source: 'ai',
          prompt_id: 'usecase_synthesis',
          prompt_version: '1.0.0',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Use case/ }));
    expect(screen.getByText('Bản nháp AI')).toBeInTheDocument();
    expect(screen.getByText('Prompt usecase_synthesis@1.0.0')).toBeInTheDocument();
  });

  it('renders the workspace with distinct input, use-case, and diagram zones', () => {
    render(<UseCasePanelHarness />);

    expect(screen.getByRole('heading', { name: 'Không gian use case' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đầu vào/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use case/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sơ đồ/ })).toBeInTheDocument();
    expect(screen.getByText('Chức năng cần mô hình hóa')).toBeInTheDocument();
    expect(screen.getByLabelText('Tên chức năng')).toBeVisible();
    expect(screen.getByLabelText('Mô tả chức năng')).toBeVisible();
    expect(screen.getByLabelText('Actors / swimlanes (mỗi dòng một actor)')).toBeVisible();
    expect(screen.getByLabelText('Điều gì bắt đầu quy trình?')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Bối cảnh dự án' })).toBeVisible();
    expect(screen.getByLabelText('Tên dự án')).toBeVisible();
    expect(screen.getByLabelText('Mô tả bối cảnh')).toBeVisible();
    expect(screen.queryByText('Tên function')).not.toBeInTheDocument();
    expect(screen.queryByText(/Thuật ngữ/)).not.toBeInTheDocument();
    expect(screen.queryByText('Thông tin bổ sung')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Bên tham gia hoặc hệ thống/)).not.toBeInTheDocument();

    expect(screen.getByText('Trace kỹ thuật')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Trace kỹ thuật'));
    expect(screen.getAllByText('ProjectSpec').length).toBeGreaterThan(0);
    expect(screen.getByText('UseCaseDraft')).toBeInTheDocument();

    const summary = screen.getByDisplayValue('Nen tang quan ly cu dan va dich vu noi khu.');
    fireEvent.change(summary, {
      target: { value: 'Nen tang quan ly cu dan, dich vu, va tai san noi khu.' },
    });
    expect(summary).toHaveValue('Nen tang quan ly cu dan, dich vu, va tai san noi khu.');

    fireEvent.click(screen.getByRole('button', { name: /Use case/ }));
    expect(screen.getByText('Danh sách use case đã sinh')).toBeInTheDocument();
    expect(screen.queryByText('Luồng chính tóm tắt')).not.toBeInTheDocument();
    expect(screen.queryByText('Ngoại lệ chính')).not.toBeInTheDocument();
    expect(screen.getByText('2 bước chính · 1 luồng thay thế')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Đánh dấu đã rà soát' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã rà soát' }));
    expect(screen.getByRole('button', { name: 'Phê duyệt' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Phê duyệt' }));
    expect(screen.getByRole('button', { name: 'Mở ở vùng sơ đồ' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mở ở vùng sơ đồ' }));
    expect(screen.getByText('Sơ đồ theo từng use case')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo sơ đồ' })).toBeInTheDocument();
  });

  it('keeps the actor newline while users enter the next actor', () => {
    render(<UseCasePanelHarness />);

    const actorsInput = screen.getByLabelText('Actors / swimlanes (mỗi dòng một actor)');
    fireEvent.change(actorsInput, {
      target: { value: 'Ban quan ly\nCu dan\nPortal\n' },
    });
    expect(actorsInput).toHaveValue('Ban quan ly\nCu dan\nPortal\n');

    fireEvent.change(actorsInput, {
      target: { value: 'Ban quan ly\nCu dan\nPortal\nKy thuat vien' },
    });
    expect(actorsInput).toHaveValue('Ban quan ly\nCu dan\nPortal\nKy thuat vien');
  });

  it('edits structured flows without exposing raw stable IDs', () => {
    render(<UseCasePanelHarness />);
    fireEvent.click(screen.getByRole('button', { name: /Use case/ }));

    expect(screen.getByText('Trace kỹ thuật')).toBeVisible();
    expect(screen.getByText('UC-VPET-GPS-01-S01')).not.toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Thêm bước' }));
    expect(screen.getByText('3 bước chính · 1 luồng thay thế')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Thêm bước nhánh' }));
    expect(screen.getByText('Bước nhánh 2')).toBeVisible();
  });

  it('demotes an approved use case when edited after approval', () => {
    render(<UseCasePanelHarness />);

    fireEvent.click(screen.getByRole('button', { name: /Use case/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã rà soát' }));
    fireEvent.click(screen.getByRole('button', { name: 'Phê duyệt' }));

    const title = screen.getByDisplayValue(
      'Ban quan ly tiep nhan va khoi tao xu ly Cap phat GPS Device',
    );
    fireEvent.change(title, {
      target: { value: 'Ban quan ly tiep nhan va xu ly yeu cau GPS da sua' },
    });

    expect(screen.getByText('Đã rà soát')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Phê duyệt' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sơ đồ/ }));
    expect(screen.getByText('Cần phê duyệt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quay lại use case' })).toBeInTheDocument();
  });

  it('blocks review approval when actor edits leave dangling step references', () => {
    render(<UseCasePanelHarness />);
    fireEvent.click(screen.getByRole('button', { name: /Use case/ }));

    const actors = screen.getByLabelText('Actors');
    fireEvent.change(actors, { target: { value: 'Ban quan ly\nCu dan' } });

    expect(screen.getByText('Actor "Portal" không còn trong use case.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đánh dấu đã rà soát' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Phê duyệt tất cả' })).toBeDisabled();
  });

  it('disables generate and shows validation issues during frontend quick-guard failure', () => {
    render(
      <UseCasePanel
        open
        phase="idle"
        activeSection="input"
        projectSpec={baseProjectSpec}
        featureIntent={baseFeatureIntent}
        useCases={[]}
        diagramInventory={[]}
        orphanedDiagrams={[]}
        artifactChain={[]}
        requestId={null}
        errorMessage={null}
        validationErrors={['Project name là bắt buộc.', 'Feature summary là bắt buộc.']}
        isOutdated={false}
        hasDraftChanges={false}
        onClose={vi.fn()}
        onGenerate={vi.fn()}
        onSectionChange={vi.fn()}
        onProjectSpecChange={vi.fn()}
        onFeatureIntentChange={vi.fn()}
        onUseCaseChange={vi.fn()}
        onReviewStatusChange={vi.fn()}
        onApproveAll={vi.fn()}
        onOpenDiagramWorkspace={vi.fn()}
        onGenerateDiagram={vi.fn()}
        onOpenDiagramCanvas={vi.fn()}
        onDiscardOrphanedDiagram={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Sinh use case' })).toBeDisabled();
    expect(screen.getByText('Project name là bắt buộc.')).toBeInTheDocument();
    expect(screen.getByText('Feature summary là bắt buộc.')).toBeInTheDocument();
  });

  it('shows diagram inventory actions that depend on review status', () => {
    render(
      <UseCasePanel
        open
        phase="ready"
        activeSection="diagrams"
        projectSpec={baseProjectSpec}
        featureIntent={baseFeatureIntent}
        useCases={baseUseCases}
        diagramInventory={[
          {
            ...baseDiagramInventory[0],
            review_status: 'draft',
            diagram_status: 'needs_review',
            note: 'Can ra soat va phe duyet use case truoc khi di sang so do.',
            can_open_canvas: false,
            is_focused: false,
            is_active_on_canvas: false,
          },
        ]}
        orphanedDiagrams={[]}
        artifactChain={[]}
        requestId="req_usecase_001"
        errorMessage={null}
        validationErrors={[]}
        isOutdated={false}
        hasDraftChanges={false}
        onClose={vi.fn()}
        onGenerate={vi.fn()}
        onSectionChange={vi.fn()}
        onProjectSpecChange={vi.fn()}
        onFeatureIntentChange={vi.fn()}
        onUseCaseChange={vi.fn()}
        onReviewStatusChange={vi.fn()}
        onApproveAll={vi.fn()}
        onOpenDiagramWorkspace={vi.fn()}
        onGenerateDiagram={vi.fn()}
        onOpenDiagramCanvas={vi.fn()}
        onDiscardOrphanedDiagram={vi.fn()}
      />,
    );

    expect(screen.getByText('Cần phê duyệt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quay lại use case' })).toBeInTheDocument();
  });

  it('does not expose Open canvas for an approved but outdated diagram', () => {
    render(
      <UseCasePanel
        open
        phase="ready"
        activeSection="diagrams"
        projectSpec={baseProjectSpec}
        featureIntent={baseFeatureIntent}
        useCases={[{ ...baseUseCases[0], review_status: 'approved' }]}
        diagramInventory={[
          {
            ...baseDiagramInventory[0],
            diagram_status: 'outdated',
            note: 'Noi dung use case da thay doi.',
            can_open_canvas: false,
          },
        ]}
        orphanedDiagrams={[]}
        artifactChain={[]}
        requestId="req_usecase_001"
        errorMessage={null}
        validationErrors={[]}
        isOutdated={false}
        hasDraftChanges={false}
        onClose={vi.fn()}
        onGenerate={vi.fn()}
        onSectionChange={vi.fn()}
        onProjectSpecChange={vi.fn()}
        onFeatureIntentChange={vi.fn()}
        onUseCaseChange={vi.fn()}
        onReviewStatusChange={vi.fn()}
        onApproveAll={vi.fn()}
        onOpenDiagramWorkspace={vi.fn()}
        onGenerateDiagram={vi.fn()}
        onOpenDiagramCanvas={vi.fn()}
        onDiscardOrphanedDiagram={vi.fn()}
      />,
    );

    expect(screen.getByText('Sơ đồ đã lỗi thời')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mở canvas' })).not.toBeInTheDocument();
  });

  it('keeps saved orphan diagrams visible until explicitly discarded', () => {
    const onOpen = vi.fn();
    const onDiscard = vi.fn();
    render(
      <UseCasePanel
        open
        phase="ready"
        activeSection="diagrams"
        projectSpec={baseProjectSpec}
        featureIntent={baseFeatureIntent}
        useCases={[]}
        diagramInventory={[]}
        orphanedDiagrams={[
          {
            use_case_id: 'UC-OLD-01',
            title: 'Bản sơ đồ cũ',
            semantic_edited: true,
          },
        ]}
        artifactChain={[]}
        requestId={null}
        errorMessage={null}
        validationErrors={[]}
        isOutdated={false}
        hasDraftChanges={false}
        onClose={vi.fn()}
        onGenerate={vi.fn()}
        onSectionChange={vi.fn()}
        onProjectSpecChange={vi.fn()}
        onFeatureIntentChange={vi.fn()}
        onUseCaseChange={vi.fn()}
        onReviewStatusChange={vi.fn()}
        onApproveAll={vi.fn()}
        onOpenDiagramWorkspace={vi.fn()}
        onGenerateDiagram={vi.fn()}
        onOpenDiagramCanvas={onOpen}
        onDiscardOrphanedDiagram={onDiscard}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mở bản lưu' }));
    expect(onOpen).toHaveBeenCalledWith('UC-OLD-01');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bản lưu' }));
    expect(onDiscard).toHaveBeenCalledWith('UC-OLD-01');
  });
});
