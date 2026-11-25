import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MembrosService } from '../membros/membros.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateLoginPhoneDto } from './dto/update-login-phone.dto';
import { UpdateTenantPwaSettingsDto } from './dto/update-tenant-pwa-settings.dto';
import { UpdateTenantThemeDto } from './dto/update-tenant-theme.dto';
import { resolveNormalizedTenantTheme } from './tenant-theme.constants';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { TenantMediaService } from '../../common/storage/tenant-media.service';
import {
  AcaoAuditoria,
  FinanceRole,
  Prisma,
  Role,
  StatusMembro,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import type { Multer } from 'multer';
import {
  getUserSessionExpiresIn,
  parseDurationToMilliseconds,
} from './auth-session';
import {
  ACCOUNT_DISABLED_MESSAGE,
  ACCOUNT_PENDING_ACTIVATION_MESSAGE,
} from './auth-access.constants';
import { buildActivationLink } from './activation-link';
import { maskLoginPhone, normalizeLoginPhone } from './login-phone';

@Injectable()
export class AuthService {
  private readonly activationTokenTtlMs = 72 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly membrosService: MembrosService,
    private readonly tenantMediaService: TenantMediaService,
  ) {}

  private normalizePhoneForWrite(value: string) {
    const normalized = normalizeLoginPhone(value);

    if (!normalized) {
      throw new BadRequestException(
        'Informe um telefone internacional valido, incluindo o DDI.',
      );
    }

    return normalized;
  }

  private rethrowPhoneUniqueConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = String(error.meta?.target ?? '');
      if (target.includes('login_phone') || target.includes('telefoneLogin')) {
        throw new ConflictException(
          'Este telefone já está em uso por outro usuário.',
        );
      }
    }

    throw error;
  }

  private hashActivationToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private createActivationToken() {
    const token = randomBytes(32).toString('hex');
    const now = new Date();

    return {
      token,
      tokenHash: this.hashActivationToken(token),
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.activationTokenTtlMs),
    };
  }

  private buildActivationLink(token: string) {
    return buildActivationLink(
      token,
      this.configService.get<string>('CORS_ORIGIN'),
      this.configService.get<string>('NODE_ENV'),
    );
  }

  private assertTenantUserCanLogin(user: {
    ativo: boolean;
    status: UserStatus;
    role: Role;
    tenantId: string | null;
    tenant?: { ativo: boolean } | null;
  }) {
    if (user.role === Role.SUPER_ADMIN) {
      throw new UnauthorizedException('Credenciais invalidas.');
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

    if (!user.tenantId || !user.tenant?.ativo) {
      throw new ForbiddenException(
        'Acesso suspenso. Entre em contato com o administrador.',
      );
    }
  }

  private async createSessionForUser(
    user: {
      id: string;
      nome: string;
      email: string;
      role: Role;
      memberId: string | null;
      onboardingCompletedAt: Date | null;
      tenantId: string | null;
      tenant: {
        nome: string;
        slug?: string | null;
        logoUrl?: string | null;
        logoKey?: string | null;
        pwaShortName?: string | null;
        pwaIconUrl?: string | null;
        pwaIconKey?: string | null;
        pwaUpdatedAt?: Date | string | null;
        themePalette?: string | null;
        primaryColor?: string | null;
        pixConfig?: { enabled: boolean } | null;
      } | null;
    },
    ip?: string,
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      memberId: user.memberId ?? undefined,
      tenantId: user.tenantId ?? undefined,
    };

    const expiresIn = getUserSessionExpiresIn(
      this.configService.get<string>('JWT_EXPIRES_IN'),
    );
    const expiresAt = new Date(
      Date.now() + parseDurationToMilliseconds(expiresIn),
    ).toISOString();
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn,
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        entidade: 'usuarios',
        entidadeId: user.id,
        acao: AcaoAuditoria.LOGIN,
        ipAddress: ip,
      },
    });

    let pixEnabled = Boolean(user.tenant?.pixConfig?.enabled);
    if (
      user.tenant?.slug &&
      user.tenant.pixConfig === undefined &&
      user.tenantId &&
      typeof this.prisma.tenantPixConfig?.findUnique === 'function'
    ) {
      const pixConfig = await this.prisma.tenantPixConfig.findUnique({
        where: { tenantId: user.tenantId },
        select: { enabled: true },
      });
      pixEnabled = Boolean(pixConfig?.enabled);
    }

    return {
      accessToken,
      expiresIn,
      expiresAt,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        memberId: user.memberId ?? null,
        onboardingCompletedAt: user.onboardingCompletedAt,
        tenantId: user.tenantId,
        tenantNome: user.tenant!.nome,
        tenant: user.tenant?.slug
          ? {
              nome: user.tenant.nome,
              slug: user.tenant.slug,
              logoUrl: user.tenant.logoUrl ?? null,
              logoKey: user.tenant.logoKey ?? null,
              pwaShortName: user.tenant.pwaShortName ?? null,
              pwaIconUrl: user.tenant.pwaIconUrl ?? null,
              pwaIconKey: user.tenant.pwaIconKey ?? null,
              pwaUpdatedAt:
                user.tenant.pwaUpdatedAt instanceof Date
                  ? user.tenant.pwaUpdatedAt.toISOString()
                  : (user.tenant.pwaUpdatedAt ?? null),
              themePalette: user.tenant.themePalette ?? null,
              primaryColor: user.tenant.primaryColor ?? null,
              pixEnabled,
            }
          : undefined,
      },
    };
  }

  async login(dto: LoginDto, ip?: string) {
    const identifier = dto.identificador?.trim();
    const legacyEmail = dto.email?.trim();

    if ((!identifier && !legacyEmail) || (identifier && legacyEmail)) {
      throw new BadRequestException('Informe e-mail ou telefone para entrar.');
    }

    const loginIdentifier = identifier ?? legacyEmail!;
    const isEmailLogin = Boolean(legacyEmail) || loginIdentifier.includes('@');
    let where: Prisma.UserWhereInput;

    if (isEmailLogin) {
      where = { email: loginIdentifier };
    } else {
      const telefoneLogin = normalizeLoginPhone(loginIdentifier);
      if (!telefoneLogin) {
        throw new UnauthorizedException('Credenciais invalidas.');
      }
      where = { telefoneLogin };
    }

    const user = await this.prisma.user.findFirst({
      where,
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    this.assertTenantUserCanLogin(user);

    if (!user.senhaHash) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const senhaValida = await bcrypt.compare(dto.senha, user.senhaHash);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    return this.createSessionForUser(user, ip);
  }

  async validateActivationToken(token: string) {
    const tokenHash = this.hashActivationToken(token);
    const user = await this.prisma.user.findFirst({
      where: {
        activationTokenHash: tokenHash,
        status: UserStatus.PENDING,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        activationExpiresAt: true,
        tenant: {
          select: {
            nome: true,
            slug: true,
            logoUrl: true,
            pwaIconUrl: true,
            themePalette: true,
            primaryColor: true,
          },
        },
      },
    });

    if (
      !user ||
      !user.activationExpiresAt ||
      user.activationExpiresAt <= new Date()
    ) {
      throw new BadRequestException('Link de ativacao expirado ou invalido.');
    }

    return {
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
      },
      tenant: user.tenant,
      expiresAt: user.activationExpiresAt,
    };
  }

  async activateWithPassword(
    token: string,
    dto: ActivateAccountDto,
    ip?: string,
  ) {
    if (dto.senha !== dto.confirmarSenha) {
      throw new BadRequestException('A confirmacao nao confere com a senha.');
    }

    const tokenHash = this.hashActivationToken(token);
    const user = await this.prisma.user.findFirst({
      where: {
        activationTokenHash: tokenHash,
        status: UserStatus.PENDING,
      },
      include: { tenant: true },
    });

    if (
      !user ||
      !user.activationExpiresAt ||
      user.activationExpiresAt <= new Date()
    ) {
      throw new BadRequestException('Link de ativacao expirado ou invalido.');
    }

    if (!user.tenantId || !user.tenant?.ativo) {
      throw new ForbiddenException(
        'Acesso suspenso. Entre em contato com o administrador.',
      );
    }

    const now = new Date();
    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const activatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        senhaHash,
        status: UserStatus.ACTIVE,
        ativo: true,
        activatedAt: now,
        activationTokenHash: null,
        activationExpiresAt: null,
        activationCreatedAt: null,
      },
      include: { tenant: true },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: activatedUser.tenantId,
        userId: activatedUser.id,
        entidade: 'usuarios',
        entidadeId: activatedUser.id,
        acao: AcaoAuditoria.ATUALIZAR,
        payloadBefore: { status: UserStatus.PENDING },
        payloadAfter: {
          status: UserStatus.ACTIVE,
          activatedAt: now.toISOString(),
        },
        ipAddress: ip,
      },
    });

    return this.createSessionForUser(activatedUser, ip);
  }

  async logout(userId: string, tenantId?: string, ip?: string) {
    // Registrar audit log de logout
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        entidade: 'usuarios',
        entidadeId: userId,
        acao: AcaoAuditoria.LOGOUT,
        ipAddress: ip,
      },
    });
  }

  async me(userId: string, tenantId: string) {
    const [user, financeManagerCount] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userId, tenantId, ativo: true, status: UserStatus.ACTIVE },
        select: {
          id: true,
          nome: true,
          email: true,
          telefoneLogin: true,
          role: true,
          status: true,
          senhaHash: true,
          onboardingCompletedAt: true,
          tenantId: true,
          memberId: true,
          createdAt: true,
          membro: {
            where: { deletedAt: null, status: StatusMembro.ATIVO },
            select: {
              id: true,
              nome: true,
              nomeExibicao: true,
              fotoUrl: true,
              fotoKey: true,
              email: true,
              whatsapp: true,
              dataNascimento: true,
              status: true,
              matricula: true,
              cargo: true,
              dataBatismo: true,
              cpf: true,
              rg: true,
              sexo: true,
              estadoCivil: true,
              ministerios: {
                where: {
                  ministerio: { ativo: true },
                },
                select: {
                  role: true,
                  ministerio: {
                    select: {
                      id: true,
                      nome: true,
                      usaEscalas: true,
                    },
                  },
                },
              },
            },
          },
          tenant: {
            select: {
              nome: true,
              slug: true,
              plano: true,
              limiteMembros: true,
              logoUrl: true,
              logoKey: true,
              pwaShortName: true,
              pwaIconUrl: true,
              pwaIconKey: true,
              pwaUpdatedAt: true,
              themePalette: true,
              primaryColor: true,
              pixConfig: {
                select: {
                  enabled: true,
                },
              },
            },
          },
          financePermissions: {
            where: { revokedAt: null },
            select: { role: true },
            take: 1,
          },
        },
      }),
      this.prisma.financePermission.count({
        where: {
          tenantId,
          role: FinanceRole.FINANCE_MANAGER,
          revokedAt: null,
        },
      }),
    ]);

    if (!user) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const { senhaHash, financePermissions, tenant, ...safeUser } = user;
    const financePermission = financePermissions[0]?.role ?? null;
    const safeTenant = tenant
      ? (() => {
          const { pixConfig, ...tenantFields } = tenant;
          return {
            ...tenantFields,
            pixEnabled: Boolean(pixConfig?.enabled),
          };
        })()
      : tenant;

    return {
      ...safeUser,
      tenant: safeTenant,
      financePermission,
      financeHasManager: financeManagerCount > 0,
      financeCanBootstrap:
        financeManagerCount === 0 && user.role === Role.ADMIN,
      financeCanManage: financePermission === FinanceRole.FINANCE_MANAGER,
      hasPassword: Boolean(senhaHash),
    };
  }

  async completeOnboarding(userId: string, tenantId: string, ip?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, ativo: true, status: UserStatus.ACTIVE },
      select: {
        id: true,
        onboardingCompletedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Sessao invalida.');
    }

    if (!user.onboardingCompletedAt) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { onboardingCompletedAt: new Date() },
      });

      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          entidade: 'usuarios',
          entidadeId: userId,
          acao: AcaoAuditoria.ATUALIZAR,
          payloadBefore: { onboardingCompletedAt: null },
          payloadAfter: { onboardingCompletedAt: 'completed' },
          ipAddress: ip,
        },
      });
    }

    return this.me(userId, tenantId);
  }

  async changePassword(
    userId: string,
    tenantId: string,
    dto: ChangePasswordDto,
    ip?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, ativo: true, status: UserStatus.ACTIVE },
      select: {
        id: true,
        senhaHash: true,
        authProviders: {
          where: { ativo: true },
          select: { id: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Sessao invalida.');
    }

    const isCreatingFirstPassword = !user.senhaHash;

    if (isCreatingFirstPassword) {
      if (user.authProviders.length === 0) {
        throw new BadRequestException(
          'Esta conta nao possui uma forma valida de acesso para criar a primeira senha.',
        );
      }
    } else {
      if (!dto.senhaAtual?.trim()) {
        throw new BadRequestException('Senha atual e obrigatoria.');
      }

      const senhaAtualValida = await bcrypt.compare(
        dto.senhaAtual,
        user.senhaHash!,
      );
      if (!senhaAtualValida) {
        throw new UnauthorizedException('Senha atual invalida.');
      }
    }

    const senhaHash = await bcrypt.hash(dto.novaSenha, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { senhaHash },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        entidade: 'usuarios',
        entidadeId: userId,
        acao: AcaoAuditoria.ATUALIZAR,
        ipAddress: ip,
      },
    });

    return {
      message: isCreatingFirstPassword
        ? 'Senha criada com sucesso.'
        : 'Senha alterada com sucesso.',
      hasPassword: true,
    };
  }

  async updateMyLoginPhone(
    userId: string,
    tenantId: string,
    dto: UpdateLoginPhoneDto,
    ip?: string,
  ) {
    if (!Object.prototype.hasOwnProperty.call(dto, 'telefoneLogin')) {
      throw new BadRequestException(
        'Informe o telefone de login ou null para remover.',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, ativo: true, status: UserStatus.ACTIVE },
      select: { id: true, senhaHash: true, telefoneLogin: true },
    });

    if (!user) {
      throw new UnauthorizedException('Sessao invalida.');
    }

    if (!user.senhaHash) {
      throw new BadRequestException(
        'Crie uma senha antes de cadastrar um telefone de login.',
      );
    }

    const senhaAtualValida = await bcrypt.compare(
      dto.senhaAtual,
      user.senhaHash,
    );
    if (!senhaAtualValida) {
      throw new UnauthorizedException('Senha atual invalida.');
    }

    const telefoneLogin =
      typeof dto.telefoneLogin === 'string'
        ? this.normalizePhoneForWrite(dto.telefoneLogin)
        : null;

    if (telefoneLogin) {
      const conflict = await this.prisma.user.findFirst({
        where: { telefoneLogin, NOT: { id: userId } },
        select: { id: true },
      });
      if (conflict) {
        throw new ConflictException(
          'Este telefone já está em uso por outro usuário.',
        );
      }
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { telefoneLogin },
      });
    } catch (error) {
      this.rethrowPhoneUniqueConflict(error);
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        entidade: 'usuarios',
        entidadeId: userId,
        acao: AcaoAuditoria.ATUALIZAR,
        payloadBefore: { telefoneLogin: maskLoginPhone(user.telefoneLogin) },
        payloadAfter: { telefoneLogin: maskLoginPhone(telefoneLogin) },
        ipAddress: ip,
      },
    });

    return {
      message: telefoneLogin
        ? 'Telefone de login atualizado com sucesso.'
        : 'Telefone de login removido com sucesso.',
      telefoneLogin,
    };
  }

  async updateMyProfile(
    userId: string,
    tenantId: string,
    dto: UpdateMyProfileDto,
    ip?: string,
  ) {
    const hasNome = Object.prototype.hasOwnProperty.call(dto, 'nome');
    const hasEmail = Object.prototype.hasOwnProperty.call(dto, 'email');
    const hasNomeExibicao = Object.prototype.hasOwnProperty.call(
      dto,
      'nomeExibicao',
    );
    const hasWhatsapp = Object.prototype.hasOwnProperty.call(dto, 'whatsapp');
    const hasCpf = Object.prototype.hasOwnProperty.call(dto, 'cpf');
    const hasRg = Object.prototype.hasOwnProperty.call(dto, 'rg');
    const hasDataNascimento = Object.prototype.hasOwnProperty.call(
      dto,
      'dataNascimento',
    );
    const hasDataBatismo = Object.prototype.hasOwnProperty.call(
      dto,
      'dataBatismo',
    );
    const hasEstadoCivil = Object.prototype.hasOwnProperty.call(
      dto,
      'estadoCivil',
    );
    const hasSexo = Object.prototype.hasOwnProperty.call(dto, 'sexo');

    if (
      !hasNome &&
      !hasEmail &&
      !hasNomeExibicao &&
      !hasWhatsapp &&
      !hasCpf &&
      !hasRg &&
      !hasDataNascimento &&
      !hasDataBatismo &&
      !hasEstadoCivil &&
      !hasSexo
    ) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualizar.',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, ativo: true, status: UserStatus.ACTIVE },
      select: {
        id: true,
        nome: true,
        email: true,
        memberId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Sessao invalida.');
    }

    const member = user.memberId
      ? await this.prisma.membro.findFirst({
          where: {
            id: user.memberId,
            tenantId,
            deletedAt: null,
            status: StatusMembro.ATIVO,
          },
          select: {
            id: true,
            nome: true,
            nomeExibicao: true,
            email: true,
            whatsapp: true,
            cpf: true,
            rg: true,
            dataNascimento: true,
            dataBatismo: true,
            estadoCivil: true,
            sexo: true,
          },
        })
      : null;

    const trimmedNome =
      hasNome && typeof dto.nome === 'string' ? dto.nome.trim() : undefined;
    const trimmedEmail =
      hasEmail && typeof dto.email === 'string'
        ? dto.email.trim().toLowerCase()
        : undefined;
    const trimmedNomeExibicao =
      hasNomeExibicao && typeof dto.nomeExibicao === 'string'
        ? dto.nomeExibicao.trim()
        : dto.nomeExibicao;
    const trimmedWhatsapp =
      hasWhatsapp && typeof dto.whatsapp === 'string'
        ? dto.whatsapp.trim()
        : dto.whatsapp;

    if (hasNome && !trimmedNome) {
      throw new BadRequestException('Nome completo e obrigatorio.');
    }

    if (hasEmail && !trimmedEmail) {
      throw new BadRequestException('E-mail e obrigatorio.');
    }

    if (hasEmail && trimmedEmail && trimmedEmail !== user.email) {
      const emailEmUso = await this.prisma.user.findFirst({
        where: {
          email: trimmedEmail,
          NOT: { id: userId },
        },
        select: { id: true },
      });
      if (emailEmUso) {
        throw new BadRequestException(
          'Este e-mail ja esta em uso por outro usuario.',
        );
      }
    }

    const hasAnyMemberField =
      hasNomeExibicao ||
      hasWhatsapp ||
      hasCpf ||
      hasRg ||
      hasDataNascimento ||
      hasDataBatismo ||
      hasEstadoCivil ||
      hasSexo;

    if (!member && hasAnyMemberField && !hasNome && !hasEmail) {
      throw new ForbiddenException(
        'Seu usuario nao possui membro vinculado para alterar dados cadastrais.',
      );
    }

    if (!member && !hasNome && !hasEmail) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualizar.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const userData: Prisma.UserUpdateInput = {};
      if (hasNome) {
        userData.nome = trimmedNome;
      }
      if (hasEmail && trimmedEmail) {
        userData.email = trimmedEmail;
      }
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userData,
        });
      }

      if (member) {
        const memberData: Prisma.MembroUpdateInput = {};

        if (hasNome) {
          memberData.nome = trimmedNome;
        }

        if (hasEmail) {
          memberData.email = trimmedEmail || null;
        }

        if (hasNomeExibicao) {
          memberData.nomeExibicao = trimmedNomeExibicao || null;
        }

        if (hasWhatsapp) {
          memberData.whatsapp = trimmedWhatsapp || null;
        }

        if (hasCpf) {
          const rawCpf = dto.cpf ? dto.cpf.replace(/\D/g, '') : null;
          memberData.cpf = rawCpf || null;
        }

        if (hasRg) {
          memberData.rg = dto.rg ? dto.rg.trim() : null;
        }

        if (hasDataNascimento) {
          memberData.dataNascimento = dto.dataNascimento
            ? new Date(dto.dataNascimento)
            : null;
        }

        if (hasDataBatismo) {
          memberData.dataBatismo = dto.dataBatismo
            ? new Date(dto.dataBatismo)
            : null;
        }

        if (hasEstadoCivil) {
          memberData.estadoCivil = dto.estadoCivil || null;
        }

        if (hasSexo) {
          memberData.sexo = dto.sexo || null;
        }

        if (Object.keys(memberData).length > 0) {
          await tx.membro.update({
            where: { id: member.id },
            data: memberData,
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          entidade: 'usuarios',
          entidadeId: userId,
          acao: AcaoAuditoria.ATUALIZAR,
          payloadBefore: {
            nome: user.nome,
            email: user.email,
            membro: member
              ? {
                  id: member.id,
                  nome: member.nome,
                  email: member.email,
                  nomeExibicao: member.nomeExibicao,
                  whatsapp: member.whatsapp,
                  cpf: member.cpf,
                  rg: member.rg,
                  dataNascimento: member.dataNascimento,
                  dataBatismo: member.dataBatismo,
                  estadoCivil: member.estadoCivil,
                  sexo: member.sexo,
                }
              : null,
          },
          payloadAfter: {
            nome: hasNome ? trimmedNome : user.nome,
            email: hasEmail && trimmedEmail ? trimmedEmail : user.email,
            membro: member
              ? {
                  id: member.id,
                  nome: hasNome ? trimmedNome : member.nome,
                  email: hasEmail ? trimmedEmail || null : member.email,
                  nomeExibicao: hasNomeExibicao
                    ? trimmedNomeExibicao || null
                    : member.nomeExibicao,
                  whatsapp: hasWhatsapp
                    ? trimmedWhatsapp || null
                    : member.whatsapp,
                  cpf: hasCpf
                    ? dto.cpf
                      ? dto.cpf.replace(/\D/g, '')
                      : null
                    : member.cpf,
                  rg: hasRg ? (dto.rg ? dto.rg.trim() : null) : member.rg,
                  dataNascimento: hasDataNascimento
                    ? dto.dataNascimento
                      ? new Date(dto.dataNascimento)
                      : null
                    : member.dataNascimento,
                  dataBatismo: hasDataBatismo
                    ? dto.dataBatismo
                      ? new Date(dto.dataBatismo)
                      : null
                    : member.dataBatismo,
                  estadoCivil: hasEstadoCivil
                    ? dto.estadoCivil || null
                    : member.estadoCivil,
                  sexo: hasSexo ? dto.sexo || null : member.sexo,
                }
              : null,
          },
          ipAddress: ip,
        },
      });
    });

    return this.me(userId, tenantId);
  }

  async findAllUsers(tenantId: string) {
    return this.prisma.user
      .findMany({
        where: { tenantId },
        select: {
          id: true,
          nome: true,
          email: true,
          telefoneLogin: true,
          role: true,
          ativo: true,
          status: true,
          senhaHash: true,
          activationExpiresAt: true,
          activationCreatedAt: true,
          activatedAt: true,
          onboardingCompletedAt: true,
          memberId: true,
          createdAt: true,
          membro: {
            where: { deletedAt: null },
            select: { id: true, nome: true },
          },
          authProviders: {
            where: { ativo: true },
            select: { id: true },
            take: 1,
          },
          financePermissions: {
            where: { revokedAt: null },
            select: { role: true },
            take: 1,
          },
        },
        orderBy: { nome: 'asc' },
      })
      .then((users) =>
        users.map(
          ({
            financePermissions,
            senhaHash,
            authProviders,
            membro,
            ...user
          }) => {
            const activeMembro = membro
              ? { id: membro.id, nome: membro.nome }
              : null;

            return {
              ...user,
              memberId: activeMembro ? user.memberId : null,
              membro: activeMembro,
              financePermission: financePermissions[0]?.role ?? null,
              hasPassword: Boolean(senhaHash),
              hasAuthProvider: (authProviders?.length ?? 0) > 0,
            };
          },
        ),
      );
  }

  async findAllAuditLogs(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      acao?: AcaoAuditoria;
      entidade?: string;
      operador?: string;
    } = {},
  ) {
    const page = Math.max(1, Math.trunc(options.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.trunc(options.limit ?? 15)));
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {
      tenantId,
      ...(options.acao ? { acao: options.acao } : {}),
      ...(options.entidade ? { entidade: options.entidade } : {}),
      ...(options.operador === 'platform'
        ? { user: { role: Role.SUPER_ADMIN } }
        : options.operador
          ? { userId: options.operador }
          : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, nome: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async createUser(
    dto: CreateUserDto,
    tenantId: string,
    actorId: string,
    ip?: string,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    let telefoneLogin: string | null = null;
    if (dto.telefoneLogin !== undefined) {
      telefoneLogin = this.normalizePhoneForWrite(dto.telefoneLogin);
      const phoneConflict = await this.prisma.user.findFirst({
        where: { telefoneLogin },
        select: { id: true },
      });
      if (phoneConflict) {
        throw new ConflictException(
          'Este telefone já está em uso por outro usuário.',
        );
      }
    }

    const senhaHash = dto.senha ? await bcrypt.hash(dto.senha, 10) : null;
    const status =
      dto.ativo === false
        ? UserStatus.DISABLED
        : senhaHash
          ? UserStatus.ACTIVE
          : UserStatus.PENDING;
    const activation =
      status === UserStatus.PENDING ? this.createActivationToken() : null;

    // Validar memberId se fornecido
    let releaseDisabledUserId: string | null = null;
    if (dto.memberId) {
      ({ releaseDisabledUserId } = await this.resolveMemberForUserLink(
        tenantId,
        dto.memberId,
      ));
    }

    const createData = {
      tenantId,
      nome: dto.nome,
      email: dto.email,
      telefoneLogin,
      senhaHash,
      role: dto.role,
      status,
      ativo: status === UserStatus.ACTIVE,
      activationTokenHash: activation?.tokenHash ?? null,
      activationExpiresAt: activation?.expiresAt ?? null,
      activationCreatedAt: activation?.createdAt ?? null,
      activatedAt: status === UserStatus.ACTIVE ? new Date() : null,
      memberId: dto.memberId ?? null,
    };
    const userSelect = {
      id: true,
      nome: true,
      email: true,
      telefoneLogin: true,
      role: true,
      ativo: true,
      status: true,
      activationExpiresAt: true,
      activationCreatedAt: true,
      activatedAt: true,
      onboardingCompletedAt: true,
      createdAt: true,
    };

    let newUser;
    try {
      newUser = releaseDisabledUserId
        ? await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: releaseDisabledUserId! },
              data: { memberId: null },
            });
            return tx.user.create({ data: createData, select: userSelect });
          })
        : await this.prisma.user.create({
            data: createData,
            select: userSelect,
          });
    } catch (error) {
      this.rethrowPhoneUniqueConflict(error);
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'usuarios',
        entidadeId: newUser.id,
        acao: AcaoAuditoria.CRIAR,
        payloadAfter: { telefoneLogin: maskLoginPhone(telefoneLogin) },
        ipAddress: ip,
      },
    });

    return {
      ...newUser,
      activationLink: activation
        ? this.buildActivationLink(activation.token)
        : null,
    };
  }

  async createPendingBasicUserInTx(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      nome: string;
      email: string;
      telefoneLogin?: string | null;
      memberId?: string | null;
      actorId?: string;
      ip?: string;
      ignorarTelefoneSeEmUso?: boolean;
    },
  ) {
    const existing = await tx.user.findFirst({
      where: { email: params.email.trim().toLowerCase() },
      select: { id: true, tenantId: true, status: true, memberId: true },
    });
    if (existing) {
      if (
        existing.tenantId === params.tenantId &&
        existing.status === UserStatus.DISABLED &&
        !existing.memberId
      ) {
        throw new ConflictException(
          'Já existe uma conta desativada com este e-mail sem membro vinculado. Você pode reativá-la ou ajustar seu vínculo em Configurações > Usuários.',
        );
      }
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    let telefoneLogin: string | null = null;
    if (params.telefoneLogin) {
      try {
        telefoneLogin = this.normalizePhoneForWrite(params.telefoneLogin);
      } catch {
        telefoneLogin = null;
      }
      if (telefoneLogin) {
        const phoneConflict = await tx.user.findFirst({
          where: { telefoneLogin },
          select: { id: true },
        });
        if (phoneConflict) {
          if (params.ignorarTelefoneSeEmUso) {
            telefoneLogin = null;
          } else {
            throw new ConflictException(
              'Este telefone já está em uso por outro usuário.',
            );
          }
        }
      }
    }

    const activation = this.createActivationToken();

    let newUser;
    try {
      newUser = await tx.user.create({
        data: {
          tenantId: params.tenantId,
          nome: params.nome.trim(),
          email: params.email.trim().toLowerCase(),
          telefoneLogin,
          senhaHash: null,
          role: Role.BASIC,
          status: UserStatus.PENDING,
          ativo: false,
          activationTokenHash: activation.tokenHash,
          activationExpiresAt: activation.expiresAt,
          activationCreatedAt: activation.createdAt,
          memberId: params.memberId ?? null,
        },
        select: {
          id: true,
          nome: true,
          email: true,
          telefoneLogin: true,
          role: true,
          ativo: true,
          status: true,
          activationExpiresAt: true,
          memberId: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.rethrowPhoneUniqueConflict(error);
    }

    if (params.actorId) {
      await tx.auditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.actorId,
          entidade: 'usuarios',
          entidadeId: newUser.id,
          acao: AcaoAuditoria.CRIAR,
          payloadAfter: {
            origem: 'aprovacao_ficha_membro',
            telefoneLogin: maskLoginPhone(telefoneLogin),
          },
          ipAddress: params.ip,
        },
      });
    }

    return {
      user: newUser,
      activationLink: this.buildActivationLink(activation.token),
    };
  }

  private async updatePendingOrReactivateUserInTx(
    prismaLike: PrismaService | Prisma.TransactionClient,
    params: {
      mode: 'REGENERATE_PENDING' | 'REACTIVATE_DISABLED';
      userId: string;
      tenantId: string;
      actorId?: string | null;
      ip?: string;
      nome?: string;
      email?: string;
      telefoneLogin?: string | null;
      regenerarLink?: boolean;
      ignorarTelefoneSeEmUso?: boolean;
      origemAuditoria?: string;
    },
  ) {
    const user = await prismaLike.user.findFirst({
      where: { id: params.userId, tenantId: params.tenantId },
      select: {
        id: true,
        nome: true,
        email: true,
        telefoneLogin: true,
        role: true,
        status: true,
        ativo: true,
        activationTokenHash: true,
        activationExpiresAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    const isReactivation = params.mode === 'REACTIVATE_DISABLED';

    if (isReactivation) {
      if (user.role !== Role.BASIC) {
        throw new ForbiddenException(
          'Contas administrativas (ADMIN/STAFF) não podem ser reativadas por este fluxo.',
        );
      }
      if (user.status !== UserStatus.DISABLED && user.ativo) {
        throw new BadRequestException(
          'Apenas usuarios desativados podem ser reativados por este fluxo.',
        );
      }
    } else if (user.status !== UserStatus.PENDING) {
      throw new BadRequestException(
        'Apenas usuarios pendentes podem receber novo link de ativacao.',
      );
    }

    const updateData: Prisma.UserUpdateInput = isReactivation
      ? {
          status: UserStatus.PENDING,
          ativo: false,
          senhaHash: null,
        }
      : {};

    if (params.nome !== undefined && params.nome.trim()) {
      const cleanNome = params.nome.trim();
      if (cleanNome !== user.nome) {
        updateData.nome = cleanNome;
      }
    }

    let emailChanged = false;
    if (params.email !== undefined) {
      const normalizedEmail = params.email.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new BadRequestException('Informe um e-mail valido para o usuario.');
      }
      if (normalizedEmail !== user.email) {
        const emailConflict = await prismaLike.user.findFirst({
          where: { email: normalizedEmail, NOT: { id: user.id } },
          select: { id: true },
        });
        if (emailConflict) {
          throw new ConflictException('Já existe um usuário com este e-mail.');
        }
        updateData.email = normalizedEmail;
        emailChanged = true;
      }
    }

    if (params.telefoneLogin !== undefined) {
      let normalizedPhone: string | null = null;
      if (typeof params.telefoneLogin === 'string' && params.telefoneLogin.trim()) {
        try {
          normalizedPhone = this.normalizePhoneForWrite(params.telefoneLogin);
        } catch {
          normalizedPhone = null;
        }
      }

      if (normalizedPhone !== user.telefoneLogin) {
        if (normalizedPhone) {
          const phoneConflict = await prismaLike.user.findFirst({
            where: { telefoneLogin: normalizedPhone, NOT: { id: user.id } },
            select: { id: true },
          });
          if (phoneConflict) {
            if (params.ignorarTelefoneSeEmUso) {
              normalizedPhone = null;
            } else {
              throw new ConflictException(
                'Este telefone já está em uso por outro usuário.',
              );
            }
          }
        }
        updateData.telefoneLogin = normalizedPhone;
      }
    }

    const shouldRegenerateLink = isReactivation
      ? true
      : params.regenerarLink !== false;
    const activation = shouldRegenerateLink ? this.createActivationToken() : null;

    if (activation) {
      updateData.activationTokenHash = activation.tokenHash;
      updateData.activationExpiresAt = activation.expiresAt;
      updateData.activationCreatedAt = activation.createdAt;
    }

    let updated: {
      id: string;
      nome: string;
      email: string;
      role: Role;
      ativo: boolean;
      status: UserStatus;
      activationExpiresAt: Date | null;
      activationCreatedAt: Date | null;
      activatedAt: Date | null;
      onboardingCompletedAt: Date | null;
      createdAt: Date;
    };

    try {
      updated = await prismaLike.user.update({
        where: { id: user.id },
        data: updateData,
        select: {
          id: true,
          nome: true,
          email: true,
          role: true,
          ativo: true,
          status: true,
          activationExpiresAt: true,
          activationCreatedAt: true,
          activatedAt: true,
          onboardingCompletedAt: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.rethrowPhoneUniqueConflict(error);
    }

    // Ao reativar com novo e-mail, revoga vinculos OAuth antigos para nao bloquear novo vinculo Google na ativacao
    if (isReactivation && emailChanged && (prismaLike as any).userAuthProvider) {
      await prismaLike.userAuthProvider.updateMany({
        where: { userId: user.id, ativo: true },
        data: { ativo: false, revokedAt: new Date() },
      });
    }

    await prismaLike.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.actorId || null,
        entidade: 'usuarios',
        entidadeId: user.id,
        acao: AcaoAuditoria.ATUALIZAR,
        payloadBefore: {
          status: user.status,
          ...(isReactivation ? { ativo: Boolean(user.ativo) } : {}),
          activationExpiresAt: user.activationExpiresAt?.toISOString() ?? null,
        },
        payloadAfter: {
          status: updated.status,
          ...(isReactivation ? { ativo: Boolean(updated.ativo) } : {}),
          activationExpiresAt:
            updated.activationExpiresAt?.toISOString() ?? null,
          ...(params.origemAuditoria ? { origem: params.origemAuditoria } : {}),
        },
        ipAddress: params.ip,
      },
    });

    return {
      ...updated,
      activationLink: activation
        ? this.buildActivationLink(activation.token)
        : null,
    };
  }

  async regeneratePendingActivationInTx(
    prismaLike: PrismaService | Prisma.TransactionClient,
    params: {
      userId: string;
      tenantId: string;
      actorId: string;
      ip?: string;
      nome?: string;
      email?: string;
      telefoneLogin?: string | null;
      regenerarLink?: boolean;
      origemAuditoria?: string;
    },
  ) {
    return this.updatePendingOrReactivateUserInTx(prismaLike, {
      ...params,
      mode: 'REGENERATE_PENDING',
    });
  }

  async reactivateDisabledUserInTx(
    prismaLike: PrismaService | Prisma.TransactionClient,
    params: {
      userId: string;
      tenantId: string;
      actorId?: string | null;
      ip?: string;
      nome?: string;
      email?: string;
      telefoneLogin?: string | null;
      ignorarTelefoneSeEmUso?: boolean;
      origemAuditoria?: string;
    },
  ) {
    return this.updatePendingOrReactivateUserInTx(prismaLike, {
      ...params,
      mode: 'REACTIVATE_DISABLED',
      regenerarLink: true,
    });
  }

  async regenerateActivationLink(
    id: string,
    tenantId: string,
    actorId: string,
    ip?: string,
  ) {
    return this.regeneratePendingActivationInTx(this.prisma, {
      userId: id,
      tenantId,
      actorId,
      ip,
    });
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    tenantId: string,
    actorId: string,
    ip?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      include: {
        authProviders: {
          where: { ativo: true },
          select: { id: true },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (dto.email && dto.email !== user.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(
          'Este e-mail já está em uso por outro usuário.',
        );
      }
    }

    const hasTelefoneLogin = Object.prototype.hasOwnProperty.call(
      dto,
      'telefoneLogin',
    );
    let telefoneLogin = user.telefoneLogin;

    if (hasTelefoneLogin) {
      telefoneLogin =
        typeof dto.telefoneLogin === 'string'
          ? this.normalizePhoneForWrite(dto.telefoneLogin)
          : null;

      if (telefoneLogin) {
        const phoneConflict = await this.prisma.user.findFirst({
          where: { telefoneLogin, NOT: { id } },
          select: { id: true },
        });
        if (phoneConflict) {
          throw new ConflictException(
            'Este telefone já está em uso por outro usuário.',
          );
        }
      }
    }

    const updateData: any = {};
    if (dto.nome !== undefined) updateData.nome = dto.nome;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (hasTelefoneLogin) updateData.telefoneLogin = telefoneLogin;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.ativo !== undefined) {
      if (
        dto.ativo &&
        !dto.senha &&
        !user.senhaHash &&
        user.authProviders.length === 0
      ) {
        throw new BadRequestException(
          'O usuario precisa ter senha ou provedor social ativo antes de ser ativado.',
        );
      }

      updateData.ativo = dto.ativo;
      updateData.status = dto.ativo ? UserStatus.ACTIVE : UserStatus.DISABLED;

      if (dto.ativo && user.status === UserStatus.PENDING) {
        updateData.activatedAt = user.activatedAt ?? new Date();
        updateData.activationTokenHash = null;
        updateData.activationExpiresAt = null;
        updateData.activationCreatedAt = null;
      }
    }
    if (dto.senha) updateData.senhaHash = await bcrypt.hash(dto.senha, 10);

    // Tratar vínculo com membro
    let releaseDisabledUserId: string | null = null;
    if (dto.memberId !== undefined) {
      if (dto.memberId === null) {
        // Desvincular
        updateData.memberId = null;
      } else {
        // Validar e vincular
        ({ releaseDisabledUserId } = await this.resolveMemberForUserLink(
          tenantId,
          dto.memberId,
          id,
        ));
        updateData.memberId = dto.memberId;
      }
    }

    const userSelect = {
      id: true,
      nome: true,
      email: true,
      telefoneLogin: true,
      role: true,
      ativo: true,
      status: true,
      activationExpiresAt: true,
      activationCreatedAt: true,
      activatedAt: true,
      onboardingCompletedAt: true,
      createdAt: true,
    };

    let updated;
    try {
      updated = releaseDisabledUserId
        ? await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: releaseDisabledUserId! },
              data: { memberId: null },
            });
            return tx.user.update({
              where: { id },
              data: updateData,
              select: userSelect,
            });
          })
        : await this.prisma.user.update({
            where: { id },
            data: updateData,
            select: userSelect,
          });
    } catch (error) {
      this.rethrowPhoneUniqueConflict(error);
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'usuarios',
        entidadeId: id,
        acao: AcaoAuditoria.ATUALIZAR,
        payloadBefore: hasTelefoneLogin
          ? { telefoneLogin: maskLoginPhone(user.telefoneLogin) }
          : undefined,
        payloadAfter: hasTelefoneLogin
          ? { telefoneLogin: maskLoginPhone(telefoneLogin) }
          : undefined,
        ipAddress: ip,
      },
    });

    return updated;
  }

  async deleteUser(id: string, tenantId: string, actorId: string, ip?: string) {
    if (id === actorId) {
      throw new ForbiddenException('Você não pode remover sua própria conta.');
    }

    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        ativo: false,
        status: UserStatus.DISABLED,
        memberId: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'usuarios',
        entidadeId: id,
        acao: AcaoAuditoria.DELETAR,
        ...(user.memberId
          ? { payloadBefore: { memberId: user.memberId } }
          : {}),
        ipAddress: ip,
      },
    });

    return { message: 'Usuário desativado com sucesso.' };
  }

  private async resolveMemberForUserLink(
    tenantId: string,
    memberId: string,
    excludeUserId?: string,
  ): Promise<{ releaseDisabledUserId: string | null }> {
    const membro = await this.prisma.membro.findFirst({
      where: { id: memberId, tenantId, deletedAt: null },
      include: {
        user: {
          select: { id: true, ativo: true, status: true },
        },
      },
    });

    if (!membro) {
      throw new NotFoundException('Membro não encontrado.');
    }

    if (membro.user && membro.user.id !== excludeUserId) {
      const isDisabledUser =
        !membro.user.ativo && membro.user.status === UserStatus.DISABLED;

      if (!isDisabledUser) {
        throw new ConflictException(
          'Este membro já possui um usuário vinculado.',
        );
      }

      return { releaseDisabledUserId: membro.user.id };
    }

    return { releaseDisabledUserId: null };
  }

  async findAvailableMembers(tenantId: string) {
    return this.prisma.membro.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { user: null },
          {
            user: {
              is: {
                ativo: false,
                status: UserStatus.DISABLED,
              },
            },
          },
        ],
      },
      select: { id: true, nome: true, email: true, whatsapp: true },
      orderBy: { nome: 'asc' },
    });
  }

  async updateMyPhoto(userId: string, tenantId: string, file: any) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, ativo: true, status: UserStatus.ACTIVE },
      select: { memberId: true },
    });

    if (!user?.memberId) {
      throw new ForbiddenException('Seu usuario nao possui membro vinculado.');
    }

    return this.membrosService.uploadMemberPhoto(tenantId, user.memberId, file);
  }

  async removeMyPhoto(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, ativo: true, status: UserStatus.ACTIVE },
      select: { memberId: true },
    });

    if (!user?.memberId) {
      throw new ForbiddenException('Seu usuario nao possui membro vinculado.');
    }

    return this.membrosService.removeMemberPhoto(tenantId, user.memberId);
  }

  async updateTenantLogo(
    tenantId: string,
    file: Multer.File,
    actorId: string,
    ip?: string,
  ) {
    return this.tenantMediaService.uploadTenantLogo(
      tenantId,
      file,
      actorId,
      ip,
    );
  }

  async removeTenantLogo(tenantId: string, actorId: string, ip?: string) {
    return this.tenantMediaService.removeTenantLogo(tenantId, actorId, ip);
  }

  async updateTenantPwaSettings(
    tenantId: string,
    dto: UpdateTenantPwaSettingsDto,
    actorId: string,
    ip?: string,
  ) {
    const shortName = dto.shortName.trim();
    if (!shortName)
      throw new BadRequestException('Nome curto do aplicativo e obrigatorio.');

    const previous = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, pwaShortName: true },
    });
    if (!previous) throw new NotFoundException('Tenant nao encontrado.');

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { pwaShortName: shortName, pwaUpdatedAt: new Date() },
      select: {
        nome: true,
        slug: true,
        logoUrl: true,
        pwaShortName: true,
        pwaIconUrl: true,
        pwaIconKey: true,
        pwaUpdatedAt: true,
        themePalette: true,
        primaryColor: true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'Tenant',
        entidadeId: tenantId,
        acao: AcaoAuditoria.ATUALIZAR,
        ipAddress: ip ?? null,
        payloadBefore: { pwaShortName: previous.pwaShortName },
        payloadAfter: { pwaShortName: shortName },
      },
    });
    return updated;
  }

  async updateTenantTheme(
    tenantId: string,
    dto: UpdateTenantThemeDto,
    actorId: string,
    ip?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Usuario sem tenant associado.');
    }

    const previous = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, themePalette: true, primaryColor: true },
    });
    if (!previous) {
      throw new NotFoundException('Tenant nao encontrado.');
    }

    const normalized = resolveNormalizedTenantTheme(dto);

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        themePalette: normalized.themePalette,
        primaryColor: normalized.primaryColor,
      },
      select: {
        nome: true,
        slug: true,
        logoUrl: true,
        logoKey: true,
        pwaShortName: true,
        pwaIconUrl: true,
        pwaIconKey: true,
        pwaUpdatedAt: true,
        themePalette: true,
        primaryColor: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'Tenant',
        entidadeId: tenantId,
        acao: AcaoAuditoria.ATUALIZAR,
        ipAddress: ip ?? null,
        payloadBefore: {
          themePalette: previous.themePalette ?? null,
          primaryColor: previous.primaryColor ?? null,
        },
        payloadAfter: {
          themePalette: normalized.themePalette,
          primaryColor: normalized.primaryColor,
        },
      },
    });

    return updated;
  }

  async updateTenantPwaIcon(
    tenantId: string,
    file: Multer.File,
    actorId: string,
    ip?: string,
  ) {
    return this.tenantMediaService.uploadTenantPwaIcon(
      tenantId,
      file,
      actorId,
      ip,
    );
  }

  async removeTenantPwaIcon(tenantId: string, actorId: string, ip?: string) {
    return this.tenantMediaService.removeTenantPwaIcon(tenantId, actorId, ip);
  }
}
