import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { CurrentTenant } from '../tenants/tenant.guard';
import { Tenant } from '../tenants/tenants.service';
import { AskService } from './ask.service';

class AskDto {
  @IsString()
  @Length(3, 1000)
  question: string;
}

@Controller('ask')
export class AskController {
  constructor(private readonly askService: AskService) {}

  @Post()
  @HttpCode(200)
  ask(@CurrentTenant() tenant: Tenant, @Body() dto: AskDto) {
    return this.askService.ask(tenant.id, dto.question);
  }
}
