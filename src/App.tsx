import { useEffect, useRef, useState } from 'react';
import LogicFlow from '@logicflow/core';
import '@logicflow/core/dist/style/index.css';
import { Snapshot, SelectionSelect } from '@logicflow/extension';
import '@logicflow/extension/lib/style/index.css';

import { registerNodes, LANES } from './nodes';
import { buildInitialData, getLogicFlowOptions, snapToLane } from './lf-config';
import DndPanel, { DndPaletteItem } from './DndPanel';

LogicFlow.use(Snapshot);
LogicFlow.use(SelectionSelect);

const PALETTE: DndPaletteItem[] = [
  {
    id: 'start',
    label: 'Start',
    nodeType: 'start',
    swatch: (
      <svg viewBox="0 0 28 22">
        <circle cx="14" cy="11" r="7" fill="#111827" />
      </svg>
    ),
  },
  {
    id: 'activity',
    label: 'Activity',
    nodeType: 'activity',
    properties: { width: 180, height: 44 },
    text: 'Activity',
    swatch: (
      <svg viewBox="0 0 28 22">
        <rect x="2" y="5" width="24" height="12" rx="4" fill="#fff2cc" stroke="#d6b656" />
      </svg>
    ),
  },
  {
    id: 'decision',
    label: 'Decision',
    nodeType: 'decision',
    text: 'Quyết định?',
    swatch: (
      <svg viewBox="0 0 28 22">
        <polygon points="14,3 25,11 14,19 3,11" fill="#ffffff" stroke="#9c2a47" />
      </svg>
    ),
  },
  {
    id: 'sync-bar',
    label: 'Sync Bar (fork/join)',
    nodeType: 'sync-bar',
    properties: { width: 320, height: 8 },
    swatch: (
      <svg viewBox="0 0 28 22">
        <rect x="2" y="9" width="24" height="4" fill="#111827" />
      </svg>
    ),
  },
  {
    id: 'end',
    label: 'End',
    nodeType: 'end',
    swatch: (
      <svg viewBox="0 0 28 22">
        <circle cx="14" cy="11" r="8" fill="#ffffff" stroke="#111827" strokeWidth="1.5" />
        <circle cx="14" cy="11" r="4" fill="#111827" />
      </svg>
    ),
  },
  {
    id: 'note',
    label: 'Sticky Note',
    nodeType: 'note',
    properties: { width: 220, height: 90 },
    text: 'Ghi chú…',
    swatch: (
      <svg viewBox="0 0 28 22">
        <rect x="3" y="3" width="22" height="16" fill="#fff2cc" stroke="#d6b656" />
      </svg>
    ),
  },
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const lfRef = useRef<LogicFlow | null>(null);
  const [status, setStatus] = useState('Đang khởi tạo…');

  useEffect(() => {
    if (!containerRef.current) return;

    const lf = new LogicFlow(getLogicFlowOptions(containerRef.current));
    registerNodes(lf);

    lf.render(buildInitialData());
    lf.fitView(20, 20);

    // Snap newly-dropped (via dnd) nodes to nearest lane center
    lf.on('node:dnd-add', ({ data }) => {
      if (!data || !data.type) return;
      if (data.type === 'lane') return;
      // sync-bar usually stretches across multiple lanes — keep its x
      if (data.type === 'sync-bar') return;
      const snappedX = snapToLane(data.x);
      lf.graphModel.getNodeModelById(data.id)?.moveTo(snappedX, data.y);
    });

    // Also snap when moving an existing node (light touch — only on drag end)
    lf.on('node:drop', ({ data }) => {
      if (!data || !data.type) return;
      if (data.type === 'lane' || data.type === 'sync-bar') return;
      const snappedX = snapToLane(data.x);
      lf.graphModel.getNodeModelById(data.id)?.moveTo(snappedX, data.y);
    });

    // Prevent lane deletion via DELETE key
    lf.on('node:delete', ({ data }) => {
      if (data?.type === 'lane') {
        lf.addNode({
          id: data.id,
          type: 'lane',
          x: data.x,
          y: data.y,
          properties: data.properties,
          text: data.text,
        });
      }
    });

    lfRef.current = lf;
    setStatus(`Sẵn sàng — ${LANES.length} lane đã được tạo`);

    return () => {
      // LogicFlow does not expose explicit dispose; we rely on container teardown
      lfRef.current = null;
    };
  }, []);

  const handleStartDrag = (item: DndPaletteItem) => {
    const lf = lfRef.current;
    if (!lf) return;
    lf.dnd.startDrag({
      type: item.nodeType,
      properties: item.properties ?? {},
      text: item.text ?? '',
    });
  };

  const handleExportPNG = async () => {
    const lf = lfRef.current;
    if (!lf) return;
    setStatus('Đang export PNG…');
    await (lf as unknown as {
      getSnapshot: (filename: string, options?: Record<string, unknown>) => Promise<unknown>;
    }).getSnapshot('swimlane.png', { fileType: 'png', backgroundColor: '#ffffff' });
    setStatus('Đã tải swimlane.png');
  };

  const handleExportSVG = () => {
    const lf = lfRef.current;
    if (!lf) return;
    setStatus('Đang export SVG…');
    // Grab the lf-canvas SVG element and serialize it.
    const svgEl = (containerRef.current?.querySelector('svg.lf-canvas-overlay') ||
      containerRef.current?.querySelector('svg')) as SVGSVGElement | null;
    if (!svgEl) {
      setStatus('Không tìm thấy SVG canvas.');
      return;
    }
    // Clone so we can normalize size & strip transforms if needed.
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    // Ensure xmlns
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const serializer = new XMLSerializer();
    const xml = serializer.serializeToString(clone);
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], {
      type: 'image/svg+xml',
    });
    downloadBlob(blob, 'swimlane.svg');
    setStatus('Đã tải swimlane.svg');
  };

  const handleExportJSON = () => {
    const lf = lfRef.current;
    if (!lf) return;
    const data = lf.getGraphData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'swimlane.json');
    setStatus('Đã tải swimlane.json');
  };

  const handleImportJSON = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        lfRef.current?.render(data);
        setStatus(`Đã load: ${file.name}`);
      } catch (e) {
        setStatus(`Lỗi parse JSON: ${(e as Error).message}`);
      }
    };
    reader.readAsText(file);
    ev.target.value = '';
  };

  const handleResetSample = () => {
    lfRef.current?.render(buildInitialData());
    lfRef.current?.fitView(20, 20);
    setStatus('Đã reset về diagram mẫu');
  };

  const handleClear = () => {
    if (!lfRef.current) return;
    lfRef.current.clearData();
    // Re-render lanes only
    lfRef.current.render({
      nodes: LANES.map((lane) => ({
        id: lane.id,
        type: 'lane',
        x: lane.x,
        y: 580,
        properties: { width: lane.width, height: 1100 },
        text: { value: lane.title, x: lane.x, y: 60 },
      })),
      edges: [],
    });
    setStatus('Đã xoá nội dung (giữ lại lane)');
  };

  const handleUndo = () => lfRef.current?.undo();
  const handleRedo = () => lfRef.current?.redo();
  const handleZoomIn = () => lfRef.current?.zoom(true);
  const handleZoomOut = () => lfRef.current?.zoom(false);
  const handleFit = () => lfRef.current?.fitView(20, 20);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Swimlane Activity Diagram — LogicFlow PoC</h1>
        <button className="toolbar-btn" onClick={handleUndo} title="Ctrl+Z">
          ↶
        </button>
        <button className="toolbar-btn" onClick={handleRedo} title="Ctrl+Y">
          ↷
        </button>
        <button className="toolbar-btn" onClick={handleZoomOut}>
          −
        </button>
        <button className="toolbar-btn" onClick={handleZoomIn}>
          +
        </button>
        <button className="toolbar-btn" onClick={handleFit}>
          Fit
        </button>
        <span style={{ width: 8 }} />
        <button className="toolbar-btn" onClick={handleResetSample}>
          Reset mẫu
        </button>
        <button className="toolbar-btn" onClick={handleClear}>
          Xoá nội dung
        </button>
        <label className="toolbar-btn" style={{ cursor: 'pointer' }}>
          Mở JSON…
          <input
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleImportJSON}
          />
        </label>
        <button className="toolbar-btn" onClick={handleExportJSON}>
          Lưu JSON
        </button>
        <button className="toolbar-btn" onClick={handleExportSVG}>
          Export SVG
        </button>
        <button className="toolbar-btn primary" onClick={handleExportPNG}>
          Export PNG
        </button>
        <span className="toolbar-status">{status}</span>
      </header>

      <DndPanel items={PALETTE} onStartDrag={handleStartDrag} />

      <div className="app-canvas">
        <div ref={containerRef} className="canvas-host lf-container" />
      </div>
    </div>
  );
}
