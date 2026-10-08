import { Inject, Injectable } from '@nestjs/common';
import { ANSWERER, Answerer, EMBEDDER, Embedder, NOT_FOUND } from '../ai/ai.types';
import { DbService } from '../db/db.service';

interface Hit {
  document_id: string;
  title: string;
  ordinal: number;
  content: string;
  distance: number;
}

export interface AskResult {
  answer: string;
  citations: Citation[];
  usage?: { inputTokens: number; outputTokens: number };
  latencyMs: number;
}

export interface Citation {
  n: number;
  documentId: string;
  title: string;
  chunk: number;
  snippet: string;
}

const TOP_K = 5;
const MAX_DISTANCE = 0.9; // cosine distance; beyond this a chunk is noise, not evidence

@Injectable()
export class AskService {
  constructor(
    private readonly db: DbService,
    @Inject(EMBEDDER) private readonly embedder: Embedder,
    @Inject(ANSWERER) private readonly answerer: Answerer,
  ) {}

  async retrieve(tenantId: string, question: string, k = TOP_K): Promise<Hit[]> {
    const [vector] = await this.embedder.embed([question]);
    // The tenant filter is in SQL, not in app code after the fact, so another tenant's chunk can never reach the prompt.
    const hits = await this.db.query<Hit>(
      `select c.document_id, d.title, c.ordinal, c.content, c.embedding <=> $2 as distance
         from chunks c join documents d on d.id = c.document_id
        where c.tenant_id = $1
        order by c.embedding <=> $2
        limit $3`,
      [tenantId, JSON.stringify(vector), k],
    );
    return hits.filter((h) => h.distance <= MAX_DISTANCE);
  }

  async ask(tenantId: string, question: string): Promise<AskResult> {
    const started = Date.now();
    const hits = await this.retrieve(tenantId, question);
    if (!hits.length) return { answer: NOT_FOUND, citations: [], latencyMs: Date.now() - started };

    const sources = hits.map((h, i) => ({ n: i + 1, content: h.content }));
    const { text, usage } = await this.answerer.answer(question, sources);

    // Only return citations the answer actually used, in the order it used them.
    const used = [...new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))];
    const citations: Citation[] = used
      .filter((n) => n >= 1 && n <= hits.length)
      .map((n) => {
        const h = hits[n - 1];
        return {
          n,
          documentId: h.document_id,
          title: h.title,
          chunk: h.ordinal,
          snippet: h.content.slice(0, 240),
        };
      });

    return { answer: text, citations, usage, latencyMs: Date.now() - started };
  }
}
