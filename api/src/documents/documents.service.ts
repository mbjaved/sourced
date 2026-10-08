import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DbService } from '../db/db.service';
import { INGESTION_QUEUE, IngestJob } from '../ingestion/ingestion.processor';
import { CreateDocumentDto } from './create-document.dto';

export interface DocumentSummary {
  id: string;
  title: string;
  status: 'processing' | 'ready' | 'failed';
  error: string | null;
  chunks: number;
  created_at: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: DbService,
    @InjectQueue(INGESTION_QUEUE) private readonly queue: Queue<IngestJob>,
  ) {}

  async create(tenantId: string, dto: CreateDocumentDto) {
    const [doc] = await this.db.query<{ id: string; status: string }>(
      'insert into documents (tenant_id, title, content) values ($1, $2, $3) returning id, status',
      [tenantId, dto.title, dto.content],
    );
    // jobId = document id, so a duplicate enqueue for the same document is ignored
    await this.queue.add(
      'ingest',
      { documentId: doc.id },
      {
        jobId: doc.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
      },
    );
    return doc;
  }

  // Every query takes tenantId: a tenant can never read or delete another tenant's documents.
  list(tenantId: string) {
    return this.db.query<DocumentSummary>(
      `select d.id, d.title, d.status, d.error, d.created_at, count(c.id)::int as chunks
         from documents d left join chunks c on c.document_id = d.id
        where d.tenant_id = $1
        group by d.id
        order by d.created_at desc`,
      [tenantId],
    );
  }

  async get(tenantId: string, id: string) {
    const [doc] = await this.db.query<DocumentSummary>(
      `select d.id, d.title, d.status, d.error, d.created_at, count(c.id)::int as chunks
         from documents d left join chunks c on c.document_id = d.id
        where d.tenant_id = $1 and d.id = $2
        group by d.id`,
      [tenantId, id],
    );
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async remove(tenantId: string, id: string) {
    const rows = await this.db.query(
      'delete from documents where tenant_id = $1 and id = $2 returning id',
      [tenantId, id],
    );
    if (!rows.length) throw new NotFoundException('Document not found');
  }
}
