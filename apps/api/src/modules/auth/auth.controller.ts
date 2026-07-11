import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Res,
  Req,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { getClientIp } from '../../common/utils/request-ip';
import { Role } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MAX_IMAGE_SIZE } from '../../common/storage/image-upload';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Autentica um usuário e gera um cookie de sessão JWT' })
  @ApiResponse({ status: 200, description: 'Login efetuado com sucesso.' })
  @ApiResponse({ status: 401, description: 'E-mail ou senha incorretos.' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const ip = getClientIp(req);
    const { accessToken, user } = await this.authService.login(dto, ip);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });

    return { message: 'Login realizado com sucesso.', user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    await this.authService.logout(user.sub, user.tenantId!, getClientIp(req));

    // Remove o cookie de sessão
    res.clearCookie('access_token');

    return { message: 'Logout realizado com sucesso.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub, user.tenantId!);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Altera a senha do usuario autenticado' })
  async changeMyPassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.authService.changePassword(user.sub, user.tenantId!, dto, getClientIp(req));
  }

  @Post('me/photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_IMAGE_SIZE,
      },
    }),
  )
  async updateMyPhoto(
    @UploadedFile() file: any,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.authService.updateMyPhoto(user.sub, user.tenantId!, file);
  }

  @Delete('me/photo')
  @UseGuards(JwtAuthGuard)
  async removeMyPhoto(@CurrentUser() user: JwtPayload) {
    return this.authService.removeMyPhoto(user.sub, user.tenantId!);
  }

  @Post('tenant/logo')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_IMAGE_SIZE,
      },
    }),
  )
  async updateTenantLogo(
    @UploadedFile() file: any,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.authService.updateTenantLogo(user.tenantId!, file, user.sub, getClientIp(req));
  }

  @Delete('tenant/logo')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  async removeTenantLogo(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.authService.removeTenantLogo(user.tenantId!, user.sub, getClientIp(req));
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  async getUsers(@CurrentUser() user: JwtPayload) {
    return this.authService.findAllUsers(user.tenantId!);
  }

  @Get('members-available')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Lista membros disponíveis para viculamento a um usuário' })
  async getAvailableMembers(@CurrentUser() user: JwtPayload) {
    return this.authService.findAvailableMembers(user.tenantId!);
  }

  @Get('audit-logs')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  async getAuditLogs(@CurrentUser() user: JwtPayload) {
    return this.authService.findAllAuditLogs(user.tenantId!);
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cria um novo usuário do sistema' })
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request,
  ) {
    return this.authService.createUser(dto, actor.tenantId!, actor.sub, getClientIp(req));
  }

  @Patch('users/:id')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Atualiza um usuário do sistema' })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request,
  ) {
    return this.authService.updateUser(id, dto, actor.tenantId!, actor.sub, getClientIp(req));
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Desativa um usuário do sistema' })
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request,
  ) {
    return this.authService.deleteUser(id, actor.tenantId!, actor.sub, getClientIp(req));
  }
}
