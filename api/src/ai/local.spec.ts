import { NOT_FOUND } from './ai.types';
import { LocalAnswerer, LocalEmbedder } from './local';

describe('LocalEmbedder', () => {
  it('is deterministic and unit length', async () => {
    const e = new LocalEmbedder();
    const [a] = await e.embed(['remote work policy']);
    const [b] = await e.embed(['remote work policy']);
    expect(a).toEqual(b);
    expect(Math.hypot(...a)).toBeCloseTo(1);
  });
});

describe('LocalAnswerer', () => {
  const sources = [
    { n: 1, content: 'Receipts are due within 30 days.' },
    { n: 2, content: 'Remote work policy. Employees may work remotely up to three days a week.' },
  ];

  it('cites the source of the best matching sentence', async () => {
    const { text } = await new LocalAnswerer().answer(
      'How many days can I work remotely?',
      sources,
    );
    expect(text).toBe('Employees may work remotely up to three days a week. [2]');
  });

  it('refuses when only a stray word matches', async () => {
    const { text } = await new LocalAnswerer().answer(
      'What is the parental leave policy?',
      sources,
    );
    expect(text).toBe(NOT_FOUND);
  });
});
