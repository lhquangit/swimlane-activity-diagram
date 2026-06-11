import type { ReactNode } from 'react';

type MarkdownListItem = {
  text: string;
  children: string[];
};

type MarkdownTable = {
  headers: string[];
  rows: string[][];
};

type MarkdownFigure = {
  alt: string;
  src: string;
  caption: string | null;
};

export type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'unordered-list'; items: MarkdownListItem[] }
  | { type: 'ordered-list'; items: MarkdownListItem[] }
  | { type: 'table'; table: MarkdownTable }
  | { type: 'figure'; figure: MarkdownFigure }
  | { type: 'rule' };

type EditableMarkdownDocumentProps = {
  markdown: string;
  onChange: (markdown: string) => void;
};

export function renderMarkdownDocument(markdown: string): ReactNode {
  const blocks = parseMarkdown(markdown);
  if (blocks.length === 0) {
    return <p className="persisted-brd__document-empty">BRD chưa có nội dung để hiển thị.</p>;
  }

  return blocks.map((block, index) => renderStaticBlock(block, index));
}

export function EditableMarkdownDocument({
  markdown,
  onChange,
}: EditableMarkdownDocumentProps): ReactNode {
  const blocks = parseMarkdown(markdown);
  if (blocks.length === 0) {
    return (
      <textarea
        className="persisted-brd__document-editor persisted-brd__document-editor--empty"
        value=""
        onChange={(event) => onChange(event.target.value)}
        placeholder="Nhập nội dung BRD…"
        aria-label="BRD empty document editor"
      />
    );
  }

  return blocks.map((block, index) =>
    renderEditableBlock(block, index, blocks, (nextBlocks) => onChange(serializeMarkdown(nextBlocks))),
  );
}

export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }

    const figureMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (figureMatch) {
      const nextTrimmed = lines[index + 1]?.trim() ?? '';
      const caption = /^Hình\s+\d+:/i.test(nextTrimmed) || /^Figure\s+\d+:/i.test(nextTrimmed)
        ? nextTrimmed
        : null;
      blocks.push({
        type: 'figure',
        figure: {
          alt: figureMatch[1].trim() || 'Hình minh họa',
          src: figureMatch[2].trim(),
          caption,
        },
      });
      index += caption ? 2 : 1;
      continue;
    }

    if (isTableHeader(trimmed, lines[index + 1]?.trim() ?? '')) {
      const { table, nextIndex } = parseTable(lines, index);
      blocks.push({ type: 'table', table });
      index = nextIndex;
      continue;
    }

    if (unorderedListMatch(trimmed)) {
      const { items, nextIndex } = parseList(lines, index, 'unordered-list');
      blocks.push({ type: 'unordered-list', items });
      index = nextIndex;
      continue;
    }

    if (orderedListMatch(trimmed)) {
      const { items, nextIndex } = parseList(lines, index, 'ordered-list');
      blocks.push({ type: 'ordered-list', items });
      index = nextIndex;
      continue;
    }

    const paragraphLines: string[] = [trimmed];
    index += 1;
    while (index < lines.length) {
      const nextTrimmed = lines[index].trim();
      if (
        !nextTrimmed ||
        nextTrimmed.match(/^(#{1,6})\s+(.+)$/) ||
        /^---+$/.test(nextTrimmed) ||
        /^!\[([^\]]*)\]\(([^)]+)\)$/.test(nextTrimmed) ||
        isTableHeader(nextTrimmed, lines[index + 1]?.trim() ?? '') ||
        unorderedListMatch(nextTrimmed) ||
        orderedListMatch(nextTrimmed)
      ) {
        break;
      }
      paragraphLines.push(nextTrimmed);
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
  }

  return blocks;
}

export function serializeMarkdown(blocks: MarkdownBlock[]): string {
  return blocks
    .map((block, index) => serializeBlock(block, index))
    .filter((section) => section.trim().length > 0)
    .join('\n\n');
}

