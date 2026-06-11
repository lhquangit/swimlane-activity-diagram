import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import BrdPanel from './BrdPanel';
import type { BrdSpec, BrdTabId } from './types';

const baseSpec: BrdSpec = {
  metadata: {
    diagram_name: 'Demo BRD',
    source_language: 'vi',
    generated_language: 'vi',
    generated_at: '2026-05-31T10:00:00Z',
    generator_model: 'openai/gpt-5.5',
    generator_version: 'mock-deterministic-v1',
  },
  summary: 'Demo summary',
  actors: [{ lane_id: 'lane-a', actor_name: 'VOC', responsibilities: [] }],
  main_flow_steps: [
    {
      step_id: 'S01',
      node_id: 'n-a1',
      actor_lane_id: 'lane-a',
      actor_name: 'VOC',
      description: 'VOC thực hiện bước đầu tiên',
    },
  ],
  branches: [],
  parallel_blocks: [],
  handoffs: [],
  loops: [],
  annotations: ['Cần xác nhận BA'],
  context_notes: [],
  assumptions: [],
  open_questions: [],
  warnings: [],
};

function BrdPanelHarness({ onLoadServerVersion = null }: { onLoadServerVersion?: (() => void) | null }) {
  const [tab, setTab] = useState<BrdTabId>('warnings');
  const [draft, setDraft] = useState('# Demo draft');

  return (
    <BrdPanel
      open
      phase="ready"
      activeTab={tab}
      onTabChange={setTab}
      warnings={[
        {
          code: 'DECISION_UNLABELED',
          severity: 'warning',
          message: 'Một decision chưa có label.',
          related_node_ids: ['n-dec1'],
        },
      ]}
      blockingIssues={[]}
      spec={baseSpec}
      draft={draft}
      onDraftChange={setDraft}
      onClose={vi.fn()}
      onCopy={vi.fn()}
      onExport={vi.fn()}
      onRetry={vi.fn()}
      onLoadServerVersion={onLoadServerVersion}
      onAcknowledgeOutdated={vi.fn()}
      metadata={{
        model: 'openai/gpt-5.5',
        latency_ms: 850,
        estimated_cost_usd: 0.01,
      }}
      requestId="req_demo_001"
      runtimeStatus="completed"
      error={null}
      isOutdated
    />
  );
}

describe('BrdPanel', () => {
  it('renders user-facing warnings and editable draft tabs without telemetry or raw spec payloads', () => {
    render(<BrdPanelHarness />);

    expect(screen.getByText('AI BRD Draft')).toBeInTheDocument();
    expect(screen.getByText('Outdated')).toBeInTheDocument();
    expect(screen.getByText('DECISION_UNLABELED')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Structured Spec' })).not.toBeInTheDocument();
    expect(screen.queryByText('req_demo_001')).not.toBeInTheDocument();
    expect(screen.queryByText('openai/gpt-5.5')).not.toBeInTheDocument();
    expect(screen.queryByText('850 ms')).not.toBeInTheDocument();
    expect(screen.queryByText('~ $0.01')).not.toBeInTheDocument();
    expect(screen.queryByText('n-dec1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'BRD Draft' }));
    const textarea = screen.getByPlaceholderText(
      'BRD draft sẽ xuất hiện ở đây sau khi generate.',
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe('# Demo draft');

    fireEvent.change(textarea, { target: { value: '# Draft da sua' } });
    expect(textarea.value).toBe('# Draft da sua');
  });

  it('requires an explicit action before replacing local recovery with the server version', () => {
    const onLoadServerVersion = vi.fn();
    render(<BrdPanelHarness onLoadServerVersion={onLoadServerVersion} />);

    expect(screen.getByText('Có BRD đã lưu trên server')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dùng bản server' }));

    expect(onLoadServerVersion).toHaveBeenCalledOnce();
  });
});
