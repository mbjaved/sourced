import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TenantGuard } from './tenant.guard';
import { TenantsService } from './tenants.service';

@Module({
  providers: [TenantsService, { provide: APP_GUARD, useClass: TenantGuard }],
  exports: [TenantsService],
})
export class TenantsModule {}
