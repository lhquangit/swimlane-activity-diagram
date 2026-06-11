import type {
  UseCaseDiagramArtifactState,
  UseCaseDiagramInventoryItem,
  UseCaseDiagramStatus,
  UseCaseDraft,
} from './types';

type DiagramLifecycleInput = {
  reviewStatus: UseCaseDraft['review_status'];
  artifactState?: UseCaseDiagramArtifactState;
  isActiveOnCanvas: boolean;
};

type DiagramLifecycle = {
  status: UseCaseDiagramStatus;
  canOpenCanvas: boolean;
  label: string;
  note: string;
};

type BuildDiagramInventoryOptions = {
  focusedUseCaseId: string | null;
  activeCanvasUseCaseId: string | null;
  artifactStates?: Partial<Record<string, UseCaseDiagramArtifactState>>;
  operationStates?: Partial<Record<string, 'generating' | 'opening' | 'failed' | undefined>>;
};

const DIAGRAM_LIFECYCLE_COPY: Record<
  UseCaseDiagramStatus,
  Pick<DiagramLifecycle, 'canOpenCanvas' | 'label' | 'note'>
> = {
  needs_review: {
    canOpenCanvas: false,
    label: 'Cần phê duyệt',
    note: 'Cần rà soát và phê duyệt use case trước khi đi sang sơ đồ.',
  },
  ready_to_generate: {
    canOpenCanvas: false,
    label: 'Chưa tạo sơ đồ',
    note: 'Use case đã được phê duyệt và sẵn sàng để tạo sơ đồ.',
  },
  ready_to_open: {
    canOpenCanvas: true,
    label: 'Sẵn sàng mở',
    note: 'Sơ đồ đã được tạo và có thể mở trên canvas.',
  },
  active_on_canvas: {
    canOpenCanvas: true,
    label: 'Đang gắn với canvas',
    note: 'Canvas hiện tại đang gắn với use case này.',
  },
  outdated: {
    canOpenCanvas: false,
    label: 'Sơ đồ đã lỗi thời',
    note: 'Nội dung use case đã thay đổi. Cần sinh lại sơ đồ trước khi mở canvas.',
  },
  diverged: {
    canOpenCanvas: false,
    label: 'Sơ đồ đã phân kỳ',
    note: 'Use case và sơ đồ đã thay đổi độc lập. Cần xử lý khác biệt trước khi mở canvas.',
  },
  generating: {
    canOpenCanvas: false,
    label: 'Đang sinh sơ đồ',
    note: 'Hệ thống đang sinh sơ đồ cho use case này.',
  },
  failed: {
    canOpenCanvas: false,
    label: 'Sinh sơ đồ thất bại',
    note: 'Chưa thể mở canvas vì lần sinh sơ đồ gần nhất thất bại.',
  },
};

export function didUseCaseContentChange(previous: UseCaseDraft, next: UseCaseDraft) {
  const { review_status: _previousStatus, ...previousContent } = previous;
  const { review_status: _nextStatus, ...nextContent } = next;
  return JSON.stringify(previousContent) !== JSON.stringify(nextContent);
}

export function applyUseCaseEditLifecycle(
  previous: UseCaseDraft,
  next: UseCaseDraft,
): UseCaseDraft {
  if (previous.review_status !== 'approved' || !didUseCaseContentChange(previous, next)) {
    return next;
  }

  return {
    ...next,
    review_status: 'reviewed',
  };
}

export function deriveUseCaseDiagramLifecycle({
  reviewStatus,
  artifactState = 'not_started',
  isActiveOnCanvas,
}: DiagramLifecycleInput): DiagramLifecycle {
  let status: UseCaseDiagramStatus;

  if (reviewStatus !== 'approved') {
    status = 'needs_review';
  } else if (artifactState === 'ready') {
    status = isActiveOnCanvas ? 'active_on_canvas' : 'ready_to_open';
  } else if (artifactState !== 'not_started') {
    status = artifactState;
  } else {
    status = 'ready_to_generate';
  }

  return {
    status,
    ...DIAGRAM_LIFECYCLE_COPY[status],
  };
}

export function buildDiagramInventory(
  useCases: UseCaseDraft[],
  {
    focusedUseCaseId,
    activeCanvasUseCaseId,
    artifactStates = {},
    operationStates = {},
  }: BuildDiagramInventoryOptions,
): UseCaseDiagramInventoryItem[] {
  return useCases.map((useCase) => {
    const isActiveOnCanvas = activeCanvasUseCaseId === useCase.use_case_id;
    const operationState = operationStates[useCase.use_case_id];
    const artifactState = artifactStates[useCase.use_case_id];
    const lifecycle = deriveUseCaseDiagramLifecycle({
      reviewStatus: useCase.review_status,
      artifactState:
        operationState === 'generating'
          ? 'generating'
          : operationState === 'failed' && (!artifactState || artifactState === 'not_started')
            ? 'failed'
            : artifactState,
      isActiveOnCanvas,
    });

    return {
      use_case_id: useCase.use_case_id,
      title: useCase.title,
      review_status: useCase.review_status,
      diagram_status: lifecycle.status,
      note: lifecycle.note,
      can_open_canvas: lifecycle.canOpenCanvas,
      is_focused: focusedUseCaseId === useCase.use_case_id,
      is_active_on_canvas: isActiveOnCanvas,
      operation_state: operationState,
    };
  });
}

export function diagramStatusLabel(status: UseCaseDiagramStatus) {
  return DIAGRAM_LIFECYCLE_COPY[status].label;
}
