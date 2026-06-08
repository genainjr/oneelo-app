import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SuperAdminService } from './super-admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import type { Response, Request } from 'express';

@Controller('admin')
@Roles(Role.SUPER_ADMIN)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async login(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, user } = await this.superAdminService.login(dto);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });

    return { message: 'Login realizado com sucesso.', user };
  }

  @Get('tenants')
  async listTenants() {
    return this.superAdminService.listTenants();
  }

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  async createTenant(
    @Body() dto: CreateTenantDto,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.superAdminService.createTenant(dto, admin.sub, req.ip);
  }

  @Patch('tenants/:id')
  async updateTenant(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.superAdminService.updateTenant(id, dto, admin.sub, req.ip);
  }

  @Post('tenants/:id/usuarios')
  @HttpCode(HttpStatus.CREATED)
  async createTenantUser(
    @Param('id') tenantId: string,
    @Body() dto: CreateTenantUserDto,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.superAdminService.createTenantUser(tenantId, dto, admin.sub, req.ip);
  }
}
