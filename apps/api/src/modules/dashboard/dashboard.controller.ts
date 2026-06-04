import { Controller, Get, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express';

@Controller('dashboard')
@Roles(Role.ADMIN, Role.STAFF)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('indicadores')
  getIndicadores(@Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.dashboardService.getIndicadores(tenantId);
  }
}
