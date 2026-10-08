import { chunk } from './chunker';

describe('chunk', () => {
  it('keeps short paragraphs together up to the limit', () => {
    expect(chunk('One.\n\nTwo.\n\nThree.', 20)).toEqual(['One. Two. Three.']);
  });

  it('starts a new chunk when the next paragraph would overflow', () => {
    expect(chunk('aaaa aaaa\n\nbbbb bbbb', 12)).toEqual(['aaaa aaaa', 'bbbb bbbb']);
  });

  it('never returns a chunk over the limit, even for one huge sentence', () => {
    const chunks = chunk('x'.repeat(2500), 800);
    expect(chunks).toHaveLength(4);
    expect(chunks.every((c) => c.length <= 800)).toBe(true);
    expect(chunks.join('')).toBe('x'.repeat(2500));
  });

  it('returns nothing for blank input', () => {
    expect(chunk('  \n\n  ')).toEqual([]);
  });
});
