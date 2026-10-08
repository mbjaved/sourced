import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { INGESTION_QUEUE, IngestionProcessor } from '../ingestion/ingestion.processor';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [BullModule.registerQueue({ name: INGESTION_QUEUE })],
  controllers: [DocumentsController],
  // ponytail: the worker runs in the API process; move IngestionProcessor to its own entrypoint when ingestion load needs separate scaling
  providers: [DocumentsService, IngestionProcessor],
})
export class DocumentsModule {}
