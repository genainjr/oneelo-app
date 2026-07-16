import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AcaoAuditoria, AuthProvider, Prisma, Role, UserStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { getUserSessionExpiresIn, parseDurationToMilliseconds } from './auth-session';
import {
  GOOGLE_OAUTH_SCOPES,
  OAUTH_PENDING_LINK_EXPIRES_IN,
  OAUTH_STATE_EXPIRES_IN,
  OAUTH_TRANSIENT_COOKIE_MAX_AGE_MS,
} from './social-auth.constants';
import {
  ACCOUNT_DISABLED_MESSAGE,
  ACCOUNT_PENDING_ACTIVATION_MESSAGE,
} from './auth-access.constants';

type UserWithTenant = Prisma.UserGetPayload<{ include: { tenant: true } }>;

interface OAuthStatePayload {
  type: 'oauth_state';
  provider: AuthProvider;
  redirectPath: string;
  activationToken?: string;
  nonce: string;
}

interface PendingLinkPayload {
  type: 'oauth_pending_link';
  provider: AuthProvider;
  providerUserId: string;
  email: string;
  emailVerified: true;
  displayName?: string;
  avatarUrl?: string;
  userId: string;
  userEmail: string;
  userName: string;
  redirectPath: string;
  activationToken?: string;
  nonce: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfoResponse {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
}

interface GoogleProfile {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  avatarUrl?: string;
}

interface AuthSessionResult {
  accessToken: string;
  expiresIn: string;
  expiresAt: string;
  user: {
    id: string;
    nome: string;
    email: string;
    role: Role;
    tenantId: string | null;
    onboardingCompletedAt: Date | null;
    tenantNome: string;
  };
}

interface GoogleAuthorizationStart {
  authorizationUrl: string;
  stateToken: string;
  maxAgeMs: number;
}

export interface PendingLinkResult {
  provider: AuthProvider;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  userId: string;
  userEmail: string;
  userName: string;
  redirectPath: string;
  expiresInMs: number;
}

export interface ConnectedAuthProviderResult {
  provider: AuthProvider;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  linkedAt: Date;
  lastLoginAt: Date | null;
  canUnlink: boolean;
}

export type GoogleCallbackResult =
  | {
      status: 'authenticated';
      redirectPath: string;
      session: AuthSessionResult;
    }
  | {
      status: 'link_confirmation_required';
      redirectPath: string;
      pendingToken: string;
      pending: PendingLinkResult;
    };

@Injectable()
export class SocialAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async createGoogleAuthorizationUrl(
    redirect?: string,
    activationToken?: string,
  ): Promise<GoogleAuthorizationStart> {
    const config = this.getGoogleConfig();
    const redirectPath = this.normalizeRedirectPath(redirect);
    const normalizedActivationToken = activationToken?.trim() || undefined;

    if (normalizedActivationToken) {
      await this.assertActivationTokenCanStartGoogleFlow(normalizedActivationToken);
    }

    const stateToken = await this.jwtService.signAsync(
      {
        type: 'oauth_state',
        provider: AuthProvider.GOOGLE,
        redirectPath,
        activationToken: normalizedActivationToken,
        nonce: randomUUID(),
      } satisfies OAuthStatePayload,
      {
        secret: this.getJwtSecret(),
        expiresIn: OAUTH_STATE_EXPIRES_IN,
      },
    );

    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorizationUrl.searchParams.set('client_id', config.clientId);
    authorizationUrl.searchParams.set('redirect_uri', config.callbackUrl);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', GOOGLE_OAUTH_SCOPES.join(' '));
    authorizationUrl.searchParams.set('state', stateToken);
    authorizationUrl.searchParams.set('prompt', 'select_account');

    return {
      authorizationUrl: authorizationUrl.toString(),
      stateToken,
      maxAgeMs: OAUTH_TRANSIENT_COOKIE_MAX_AGE_MS,
    };
  }

