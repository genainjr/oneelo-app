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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';                           

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica um usuário e gera um cookie de sessão JWT' })
  @ApiResponse({ status: 200, description: 'Login efetuado com sucesso.' })
  @ApiResponse({ status: 401, description: 'E-mail ou senha incorretos.' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const ip = req.ip;
    const { accessToken, user } = await this.authService.login(dto, ip);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
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
    await this.authService.logout(user.sub, user.tenantId, req.ip);

    // Remove o cookie de sessão
    res.clearCookie('access_token');

    return { message: 'Logout realizado com sucesso.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub, user.tenantId);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  async getUsers(@CurrentUser() user: JwtPayload) {
    return this.authService.findAllUsers(user.tenantId);
  }

  @Get('members-available')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Lista membros disponíveis para viculamento a um usuário' })
  async getAvailableMembers(@CurrentUser() user: JwtPayload) {
    return this.authService.findAvailableMembers(user.tenantId);
  }

  @Get('audit-logs')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  async getAuditLogs(@CurrentUser() user: JwtPayload) {
    return this.authService.findAllAuditLogs(user.tenantId);
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
    return this.authService.createUser(dto, actor.tenantId, actor.sub, (req as any).ip);
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
    return this.authService.updateUser(id, dto, actor.tenantId, actor.sub, (req as any).ip);
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
    return this.authService.deleteUser(id, actor.tenantId, actor.sub, (req as any).ip);
  }
}
