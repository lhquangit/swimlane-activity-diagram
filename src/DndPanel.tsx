import { ReactNode } from 'react';

export interface DndPaletteItem {
  id: string;
  label: string;
  nodeType: string;
  properties?: Record<string, unknown>;
  text?: string;
  swatch: ReactNode;
}

interface Props {
  items: DndPaletteItem[];
  onStartDrag: (item: DndPaletteItem) => void;
}

export default function DndPanel({ items, onStartDrag }: Props) {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-section">
        <h3>Shape</h3>
        {items.map((item) => (
          <div
            key={item.id}
            className="dnd-item"
            onMouseDown={() => onStartDrag(item)}
            title={`Kéo vào canvas để thêm ${item.label}`}
          >
            <div className="swatch">{item.swatch}</div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="sidebar-section">
        <h3>Hướng dẫn</h3>
        <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
          • <b>Kéo</b> shape vào canvas để thêm node.
          <br />• <b>Nối edge</b>: di chuột vào node, kéo từ điểm xanh ra.
          <br />• <b>Sửa text</b>: double-click vào node hoặc edge.
          <br />• <b>Xoá</b>: chọn rồi nhấn DEL.
          <br />• Node sẽ tự snap vào lane gần nhất khi thả.
        </p>
      </div>
    </aside>
  );
}
