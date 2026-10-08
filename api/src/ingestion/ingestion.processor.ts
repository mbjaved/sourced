import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EMBEDDER, Embedder } from '../ai/ai.types';
import { DbService } from '../db/db.service';
import { chunk } from './chunker';

export const INGESTION_QUEUE = 'ingestion';
export interface IngestJob {
  documentId: string;
}

const BATCH = 64; // embedding calls per request, keeps payloads well under provider limits

@Processor(INGESTION_QUEUE)
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private readonly db: DbService,
    @Inject(EMBEDDER) private readonly embedder: Embedder,
  ) {
    super();
  }

  async process(job: Job<IngestJob>) {
    const { documentId } = job.data;
    const [doc] = await this.db.query<{ tenant_id: string; content: string }>(
      'select tenant_id, content from documents where id = $1',
      [documentId],
    );
    if (!doc) return; // deleted before we got to it

    try {
      const pieces = chunk(doc.content);
      const vectors: number[][] = [];
      for (let i = 0; i < pieces.length; i += BATCH) {
        vectors.push(...(await this.embedder.embed(pieces.slice(i, i + BATCH))));
      }

      // Replace chunks in one transaction, so a retry never leaves duplicates or half a document.
      await this.db.transaction(async (tx) => {
        await tx.query('delete from chunks where document_id = $1', [documentId]);
        // ponytail: one insert per chunk, fine for documents up to a few hundred chunks; batch with unnest() beyond that
        for (const [ordinal, content] of pieces.entries()) {
          await tx.query(
            'insert into chunks (document_id, tenant_id, ordinal, content, embedding) values ($1, $2, $3, $4, $5)',
            [documentId, doc.tenant_id, ordinal, content, JSON.stringify(vectors[ordinal])],
          );
        }
        await tx.query("update documents set status = 'ready', error = null where id = $1", [
          documentId,
        ]);
      });
      this.logger.log(`Indexed ${documentId}: ${pieces.length} chunks`);
    } catch (err) {
      const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (lastAttempt) {
        await this.db.query("update documents set status = 'failed', error = $2 where id = $1", [
          documentId,
          String(err).slice(0, 500),
        ]);
      }
      throw err; // let BullMQ retry with backoff
    }
  }
}
