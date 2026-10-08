import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentTenant } from '../tenants/tenant.guard';
import { Tenant } from '../tenants/tenants.service';
import { CreateDocumentDto } from './create-document.dto';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /** 202: the document is stored now and indexed in the background. Poll GET /documents/:id for status. */
  @Post()
  @HttpCode(202)
  create(@CurrentTenant() tenant: Tenant, @Body() dto: CreateDocumentDto) {
    return this.documents.create(tenant.id, dto);
  }

  @Get()
  list(@CurrentTenant() tenant: Tenant) {
    return this.documents.list(tenant.id);
  }

  @Get(':id')
  get(@CurrentTenant() tenant: Tenant, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.get(tenant.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentTenant() tenant: Tenant, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.remove(tenant.id, id);
  }
}
