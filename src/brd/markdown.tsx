import type { ReactNode } from 'react';

type MarkdownListItem = {
  text: string;
  children: string[];
};

type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'unordered-list'; items: MarkdownListItem[] }
  | { type: 'ordered-list'; items: MarkdownListItem[] }
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

function unorderedListMatch(value: string) {
  return /^-\s+/.test(value);
}

function orderedListMatch(value: string) {
  return /^\d+\.\s+/.test(value);
}