  async handleGoogleCallback(
    code: string | undefined,
    state: string | undefined,
    stateCookie: string | undefined,
    ip?: string,
  ): Promise<GoogleCallbackResult> {
    if (!code) {
      throw new BadRequestException('Codigo de autorizacao do Google ausente.');
    }

    const statePayload = await this.verifyOAuthState(state, stateCookie, AuthProvider.GOOGLE);
    const profile = await this.fetchGoogleProfile(code);

    if (statePayload.activationToken) {
      const pendingPayload = await this.createActivationPendingLinkPayload(
        statePayload.activationToken,
        profile,
        statePayload.redirectPath,
      );

      const pendingToken = await this.jwtService.signAsync(pendingPayload, {
        secret: this.getJwtSecret(),
        expiresIn: OAUTH_PENDING_LINK_EXPIRES_IN,
      });

      return {
        status: 'link_confirmation_required',
        redirectPath: '/login/social-link',
        pendingToken,
        pending: this.toPendingResult(pendingPayload),
      };
    }

    const existingProvider = await this.prisma.userAuthProvider.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.GOOGLE,
          providerUserId: profile.providerUserId,
        },
      },
      include: { user: { include: { tenant: true } } },
    });

    if (existingProvider?.ativo) {
      const user = this.assertUserCanLogin(existingProvider.user);

      await this.prisma.userAuthProvider.update({
        where: { id: existingProvider.id },
        data: {
          email: profile.email,
          emailVerified: profile.emailVerified,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          lastLoginAt: new Date(),
        },
      });

      return {
        status: 'authenticated',
        redirectPath: this.getPostAuthRedirect(existingProvider.user, statePayload.redirectPath),
        session: await this.createSessionForUser(user, AuthProvider.GOOGLE, ip),
      };
    }

    const user = await this.resolveUserForFirstLink(
      profile.email,
      profile.emailVerified,
      AuthProvider.GOOGLE,
    );

    if (existingProvider && existingProvider.userId !== user.id) {
      throw new ConflictException('Esta conta Google ja esta vinculada a outro usuario.');
    }

    const userProvider = await this.prisma.userAuthProvider.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: AuthProvider.GOOGLE,
        },
      },
    });

    if (
      userProvider &&
      (userProvider.ativo || userProvider.providerUserId !== profile.providerUserId)
    ) {
      throw new ConflictException('Este usuario ja possui uma conta Google vinculada.');
    }

    const pendingPayload: PendingLinkPayload = {
      type: 'oauth_pending_link',
      provider: AuthProvider.GOOGLE,
      providerUserId: profile.providerUserId,
      email: profile.email,
      emailVerified: true,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      userId: user.id,
      userEmail: user.email,
      userName: user.nome,
      redirectPath: statePayload.redirectPath,
      nonce: randomUUID(),
    };

    const pendingToken = await this.jwtService.signAsync(pendingPayload, {
      secret: this.getJwtSecret(),
      expiresIn: OAUTH_PENDING_LINK_EXPIRES_IN,
    });

    return {
      status: 'link_confirmation_required',
      redirectPath: '/login/social-link',
      pendingToken,
      pending: this.toPendingResult(pendingPayload),
    };
  }

  async getPendingLink(pendingCookie: string | undefined): Promise<PendingLinkResult> {
    const pending = await this.verifyPendingLink(pendingCookie);
    return this.toPendingResult(pending);
  }

  async confirmPendingLink(
    pendingCookie: string | undefined,
    ip?: string,
  ): Promise<AuthSessionResult & { redirectPath: string }> {
    const pending = await this.verifyPendingLink(pendingCookie);

    if (pending.activationToken) {
      const { session, redirectPath } = await this.activatePendingUserWithGoogle(
        pending.activationToken,
        {
          providerUserId: pending.providerUserId,
          email: pending.email,
          emailVerified: pending.emailVerified,
          displayName: pending.displayName,
          avatarUrl: pending.avatarUrl,
        },
        ip,
      );

      return {
        ...session,
        redirectPath,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: pending.userId },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario do OneElo nao encontrado para vinculacao.');
    }

    const loginUser = this.assertUserCanLogin(user);
    const providerLabel = this.getProviderLabel(pending.provider);

    if (user.email.toLowerCase() !== pending.userEmail.toLowerCase()) {
      throw new ConflictException(
        `O e-mail do usuario mudou durante a vinculacao. Inicie o login com ${providerLabel} novamente.`,
      );
    }

    const providerLink = await this.prisma.userAuthProvider.findUnique({
      where: {
        provider_providerUserId: {
          provider: pending.provider,
          providerUserId: pending.providerUserId,
        },
      },
    });

    if (providerLink && providerLink.userId !== user.id) {
      throw new ConflictException(`Esta conta ${providerLabel} ja esta vinculada a outro usuario.`);
    }

    const userProvider = await this.prisma.userAuthProvider.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: pending.provider,
        },
      },
    });

    if (userProvider && providerLink && userProvider.id !== providerLink.id) {
      throw new ConflictException(`Este usuario ja possui outra conta ${providerLabel} vinculada.`);
    }

    if (userProvider && !providerLink) {
      throw new ConflictException(`Este usuario ja possui uma conta ${providerLabel} vinculada.`);
    }

    const now = new Date();

    if (providerLink) {
      await this.prisma.userAuthProvider.update({
        where: { id: providerLink.id },
        data: {
          ativo: true,
          revokedAt: null,
          linkedAt: now,
          lastLoginAt: now,
          email: pending.email,
          emailVerified: true,
          displayName: pending.displayName,
          avatarUrl: pending.avatarUrl,
        },
      });
    } else {
      await this.prisma.userAuthProvider.create({
        data: {
          userId: user.id,
          provider: pending.provider,
          providerUserId: pending.providerUserId,
          email: pending.email,
          emailVerified: true,
          displayName: pending.displayName,
          avatarUrl: pending.avatarUrl,
          lastLoginAt: now,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        entidade: 'user_auth_provider',
        entidadeId: user.id,
        acao: AcaoAuditoria.CRIAR,
        payloadAfter: {
          provider: pending.provider,
          providerUserId: pending.providerUserId,
          email: pending.email,
        },
        ipAddress: ip,
      },
    });

    const session = await this.createSessionForUser(loginUser, pending.provider, ip);

    return {
      ...session,
      redirectPath: this.getPostAuthRedirect(loginUser, pending.redirectPath),
    };
  }

  async listConnectedProviders(
    userId: string,
    tenantId: string,
  ): Promise<ConnectedAuthProviderResult[]> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, ativo: true, status: UserStatus.ACTIVE },
      select: {
        id: true,
        senhaHash: true,
        authProviders: {
          where: { ativo: true },
          orderBy: { linkedAt: 'asc' },
          select: {
            provider: true,
            email: true,
            emailVerified: true,
            displayName: true,
            avatarUrl: true,
            linkedAt: true,
            lastLoginAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Sessao invalida.');
    }

    const hasPasswordAccess = Boolean(user.senhaHash);

    return user.authProviders.map((provider) => ({
      ...provider,
      canUnlink: hasPasswordAccess || user.authProviders.length > 1,
    }));
  }

  async unlinkProvider(
    userId: string,
    tenantId: string,
    providerParam: string,
    ip?: string,
  ) {
    const provider = this.parseAuthProvider(providerParam);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, ativo: true, status: UserStatus.ACTIVE },
      select: {
        id: true,
        tenantId: true,
        senhaHash: true,
        authProviders: {
          where: { ativo: true },
          select: {
            id: true,
            provider: true,
            providerUserId: true,
            email: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Sessao invalida.');
    }

    const linkedProvider = user.authProviders.find((item) => item.provider === provider);

    if (!linkedProvider) {
      throw new NotFoundException('Provedor de login nao esta vinculado a este usuario.');
    }

    const remainingProviders = user.authProviders.filter(
      (item) => item.id !== linkedProvider.id,
    );
    const hasPasswordAccess = Boolean(user.senhaHash);

    if (!hasPasswordAccess && remainingProviders.length === 0) {
      throw new ForbiddenException(
        'Nao e possivel desvincular este provedor porque o usuario ficaria sem forma valida de acesso.',
      );
    }

    const now = new Date();

    await this.prisma.userAuthProvider.update({
      where: { id: linkedProvider.id },
      data: {
        ativo: false,
        revokedAt: now,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        entidade: 'user_auth_provider',
        entidadeId: linkedProvider.id,
        acao: AcaoAuditoria.DELETAR,
        payloadBefore: {
          provider: linkedProvider.provider,
          providerUserId: linkedProvider.providerUserId,
          email: linkedProvider.email,
          ativo: true,
        },
        payloadAfter: {
          provider: linkedProvider.provider,
          providerUserId: linkedProvider.providerUserId,
          email: linkedProvider.email,
          ativo: false,
          revokedAt: now.toISOString(),
        },
        ipAddress: ip,
      },
    });

    return { message: 'Provedor de login desvinculado com sucesso.' };
  }

  private hashActivationToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async assertActivationTokenCanStartGoogleFlow(token: string) {
    const tokenHash = this.hashActivationToken(token);
    const user = await this.prisma.user.findFirst({
      where: {
        activationTokenHash: tokenHash,
        status: UserStatus.PENDING,
      },
      select: {
        activationExpiresAt: true,
        tenant: {
          select: { ativo: true },
        },
      },
    });

    if (!user || !user.activationExpiresAt || user.activationExpiresAt <= new Date()) {
      throw new BadRequestException('Link de ativacao expirado ou invalido.');
    }

    if (!user.tenant?.ativo) {
      throw new ForbiddenException(
        'Acesso suspenso. Entre em contato com o administrador.',
      );
    }
  }

  private async createActivationPendingLinkPayload(
    activationToken: string,
    profile: GoogleProfile,
    redirectPath: string,
  ): Promise<PendingLinkPayload> {
    const provider = AuthProvider.GOOGLE;
    const providerLabel = this.getProviderLabel(provider);
    const tokenHash = this.hashActivationToken(activationToken);
    const user = await this.prisma.user.findFirst({
      where: {
        activationTokenHash: tokenHash,
        status: UserStatus.PENDING,
      },
      include: { tenant: true },
    });

    if (!user || !user.activationExpiresAt || user.activationExpiresAt <= new Date()) {
      throw new BadRequestException('Link de ativacao expirado ou invalido.');
    }

    if (!user.tenantId || !user.tenant?.ativo) {
      throw new ForbiddenException(
        'Acesso suspenso. Entre em contato com o administrador.',
      );
    }

    if (!profile.emailVerified) {
      throw new UnauthorizedException(`A conta ${providerLabel} precisa ter e-mail verificado.`);
    }

    if (profile.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ConflictException(
        `Use uma conta ${providerLabel} com o mesmo e-mail cadastrado no OneElo.`,
      );
    }

    const providerLink = await this.prisma.userAuthProvider.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: profile.providerUserId,
        },
      },
    });

    if (providerLink && providerLink.userId !== user.id) {
      throw new ConflictException(`Esta conta ${providerLabel} ja esta vinculada a outro usuario.`);
    }

    const userProvider = await this.prisma.userAuthProvider.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider,
        },
      },
    });

    if (userProvider && providerLink && userProvider.id !== providerLink.id) {
      throw new ConflictException(`Este usuario ja possui outra conta ${providerLabel} vinculada.`);
    }

    if (
      userProvider &&
      !providerLink &&
      (userProvider.ativo || userProvider.providerUserId !== profile.providerUserId)
    ) {
      throw new ConflictException(`Este usuario ja possui uma conta ${providerLabel} vinculada.`);
    }

    return {
      type: 'oauth_pending_link',
      provider,
      providerUserId: profile.providerUserId,
      email: profile.email,
      emailVerified: true,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      userId: user.id,
      userEmail: user.email,
      userName: user.nome,
      redirectPath,
      activationToken,
      nonce: randomUUID(),
    };
  }

  private async activatePendingUserWithGoogle(
    activationToken: string,
    profile: GoogleProfile,
    ip?: string,
  ): Promise<{ session: AuthSessionResult; redirectPath: string }> {
    const provider = AuthProvider.GOOGLE;
    const providerLabel = this.getProviderLabel(provider);
    const tokenHash = this.hashActivationToken(activationToken);
    const user = await this.prisma.user.findFirst({
      where: {
        activationTokenHash: tokenHash,
        status: UserStatus.PENDING,
      },
      include: { tenant: true },
    });

    if (!user || !user.activationExpiresAt || user.activationExpiresAt <= new Date()) {
      throw new BadRequestException('Link de ativacao expirado ou invalido.');
    }

    if (!user.tenantId || !user.tenant?.ativo) {
      throw new ForbiddenException(
        'Acesso suspenso. Entre em contato com o administrador.',
      );
    }

    if (!profile.emailVerified) {
      throw new UnauthorizedException(`A conta ${providerLabel} precisa ter e-mail verificado.`);
    }

    if (profile.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ConflictException(
        `Use uma conta ${providerLabel} com o mesmo e-mail cadastrado no OneElo.`,
      );
    }

    const providerLink = await this.prisma.userAuthProvider.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: profile.providerUserId,
        },
      },
    });

    if (providerLink && providerLink.userId !== user.id) {
      throw new ConflictException(`Esta conta ${providerLabel} ja esta vinculada a outro usuario.`);
    }

    const userProvider = await this.prisma.userAuthProvider.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider,
        },
      },
    });

    if (userProvider && providerLink && userProvider.id !== providerLink.id) {
      throw new ConflictException(`Este usuario ja possui outra conta ${providerLabel} vinculada.`);
    }

    if (
      userProvider &&
      !providerLink &&
      (userProvider.ativo || userProvider.providerUserId !== profile.providerUserId)
    ) {
      throw new ConflictException(`Este usuario ja possui uma conta ${providerLabel} vinculada.`);
    }

    const now = new Date();
    const activatedUser = await this.prisma.$transaction(async (tx) => {
      if (providerLink) {
        await tx.userAuthProvider.update({
          where: { id: providerLink.id },
          data: {
            ativo: true,
            revokedAt: null,
            linkedAt: now,
            lastLoginAt: now,
            email: profile.email,
            emailVerified: true,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          },
        });
      } else if (userProvider) {
        await tx.userAuthProvider.update({
          where: { id: userProvider.id },
          data: {
            ativo: true,
            revokedAt: null,
            linkedAt: now,
            lastLoginAt: now,
            email: profile.email,
            emailVerified: true,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          },
        });
      } else {
        await tx.userAuthProvider.create({
          data: {
            userId: user.id,
            provider,
            providerUserId: profile.providerUserId,
            email: profile.email,
            emailVerified: true,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            lastLoginAt: now,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          entidade: 'user_auth_provider',
          entidadeId: user.id,
          acao: AcaoAuditoria.CRIAR,
          payloadAfter: {
            provider,
            providerUserId: profile.providerUserId,
            email: profile.email,
          },
          ipAddress: ip,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          entidade: 'usuarios',
          entidadeId: user.id,
          acao: AcaoAuditoria.ATUALIZAR,
          payloadBefore: { status: UserStatus.PENDING },
          payloadAfter: { status: UserStatus.ACTIVE, activatedAt: now.toISOString(), method: 'SOCIAL', provider },
          ipAddress: ip,
        },
      });

      return tx.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.ACTIVE,
          ativo: true,
          activatedAt: now,
          activationTokenHash: null,
          activationExpiresAt: null,
          activationCreatedAt: null,
        },
        include: { tenant: true },
      });
    });

    return {
      session: await this.createSessionForUser(activatedUser, provider, ip),
      redirectPath: this.getPostAuthRedirect(activatedUser),
    };
  }

  private async verifyOAuthState(
    state: string | undefined,
    stateCookie: string | undefined,
    provider: AuthProvider,
  ): Promise<OAuthStatePayload> {
    if (!state || !stateCookie || state !== stateCookie) {
      throw new UnauthorizedException(
        `Fluxo de login ${this.getProviderLabel(provider)} expirado. Tente novamente.`,
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync<OAuthStatePayload>(state, {
        secret: this.getJwtSecret(),
      });

      if (payload.type !== 'oauth_state' || payload.provider !== provider) {
        throw new Error('Invalid OAuth state payload.');
      }

      return payload;
    } catch {
      throw new UnauthorizedException(
        `Fluxo de login ${this.getProviderLabel(provider)} invalido. Tente novamente.`,
      );
    }
  }

  private async verifyPendingLink(pendingCookie: string | undefined): Promise<PendingLinkPayload> {
    if (!pendingCookie) {
      throw new UnauthorizedException('Confirmacao de vinculacao expirada. Tente novamente.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<PendingLinkPayload>(pendingCookie, {
        secret: this.getJwtSecret(),
      });

      if (payload.type !== 'oauth_pending_link') {
        throw new Error('Invalid pending link payload.');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Confirmacao de vinculacao expirada. Tente novamente.');
    }
  }

  private async fetchGoogleProfile(code: string): Promise<GoogleProfile> {
    const config = this.getGoogleConfig();

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    const tokenBody = (await tokenResponse.json()) as GoogleTokenResponse;

    if (!tokenResponse.ok || !tokenBody.access_token) {
      throw new UnauthorizedException(
        tokenBody.error_description || 'Nao foi possivel validar o login com Google.',
      );
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    });

    const profile = (await profileResponse.json()) as GoogleUserInfoResponse;

    if (!profileResponse.ok || !profile.sub || !profile.email) {
      throw new UnauthorizedException('Nao foi possivel obter os dados da conta Google.');
    }

    const emailVerified =
      profile.email_verified === true || profile.email_verified === 'true';

    if (!emailVerified) {
      throw new UnauthorizedException('A conta Google precisa ter e-mail verificado.');
    }

    return {
      providerUserId: profile.sub,
      email: profile.email,
      emailVerified,
      displayName: profile.name,
      avatarUrl: profile.picture,
    };
  }

  private async resolveUserForFirstLink(
    email: string,
    emailVerified: boolean,
    provider: AuthProvider,
  ): Promise<UserWithTenant> {
    const providerLabel = this.getProviderLabel(provider);

    if (!emailVerified) {
      throw new UnauthorizedException(`A conta ${providerLabel} precisa ter e-mail verificado.`);
    }

    const users = await this.prisma.user.findMany({
      where: {
        email: { equals: email, mode: 'insensitive' },
        NOT: { role: Role.SUPER_ADMIN },
      },
      include: { tenant: true },
      take: 2,
    });

    if (users.length !== 1) {
      throw new UnauthorizedException(
        `Nao encontramos um usuario ativo do OneElo para este e-mail ${providerLabel}.`,
      );
    }

    return this.assertUserCanLogin(users[0]);
  }

  private assertUserCanLogin(user: UserWithTenant): UserWithTenant {
    if (user.role === Role.SUPER_ADMIN) {
      throw new UnauthorizedException('Usuario sem acesso ao login social.');
    }

    if (user.status === UserStatus.PENDING) {
      throw new ForbiddenException({
        code: 'ACCOUNT_PENDING_ACTIVATION',
        message: ACCOUNT_PENDING_ACTIVATION_MESSAGE,
      });
    }

    if (!user.ativo || user.status === UserStatus.DISABLED) {
      throw new ForbiddenException({
        code: 'ACCOUNT_DISABLED',
        message: ACCOUNT_DISABLED_MESSAGE,
      });
    }

    if (!user.tenantId || !user.tenant) {
      throw new UnauthorizedException('Usuario sem tenant vinculado.');
    }

    if (!user.tenant.ativo) {
      throw new ForbiddenException(
        'Acesso suspenso. Entre em contato com o administrador.',
      );
    }

    return user;
  }

  private async createSessionForUser(
    user: UserWithTenant,
    provider: AuthProvider,
    ip?: string,
  ): Promise<AuthSessionResult> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      memberId: user.memberId ?? undefined,
      tenantId: user.tenantId ?? undefined,
    };

    const expiresIn = getUserSessionExpiresIn(this.configService.get<string>('JWT_EXPIRES_IN'));
    const expiresAt = new Date(Date.now() + parseDurationToMilliseconds(expiresIn)).toISOString();
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.getJwtSecret(),
      expiresIn,
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        entidade: 'usuarios',
        entidadeId: user.id,
        acao: AcaoAuditoria.LOGIN,
        payloadAfter: {
          method: 'SOCIAL',
          provider,
        },
        ipAddress: ip,
      },
    });

    return {
      accessToken,
      expiresIn,
      expiresAt,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        onboardingCompletedAt: user.onboardingCompletedAt,
        tenantNome: user.tenant!.nome,
      },
    };
  }

  private getPostAuthRedirect(user: UserWithTenant, requestedPath?: string | null) {
    if (!user.onboardingCompletedAt) {
      return '/onboarding';
    }

    if (requestedPath && !(user.role === Role.BASIC && requestedPath === '/dashboard')) {
      return requestedPath;
    }

    return user.role === Role.BASIC ? '/personal-panel' : '/dashboard';
  }

  private toPendingResult(payload: PendingLinkPayload): PendingLinkResult {
    return {
      provider: payload.provider,
      email: payload.email,
      displayName: payload.displayName,
      avatarUrl: payload.avatarUrl,
      userId: payload.userId,
      userEmail: payload.userEmail,
      userName: payload.userName,
      redirectPath: payload.redirectPath,
      expiresInMs: OAUTH_TRANSIENT_COOKIE_MAX_AGE_MS,
    };
  }

  private parseAuthProvider(value: string): AuthProvider {
    const normalized = value?.trim().toUpperCase();

    if (normalized === AuthProvider.GOOGLE) {
      return AuthProvider.GOOGLE;
    }

    if (normalized === AuthProvider.APPLE) {
      return AuthProvider.APPLE;
    }

    throw new BadRequestException('Provedor de login invalido.');
  }

  private getProviderLabel(provider: AuthProvider): string {
    if (provider === AuthProvider.GOOGLE) {
      return 'Google';
    }

    if (provider === AuthProvider.APPLE) {
      return 'Apple';
    }

    return provider;
  }

  private getGoogleConfig(): {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  } {
    const clientId = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID')?.trim();
    const clientSecret = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_SECRET')?.trim();
    const callbackUrl = this.configService.get<string>('GOOGLE_OAUTH_CALLBACK_URL')?.trim();

    if (!clientId || !clientSecret || !callbackUrl) {
      throw new ServiceUnavailableException(
        'Login com Google indisponivel. Configuracao OAuth ausente.',
      );
    }

    return { clientId, clientSecret, callbackUrl };
  }

  private getJwtSecret(): string {
    const secret = this.configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new ServiceUnavailableException('JWT_SECRET nao configurado.');
    }

    return secret;
  }

  private normalizeRedirectPath(value?: string): string {
    if (
      !value ||
      !value.startsWith('/') ||
      value.startsWith('//') ||
      value.includes('://') ||
      value.startsWith('/api/')
    ) {
      return '/dashboard';
    }

    return value;
  }
}
