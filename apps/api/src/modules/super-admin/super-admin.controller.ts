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
  UseInterceptors,
  UploadedFile,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Multer } from 'multer';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SuperAdminService } from './super-admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { getClientIp } from '../../common/utils/request-ip';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import type { Response, Request } from 'express';
import { MAX_IMAGE_SIZE } from '../../common/storage/image-upload';

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
      sameSite: 'lax',
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
    return this.superAdminService.createTenant(dto, admin.sub, getClientIp(req));
  }

  @Patch('tenants/:id')
  async updateTenant(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.superAdminService.updateTenant(id, dto, admin.sub, getClientIp(req));
  }

  @Post('tenants/:id/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_IMAGE_SIZE,
      },
    }),
  )
  async uploadTenantLogo(
    @Param('id') id: string,
    @UploadedFile() file: Multer.File,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.superAdminService.uploadTenantLogo(id, file, admin.sub, getClientIp(req));
  }

  @Delete('tenants/:id/logo')
  async removeTenantLogo(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.superAdminService.removeTenantLogo(id, admin.sub, getClientIp(req));
  }

  @Post('tenants/:id/usuarios')
  @HttpCode(HttpStatus.CREATED)
  async createTenantUser(
    @Param('id') tenantId: string,
    @Body() dto: CreateTenantUserDto,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.superAdminService.createTenantUser(tenantId, dto, admin.sub, getClientIp(req));
  }
}