function renderStaticBlock(block: MarkdownBlock, index: number) {
  const key = `${block.type}-${index}`;
  switch (block.type) {
    case 'heading':
      return renderHeading(block, key);
    case 'paragraph':
      return (
        <p key={key} className="persisted-brd__document-paragraph">
          {block.text}
        </p>
      );
    case 'unordered-list':
      return renderList(block.items, 'ul', key);
    case 'ordered-list':
      return renderList(block.items, 'ol', key);
    case 'table':
      return renderStaticTable(block.table, key);
    case 'figure':
      return renderStaticFigure(block.figure, key);
    case 'rule':
      return <hr key={key} className="persisted-brd__document-rule" />;
  }
}

function renderEditableBlock(
  block: MarkdownBlock,
  index: number,
  blocks: MarkdownBlock[],
  onBlocksChange: (blocks: MarkdownBlock[]) => void,
) {
  const key = `${block.type}-${index}`;

  const updateBlock = (nextBlock: MarkdownBlock) => {
    const nextBlocks = blocks.map((current, currentIndex) => (currentIndex === index ? nextBlock : current));
    onBlocksChange(nextBlocks);
  };

  switch (block.type) {
    case 'heading':
      return (
        <input
          key={key}
          className={`persisted-brd__document-editor persisted-brd__document-editor--h${Math.min(
            block.level,
            4,
          )}`}
          value={block.text}
          onChange={(event) => updateBlock({ ...block, text: event.target.value })}
          aria-label={`BRD heading ${index + 1}`}
        />
      );
    case 'paragraph':
      return (
        <textarea
          key={key}
          className="persisted-brd__document-editor persisted-brd__document-editor--paragraph"
          value={block.text}
          onChange={(event) => updateBlock({ ...block, text: event.target.value })}
          aria-label={`BRD paragraph ${index + 1}`}
          rows={rowsForText(block.text, 2)}
        />
      );
    case 'unordered-list':
      return renderEditableList(block, index, 'unordered-list', updateBlock, key);
    case 'ordered-list':
      return renderEditableList(block, index, 'ordered-list', updateBlock, key);
    case 'table':
      return renderEditableTable(block.table, key, (nextTable) => updateBlock({ ...block, table: nextTable }));
    case 'figure':
      return renderEditableFigure(block.figure, key, (nextFigure) => updateBlock({ ...block, figure: nextFigure }));
    case 'rule':
      return <hr key={key} className="persisted-brd__document-rule" />;
  }
}

function renderHeading(block: Extract<MarkdownBlock, { type: 'heading' }>, key: string) {
  const className = `persisted-brd__document-heading persisted-brd__document-heading--h${Math.min(
    block.level,
    4,
  )}`;

  switch (block.level) {
    case 1:
      return (
        <h1 key={key} className={className}>
          {block.text}
        </h1>
      );
    case 2:
      return (
        <h2 key={key} className={className}>
          {block.text}
        </h2>
      );
    case 3:
      return (
        <h3 key={key} className={className}>
          {block.text}
        </h3>
      );
    default:
      return (
        <h4 key={key} className={className}>
          {block.text}
        </h4>
      );
  }
}

