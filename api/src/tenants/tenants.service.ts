import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DbService } from '../db/db.service';

export interface Tenant {
  id: string;
  name: string;
}

export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

@Injectable()
export class TenantsService {
  constructor(private readonly db: DbService) {}

  /** Returns the plain API key once. Only its hash is stored. */
  async create(name: string): Promise<{ tenant: Tenant; apiKey: string }> {
    const apiKey = `sk_${randomBytes(24).toString('hex')}`;
    const [tenant] = await this.db.query<Tenant>(
      'insert into tenants (name, api_key_hash) values ($1, $2) returning id, name',
      [name, hashKey(apiKey)],
    );
    return { tenant, apiKey };
  }

  async findByKey(apiKey: string): Promise<Tenant | undefined> {
    const [tenant] = await this.db.query<Tenant>(
      'select id, name from tenants where api_key_hash = $1',
      [hashKey(apiKey)],
    );
    return tenant;
  }
}
