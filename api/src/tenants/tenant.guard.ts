import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Tenant, TenantsService } from './tenants.service';

const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Every route requires a tenant API key unless marked @Public(). Registered globally. */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly tenants: TenantsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) {
      return true;
    }
    const req = ctx.switchToHttp().getRequest();
    const key = req.headers['x-api-key'];
    const tenant = typeof key === 'string' ? await this.tenants.findByKey(key) : undefined;
    if (!tenant) throw new UnauthorizedException('Missing or invalid API key');
    req.tenant = tenant;
    return true;
  }
}

export const CurrentTenant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Tenant => ctx.switchToHttp().getRequest().tenant,
);
