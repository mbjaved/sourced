import { BullModule } from '@nestjs/bullmq';
import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AskModule } from './ask/ask.module';
import { DbModule } from './db/db.module';
import { DocumentsModule } from './documents/documents.module';
import { Public } from './tenants/tenant.guard';
import { TenantsModule } from './tenants/tenants.module';

@Controller('health')
class HealthController {
  @Public()
  @Get()
  health() {
    return { ok: true };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Async so REDIS_URL is read after ConfigModule has loaded .env
    BullModule.forRootAsync({
      useFactory: () => {
        const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
        return { connection: { host: url.hostname, port: Number(url.port || 6379) } };
      },
    }),
    DbModule,
    AiModule,
    TenantsModule,
    DocumentsModule,
    AskModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