function renderList(items: MarkdownListItem[], kind: 'ul' | 'ol', key: string) {
  const Tag = kind;
  return (
    <Tag key={key} className={`persisted-brd__document-list persisted-brd__document-list--${kind}`}>
      {items.map((item, index) => (
        <li key={`${key}-item-${index}`}>
          <span>{item.text}</span>
          {item.children.length > 0 ? (
            <ul className="persisted-brd__document-sublist">
              {item.children.map((child, childIndex) => (
                <li key={`${key}-item-${index}-child-${childIndex}`}>{child}</li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </Tag>
  );
}

function renderEditableList(
  block: Extract<MarkdownBlock, { type: 'unordered-list' | 'ordered-list' }>,
  index: number,
  kind: 'unordered-list' | 'ordered-list',
  onChange: (nextBlock: MarkdownBlock) => void,
  key: string,
) {
  const Tag = kind === 'unordered-list' ? 'ul' : 'ol';
  return (
    <Tag key={key} className={`persisted-brd__document-list persisted-brd__document-list--${Tag}`}>
      {block.items.map((item, itemIndex) => (
        <li key={`${key}-item-${itemIndex}`}>
          <input
            className="persisted-brd__document-editor persisted-brd__document-editor--list"
            value={item.text}
            onChange={(event) =>
              onChange({
                ...block,
                items: block.items.map((current, currentIndex) =>
                  currentIndex === itemIndex ? { ...current, text: event.target.value } : current,
                ),
              })
            }
            aria-label={`BRD list item ${index + 1}-${itemIndex + 1}`}
          />
          {item.children.length > 0 ? (
            <ul className="persisted-brd__document-sublist">
              {item.children.map((child, childIndex) => (
                <li key={`${key}-item-${itemIndex}-child-${childIndex}`}>
                  <input
                    className="persisted-brd__document-editor persisted-brd__document-editor--list-child"
                    value={child}
                    onChange={(event) =>
                      onChange({
                        ...block,
                        items: block.items.map((current, currentIndex) =>
                          currentIndex === itemIndex
                            ? {
                                ...current,
                                children: current.children.map((currentChild, currentChildIndex) =>
                                  currentChildIndex === childIndex ? event.target.value : currentChild,
                                ),
                              }
                            : current,
                        ),
                      })
                    }
                    aria-label={`BRD list child ${index + 1}-${itemIndex + 1}-${childIndex + 1}`}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </Tag>
  );
}

function renderStaticTable(table: MarkdownTable, key: string) {
  return (
    <div key={key} className="persisted-brd__document-table-wrap">
      <table className="persisted-brd__document-table">
        <thead>
          <tr>
            {table.headers.map((header, index) => (
              <th key={`${key}-head-${index}`}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${key}-row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${key}-row-${rowIndex}-cell-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderEditableTable(
  table: MarkdownTable,
  key: string,
  onChange: (table: MarkdownTable) => void,
) {
  return (
    <div key={key} className="persisted-brd__document-table-wrap">
      <table className="persisted-brd__document-table">
        <thead>
          <tr>
            {table.headers.map((header, index) => (
              <th key={`${key}-head-${index}`}>
                <input
                  className="persisted-brd__document-editor persisted-brd__document-editor--table-head"
                  value={header}
                  onChange={(event) =>
                    onChange({
                      ...table,
                      headers: table.headers.map((current, currentIndex) =>
                        currentIndex === index ? event.target.value : current,
                      ),
                    })
                  }
                  aria-label={`BRD table header ${index + 1}`}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${key}-row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${key}-row-${rowIndex}-cell-${cellIndex}`}>
                  <input
                    className="persisted-brd__document-editor persisted-brd__document-editor--table-cell"
                    value={cell}
                    onChange={(event) =>
                      onChange({
                        ...table,
                        rows: table.rows.map((currentRow, currentRowIndex) =>
                          currentRowIndex === rowIndex
                            ? currentRow.map((currentCell, currentCellIndex) =>
                                currentCellIndex === cellIndex ? event.target.value : currentCell,
                              )
                            : currentRow,
                        ),
                      })
                    }
                    aria-label={`BRD table cell ${rowIndex + 1}-${cellIndex + 1}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderStaticFigure(figure: MarkdownFigure, key: string) {
  return (
    <figure key={key} className="persisted-brd__document-figure">
      <div className="persisted-brd__document-figure-placeholder" aria-label={figure.alt}>
        <span>{figure.alt}</span>
        <small>{figure.src}</small>
      </div>
      {figure.caption ? (
        <figcaption className="persisted-brd__document-caption">{figure.caption}</figcaption>
      ) : null}
    </figure>
  );
}

function renderEditableFigure(
  figure: MarkdownFigure,
  key: string,
  onChange: (figure: MarkdownFigure) => void,
) {
  return (
    <figure key={key} className="persisted-brd__document-figure">
      <div className="persisted-brd__document-figure-placeholder" aria-label={figure.alt}>
        <span>{figure.alt}</span>
        <small>{figure.src}</small>
      </div>
      <input
        className="persisted-brd__document-editor persisted-brd__document-editor--caption"
        value={figure.caption ?? ''}
        onChange={(event) => onChange({ ...figure, caption: event.target.value })}
        aria-label={`BRD figure caption ${key}`}
      />
    </figure>
  );
}

function serializeBlock(block: MarkdownBlock, index: number): string {
  switch (block.type) {
    case 'heading':
      return `${'#'.repeat(block.level)} ${block.text.trim()}`;
    case 'paragraph':
      return block.text.trim();
    case 'unordered-list':
      return serializeList(block.items, false);
    case 'ordered-list':
      return serializeList(block.items, true);
    case 'table':
      return renderMarkdownTable(block.table.headers, block.table.rows);
    case 'figure': {
      const figureLines = [`![${block.figure.alt}](${block.figure.src})`];
      if (block.figure.caption?.trim()) figureLines.push(block.figure.caption.trim());
      return figureLines.join('\n');
    }
    case 'rule':
      return '---';
    default:
      return `<!-- unsupported block ${index} -->`;
  }
}

function serializeList(items: MarkdownListItem[], ordered: boolean) {
  return items
    .map((item, index) => {
      const prefix = ordered ? `${index + 1}.` : '-';
      const lines = [`${prefix} ${item.text.trim()}`];
      for (const child of item.children) {
        lines.push(`  - ${child.trim()}`);
      }
      return lines.join('\n');
    })
    .join('\n');
}

function renderMarkdownTable(headers: string[], rows: string[][]) {
  const normalizedHeaders = headers.map((header) => header.trim());
  const lines = [
    `| ${normalizedHeaders.join(' | ')} |`,
    `| ${normalizedHeaders.map(() => ':----').join(' | ')} |`,
  ];
  for (const row of rows) {
    lines.push(`| ${row.map((cell) => cell.trim()).join(' | ')} |`);
  }
  return lines.join('\n');
}

function parseList(
  lines: string[],
  startIndex: number,
  kind: 'unordered-list' | 'ordered-list',
): { items: MarkdownListItem[]; nextIndex: number } {
  const items: MarkdownListItem[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed) break;

    const isMatchingLine =
      kind === 'unordered-list' ? unorderedListMatch(trimmed) : orderedListMatch(trimmed);
    if (!isMatchingLine) break;

    const text = trimmed.replace(kind === 'unordered-list' ? /^-\s+/ : /^\d+\.\s+/, '').trim();
    const item: MarkdownListItem = { text, children: [] };
    index += 1;

    while (index < lines.length) {
      const childLine = lines[index];
      if (!childLine.trim()) {
        index += 1;
        break;
      }
      if (/^\s+-\s+/.test(childLine)) {
        item.children.push(childLine.replace(/^\s+-\s+/, '').trim());
        index += 1;
        continue;
      }
      if (/^\s+/.test(childLine) && item.children.length === 0) {
        item.text = `${item.text} ${childLine.trim()}`.trim();
        index += 1;
        continue;
      }
      break;
    }

    items.push(item);
  }

  return { items, nextIndex: index };
}

function parseTable(lines: string[], startIndex: number): { table: MarkdownTable; nextIndex: number } {
  const headers = parseTableCells(lines[startIndex].trim());
  const rows: string[][] = [];
  let index = startIndex + 2;

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed || !trimmed.includes('|')) break;
    rows.push(parseTableCells(trimmed));
    index += 1;
  }

  return { table: { headers, rows }, nextIndex: index };
}

function parseTableCells(line: string) {
  return line
    .split('|')
    .map((part) => part.trim())
    .filter(
      (part, index, parts) =>
        !(index === 0 && part === '') && !(index === parts.length - 1 && part === ''),
    );
}

function isTableHeader(line: string, nextLine: string) {
  const normalizedLine = line.trim();
  const normalizedNextLine = nextLine.trim();
  return (
    normalizedLine.startsWith('|') &&
    normalizedLine.endsWith('|') &&
    normalizedNextLine.startsWith('|') &&
    normalizedNextLine.endsWith('|') &&
    normalizedNextLine.includes('---')
  );
}

function unorderedListMatch(value: string) {
  return /^-\s+/.test(value);
}

function orderedListMatch(value: string) {
  return /^\d+\.\s+/.test(value);
}

function rowsForText(text: string, minRows: number) {
  return Math.max(minRows, text.split('\n').length);
}
