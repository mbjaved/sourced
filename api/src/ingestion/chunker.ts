/**
 * Packs paragraphs into chunks of at most maxChars, so a chunk holds whole thoughts.
 * A paragraph longer than maxChars is split on sentence boundaries, then hard-cut as a last resort.
 */
export function chunk(text: string, maxChars = 800): string[] {
  const pieces = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .flatMap((p) => (p.length <= maxChars ? [p] : splitLong(p, maxChars)));

  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (current && current.length + 1 + piece.length > maxChars) {
      chunks.push(current);
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitLong(paragraph: string, maxChars: number): string[] {
  const out: string[] = [];
  let current = '';
  for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
    for (let i = 0; i < sentence.length; i += maxChars) {
      const part = sentence.slice(i, i + maxChars);
      if (current && current.length + 1 + part.length > maxChars) {
        out.push(current);
        current = part;
      } else {
        current = current ? `${current} ${part}` : part;
      }
    }
  }
  if (current) out.push(current);
  return out;
}
