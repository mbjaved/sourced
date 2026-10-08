import { createHash } from 'crypto';
import { Answer, Answerer, Embedder, EMBEDDING_DIM, NOT_FOUND, Source } from './ai.types';

const STOPWORDS = new Set(
  'a an and are as at be by do does for from how i in is it of on or our the this to was we what when where which who why with you your'.split(
    ' ',
  ),
);

export const tokens = (text: string) =>
  (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOPWORDS.has(t));

/**
 * Hashed bag-of-words embedding. No network, no key, same output every run,
 * which makes CI and the eval suite reproducible.
 * ponytail: lexical only, misses synonyms; use the OpenAI provider for real semantic search.
 */
export class LocalEmbedder implements Embedder {
  async embed(texts: string[]) {
    return texts.map((text) => {
      const v = new Array<number>(EMBEDDING_DIM).fill(0);
      for (const t of tokens(text))
        v[createHash('md5').update(t).digest().readUInt32BE(0) % EMBEDDING_DIM] += 1;
      const norm = Math.hypot(...v) || 1;
      return v.map((x) => x / norm);
    });
  }
}

/**
 * Extractive answerer: returns the source sentence that best overlaps the question, with its citation.
 * A sentence must cover at least half the question's words, otherwise it counts as not found,
 * so a stray shared word ("policy") never passes for an answer.
 */
export class LocalAnswerer implements Answerer {
  async answer(question: string, sources: Source[]): Promise<Answer> {
    const q = new Set(tokens(question));
    let best = { score: 0, text: '' };
    for (const s of sources) {
      for (const sentence of s.content.split(/(?<=[.!?])\s+/)) {
        const score = tokens(sentence).filter((t) => q.has(t)).length;
        if (score > best.score) best = { score, text: `${sentence.trim()} [${s.n}]` };
      }
    }
    return { text: best.score > 0 && best.score >= Math.ceil(q.size / 2) ? best.text : NOT_FOUND };
  }
}
