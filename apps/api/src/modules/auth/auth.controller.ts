import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  Req,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SocialAuthService, type GoogleCallbackResult } from './social-auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateLoginPhoneDto } from './dto/update-login-phone.dto';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';
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
import { parseDurationToMilliseconds } from './auth-session';
import {
  OAUTH_PENDING_LINK_COOKIE,
  OAUTH_STATE_COOKIE,
} from './social-auth.constants';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly socialAuthService: SocialAuthService,
  ) {}

  private isHttpsRequest(req: Request): boolean {
    const forwardedProto = req.headers['x-forwarded-proto'];
    return req.secure || forwardedProto === 'https';
  }

  private setAccessTokenCookie(
    res: Response,
    req: Request,
    accessToken: string,
    expiresIn: string,
  ) {
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: this.isHttpsRequest(req),
      sameSite: 'lax',
      maxAge: parseDurationToMilliseconds(expiresIn),
    });
  }

  private setTransientCookie(
    res: Response,
    req: Request,
    name: string,
    value: string,
    maxAge: number,
  ) {
    res.cookie(name, value, {
      httpOnly: true,
      secure: this.isHttpsRequest(req),
      sameSite: 'lax',
      maxAge,
      path: '/',
    });
  }

  private clearTransientCookie(res: Response, name: string) {
    res.clearCookie(name, { path: '/' });
  }

  private getSocialLoginErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      if (response && typeof response === 'object' && 'message' in response) {
        const message = (response as { message?: string | string[] }).message;

        if (Array.isArray(message)) {
          return message.join(' ');
        }

        if (typeof message === 'string') {
          return message;
        }
      }
    }

    return 'Nao foi possivel concluir o login social. Tente novamente.';
  }

  private buildSocialLoginErrorRedirect(error: unknown, provider: string) {
    const params = new URLSearchParams({
      provider,
      message: this.getSocialLoginErrorMessage(error),
    });

    return `/login/social-link?${params.toString()}`;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Autentica um usuário e gera um cookie de sessão JWT' })
  @ApiResponse({ status: 200, description: 'Login efetuado com sucesso.' })
  @ApiResponse({ status: 401, description: 'E-mail ou senha incorretos.' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const ip = getClientIp(req);
    const { accessToken, user, expiresIn, expiresAt } = await this.authService.login(dto, ip);

    this.setAccessTokenCookie(res, req, accessToken, expiresIn);

    return { message: 'Login realizado com sucesso.', user, expiresIn, expiresAt };
  }

  @Public()
  @Get('activation/:token')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Valida um link de ativacao de conta' })
  async validateActivation(@Param('token') token: string) {
    return this.authService.validateActivationToken(token);
  }

  @Public()
  @Post('activation/:token/password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Ativa uma conta pendente criando uma senha' })
  async activateWithPassword(
    @Param('token') token: string,
    @Body() dto: ActivateAccountDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const { accessToken, user, expiresIn, expiresAt } =
      await this.authService.activateWithPassword(token, dto, getClientIp(req));

    this.setAccessTokenCookie(res, req, accessToken, expiresIn);

    return { message: 'Conta ativada com sucesso.', user, expiresIn, expiresAt };
  }

  @Public()
  @Get('oauth/google/start')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Inicia o fluxo OAuth de login com Google' })
  async startGoogleLogin(
    @Query('redirect') redirect: string | undefined,
    @Query('activationToken') activationToken: string | undefined,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const { authorizationUrl, stateToken, maxAgeMs } =
      await this.socialAuthService.createGoogleAuthorizationUrl(redirect, activationToken);

    this.setTransientCookie(res, req, OAUTH_STATE_COOKIE, stateToken, maxAgeMs);

    return res.redirect(authorizationUrl);
  }

  @Public()
  @Get('oauth/google/callback')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Recebe o callback OAuth do Google' })
  async handleGoogleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    let result: GoogleCallbackResult;

    try {
      result = await this.socialAuthService.handleGoogleCallback(
        code,
        state,
        req.cookies?.[OAUTH_STATE_COOKIE],
        getClientIp(req),
      );
    } catch (error) {
      this.clearTransientCookie(res, OAUTH_STATE_COOKIE);
      this.clearTransientCookie(res, OAUTH_PENDING_LINK_COOKIE);
      return res.redirect(this.buildSocialLoginErrorRedirect(error, 'GOOGLE'));
    }

    this.clearTransientCookie(res, OAUTH_STATE_COOKIE);
    this.clearTransientCookie(res, OAUTH_PENDING_LINK_COOKIE);

    if (result.status === 'authenticated') {
      this.setAccessTokenCookie(res, req, result.session.accessToken, result.session.expiresIn);
      return res.redirect(result.redirectPath);
    }

    this.setTransientCookie(
      res,
      req,
      OAUTH_PENDING_LINK_COOKIE,
      result.pendingToken,
      result.pending.expiresInMs,
    );

    return res.redirect(result.redirectPath);
  }

  @Public()
  @Get('oauth/google/pending-link')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Consulta a confirmacao pendente de primeiro vinculo Google' })
  async getGooglePendingLink(@Req() req: Request) {
    return this.socialAuthService.getPendingLink(req.cookies?.[OAUTH_PENDING_LINK_COOKIE]);
  }

  @Public()
  @Post('oauth/google/confirm-link')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Confirma o primeiro vinculo Google e cria sessao' })
  async confirmGoogleLink(
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const { accessToken, user, expiresIn, expiresAt, redirectPath } =
      await this.socialAuthService.confirmPendingLink(
        req.cookies?.[OAUTH_PENDING_LINK_COOKIE],
        getClientIp(req),
      );

    this.clearTransientCookie(res, OAUTH_PENDING_LINK_COOKIE);
    this.setAccessTokenCookie(res, req, accessToken, expiresIn);

    return {
      message: 'Conta Google vinculada com sucesso.',
      user,
      expiresIn,
      expiresAt,
      redirectPath,
    };
  }

  @Public()
  @Post('oauth/google/cancel-link')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Cancela a confirmacao pendente de primeiro vinculo Google' })
  cancelGoogleLink(@Res({ passthrough: true }) res: Response) {
    this.clearTransientCookie(res, OAUTH_PENDING_LINK_COOKIE);
    return { message: 'Vinculacao com Google cancelada.' };
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

  @Patch('me/onboarding')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Marca o onboarding inicial do usuario como concluido' })
  async completeOnboarding(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.authService.completeOnboarding(user.sub, user.tenantId!, getClientIp(req));
  }

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Atualiza dados pessoais do usuario autenticado' })
  async updateMyProfile(
    @Body() dto: UpdateMyProfileDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.authService.updateMyProfile(user.sub, user.tenantId!, dto, getClientIp(req));
  }

  @Patch('me/login-phone')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Cadastra, altera ou remove o telefone de login do usuario atual' })
  async updateMyLoginPhone(
    @Body() dto: UpdateLoginPhoneDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.authService.updateMyLoginPhone(
      user.sub,
      user.tenantId!,
      dto,
      getClientIp(req),
    );
  }

  @Get('me/auth-providers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lista provedores de login conectados ao usuario atual' })
  async getMyAuthProviders(@CurrentUser() user: JwtPayload) {
    return this.socialAuthService.listConnectedProviders(user.sub, user.tenantId!);
  }

  @Delete('me/auth-providers/:provider')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Desvincula um provedor de login do usuario atual' })
  async unlinkMyAuthProvider(
    @Param('provider') provider: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.socialAuthService.unlinkProvider(
      user.sub,
      user.tenantId!,
      provider,
      getClientIp(req),
    );
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
  async getAuditLogs(
    @CurrentUser() user: JwtPayload,
    @Query() query: AuditLogsQueryDto,
  ) {
    return this.authService.findAllAuditLogs(user.tenantId!, query);
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

  @Post('users/:id/activation-link')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Roles(Role.ADMIN)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Gera um novo link de ativacao para usuario pendente' })
  async regenerateActivationLink(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request,
  ) {
    return this.authService.regenerateActivationLink(
      id,
      actor.tenantId!,
      actor.sub,
      getClientIp(req),
    );
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
