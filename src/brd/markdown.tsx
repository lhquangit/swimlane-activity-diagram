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

type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'unordered-list'; items: MarkdownListItem[] }
  | { type: 'ordered-list'; items: MarkdownListItem[] }
  | { type: 'table'; table: MarkdownTable }
  | { type: 'figure'; figure: MarkdownFigure }
  | { type: 'rule' };

export function renderMarkdownDocument(markdown: string): ReactNode {
  const blocks = parseMarkdown(markdown);
  if (blocks.length === 0) {
    return <p className="persisted-brd__document-empty">BRD chưa có nội dung để hiển thị.</p>;
  }

  return blocks.map((block, index) => {
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
        return renderTable(block.table, key);
      case 'figure':
        return renderFigure(block.figure, key);
      case 'rule':
        return <hr key={key} className="persisted-brd__document-rule" />;
    }
  });
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

function renderTable(table: MarkdownTable, key: string) {
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

function renderFigure(figure: MarkdownFigure, key: string) {
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

function parseMarkdown(markdown: string): MarkdownBlock[] {
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
    .filter((part, index, parts) => !(index === 0 && part === '') && !(index === parts.length - 1 && part === ''));
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
