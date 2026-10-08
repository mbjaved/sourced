// Usage: npm run tenant:create -- "Acme Corp"
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TenantsService } from './tenants/tenants.service';

async function main() {
  const name = process.argv[2];
  if (!name) throw new Error('Usage: npm run tenant:create -- "<name>"');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const { tenant, apiKey } = await app.get(TenantsService).create(name);
  console.log(`Tenant ${tenant.name} (${tenant.id})\nAPI key (shown once): ${apiKey}`);
  await app.close();
}
main();
