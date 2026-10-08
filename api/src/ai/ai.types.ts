export const EMBEDDER = Symbol('EMBEDDER');
export const ANSWERER = Symbol('ANSWERER');

/** All embeddings share one dimension so the vector column never changes. */
export const EMBEDDING_DIM = 1536;

export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

export interface Source {
  n: number; // the [n] label the answer cites
  content: string;
}

export interface Answer {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface Answerer {
  answer(question: string, sources: Source[]): Promise<Answer>;
}

export const NOT_FOUND = "I couldn't find that in your documents.";
