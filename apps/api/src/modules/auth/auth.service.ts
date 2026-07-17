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
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { TenantMediaService } from '../../common/storage/tenant-media.service';
import {
  AcaoAuditoria,
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
      tenant: { nome: string } | null;
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

    return {
      accessToken,
      expiresIn,
      expiresAt,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        onboardingCompletedAt: user.onboardingCompletedAt,
        tenantId: user.tenantId,
        tenantNome: user.tenant!.nome,
      },
    };
  }

  async login(dto: LoginDto, ip?: string) {
    // 1. Buscar usuário pelo email — sem filtro de tenantId pois o email é único globalmente
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    this.assertTenantUserCanLogin(user);

    if (!user.senhaHash) {
      throw new UnauthorizedException('Credenciais invÃ¡lidas.');
    }

    // 2. Verificar senha
    const senhaValida = await bcrypt.compare(dto.senha, user.senhaHash);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // 3. Montar payload do JWT
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      memberId: user.memberId ?? undefined,
      tenantId: user.tenantId ?? undefined,
    };

    // 4. Gerar token
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

    // 5. Registrar audit log de login
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

    return {
      accessToken,
      expiresIn,
      expiresAt,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        onboardingCompletedAt: user.onboardingCompletedAt,
        tenantId: user.tenantId,
        tenantNome: user.tenant!.nome,
      },
    };
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
          select: { nome: true, slug: true, logoUrl: true },
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
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, ativo: true, status: UserStatus.ACTIVE },
      select: {
        id: true,
        nome: true,
        email: true,
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
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const { senhaHash, ...safeUser } = user;

    return {
      ...safeUser,
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

  async updateMyProfile(
    userId: string,
    tenantId: string,
    dto: UpdateMyProfileDto,
    ip?: string,
  ) {
    const hasNome = Object.prototype.hasOwnProperty.call(dto, 'nome');
    const hasNomeExibicao = Object.prototype.hasOwnProperty.call(
      dto,
      'nomeExibicao',
    );
    const hasWhatsapp = Object.prototype.hasOwnProperty.call(dto, 'whatsapp');

    if (!hasNome && !hasNomeExibicao && !hasWhatsapp) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualizar.',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, ativo: true, status: UserStatus.ACTIVE },
      select: {
        id: true,
        nome: true,
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
            whatsapp: true,
          },
        })
      : null;

    const trimmedNome =
      hasNome && typeof dto.nome === 'string' ? dto.nome.trim() : undefined;
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

    const hasMemberFieldValue = (value: string | null | undefined) =>
      value !== undefined && value !== null && value !== '';
    const hasNomeExibicaoValue =
      hasNomeExibicao && hasMemberFieldValue(trimmedNomeExibicao);
    const hasWhatsappValue =
      hasWhatsapp && hasMemberFieldValue(trimmedWhatsapp);

    if (!member && (hasNomeExibicaoValue || hasWhatsappValue)) {
      throw new ForbiddenException(
        'Seu usuario nao possui membro vinculado para alterar nome de impressao ou telefone.',
      );
    }

    if (!member && !hasNome) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualizar.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (hasNome) {
        await tx.user.update({
          where: { id: userId },
          data: { nome: trimmedNome },
        });
      }

      if (member) {
        const memberData: Prisma.MembroUpdateInput = {};

        if (hasNome) {
          memberData.nome = trimmedNome;
        }

        if (hasNomeExibicao) {
          memberData.nomeExibicao = trimmedNomeExibicao || null;
        }

        if (hasWhatsapp) {
          memberData.whatsapp = trimmedWhatsapp || null;
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
            membro: member
              ? {
                  id: member.id,
                  nome: member.nome,
                  nomeExibicao: member.nomeExibicao,
                  whatsapp: member.whatsapp,
                }
              : null,
          },
          payloadAfter: {
            nome: hasNome ? trimmedNome : user.nome,
            membro: member
              ? {
                  id: member.id,
                  nome: hasNome ? trimmedNome : member.nome,
                  nomeExibicao: hasNomeExibicao
                    ? trimmedNomeExibicao || null
                    : member.nomeExibicao,
                  whatsapp: hasWhatsapp
                    ? trimmedWhatsapp || null
                    : member.whatsapp,
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
    return this.prisma.user.findMany({
      where: { tenantId },
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
        memberId: true,
        createdAt: true,
        membro: {
          select: { id: true, nome: true },
        },
      },
      orderBy: { nome: 'asc' },
    });
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
    if (dto.memberId) {
      const membro = await this.prisma.membro.findFirst({
        where: { id: dto.memberId, tenantId },
        include: { user: true },
      });
      if (!membro) {
        throw new NotFoundException('Membro não encontrado.');
      }
      if (membro.user) {
        throw new ConflictException(
          'Este membro já possui um usuário vinculado.',
        );
      }
    }

    const newUser = await this.prisma.user.create({
      data: {
        tenantId,
        nome: dto.nome,
        email: dto.email,
        senhaHash,
        role: dto.role,
        status,
        ativo: status === UserStatus.ACTIVE,
        activationTokenHash: activation?.tokenHash ?? null,
        activationExpiresAt: activation?.expiresAt ?? null,
        activationCreatedAt: activation?.createdAt ?? null,
        activatedAt: status === UserStatus.ACTIVE ? new Date() : null,
        memberId: dto.memberId ?? null,
      },
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

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'usuarios',
        entidadeId: newUser.id,
        acao: AcaoAuditoria.CRIAR,
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

  async regenerateActivationLink(
    id: string,
    tenantId: string,
    actorId: string,
    ip?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        status: true,
        activationTokenHash: true,
        activationExpiresAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    if (user.status !== UserStatus.PENDING) {
      throw new BadRequestException(
        'Apenas usuarios pendentes podem receber novo link de ativacao.',
      );
    }

    const activation = this.createActivationToken();
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        activationTokenHash: activation.tokenHash,
        activationExpiresAt: activation.expiresAt,
        activationCreatedAt: activation.createdAt,
      },
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

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'usuarios',
        entidadeId: id,
        acao: AcaoAuditoria.ATUALIZAR,
        payloadBefore: {
          status: user.status,
          activationExpiresAt: user.activationExpiresAt?.toISOString() ?? null,
        },
        payloadAfter: {
          status: updated.status,
          activationExpiresAt:
            updated.activationExpiresAt?.toISOString() ?? null,
        },
        ipAddress: ip,
      },
    });

    return {
      ...updated,
      activationLink: this.buildActivationLink(activation.token),
    };
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

    const updateData: any = {};
    if (dto.nome !== undefined) updateData.nome = dto.nome;
    if (dto.email !== undefined) updateData.email = dto.email;
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
    if (dto.memberId !== undefined) {
      if (dto.memberId === null) {
        // Desvincular
        updateData.memberId = null;
      } else {
        // Validar e vincular
        const membro = await this.prisma.membro.findFirst({
          where: { id: dto.memberId, tenantId },
          include: { user: true },
        });
        if (!membro) {
          throw new NotFoundException('Membro não encontrado.');
        }
        if (membro.user && membro.user.id !== id) {
          throw new ConflictException(
            'Este membro já possui um usuário vinculado.',
          );
        }
        updateData.memberId = dto.memberId;
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
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

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'usuarios',
        entidadeId: id,
        acao: AcaoAuditoria.ATUALIZAR,
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
      data: { ativo: false, status: UserStatus.DISABLED },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'usuarios',
        entidadeId: id,
        acao: AcaoAuditoria.DELETAR,
        ipAddress: ip,
      },
    });

    return { message: 'Usuário desativado com sucesso.' };
  }

  async findAvailableMembers(tenantId: string) {
    return this.prisma.membro.findMany({
      where: {
        tenantId,
        deletedAt: null,
        user: null, // apenas membros sem user vinculado
      },
      select: { id: true, nome: true, email: true },
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
}
