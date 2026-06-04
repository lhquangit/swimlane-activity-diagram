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

function BrdPanelHarness() {
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
  it('renders warnings, spec, and editable draft tabs', () => {
    render(<BrdPanelHarness />);

    expect(screen.getByText('AI BRD Draft')).toBeInTheDocument();
    expect(screen.getByText('Outdated')).toBeInTheDocument();
    expect(screen.getByText('DECISION_UNLABELED')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Structured Spec' }));
    expect(screen.getByText(/Demo summary/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'BRD Draft' }));
    const textarea = screen.getByPlaceholderText(
      'BRD draft sẽ xuất hiện ở đây sau khi generate.',
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe('# Demo draft');

    fireEvent.change(textarea, { target: { value: '# Draft da sua' } });
    expect(textarea.value).toBe('# Draft da sua');
  });
});
