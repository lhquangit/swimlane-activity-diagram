const BLOCK_TAGS = new Set(['DIV', 'P', 'LI']);

export function parseStyleString(style: string | null | undefined) {
  const result: Record<string, string> = {};
  if (!style) return result;
  style
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const [key, ...rest] = part.split('=');
      result[key] = rest.length > 0 ? rest.join('=') : '1';
    });
  return result;
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function encodeTextForDrawio(value: string) {
  const lines = value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd());

  if (lines.length <= 1) {
    return escapeXml(lines[0] ?? '');
  }

  const [first, ...rest] = lines;
  return `${escapeXml(first)}${rest
    .map((line) => `&lt;div&gt;${escapeXml(line)}&lt;/div&gt;`)
    .join('')}`;
}

function collectText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }

  if (!(node instanceof Element)) return '';
  if (node.tagName === 'BR') return '\n';

  const childText = Array.from(node.childNodes)
    .map((child) => collectText(child))
    .join('');

  if (BLOCK_TAGS.has(node.tagName)) {
    return `${childText}\n`;
  }

  return childText;
}

export function decodeDrawioText(value: string | null | undefined) {
  if (!value) return '';
  const container = document.createElement('div');
  container.innerHTML = value.replace(/&nbsp;/g, ' ');
  const text = Array.from(container.childNodes)
    .map((child) => collectText(child))
    .join('');

  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

export function readGeometryNumber(element: Element, attribute: string, fallback = 0) {
  const raw = element.getAttribute(attribute);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
}
