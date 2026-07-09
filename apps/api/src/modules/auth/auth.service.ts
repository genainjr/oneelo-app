import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { AcaoAuditoria, StatusMembro } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto, ip?: string) {
    // 1. Buscar usuário pelo email — sem filtro de tenantId pois o email é único globalmente
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, ativo: true },
      include: { tenant: true },
    });

    if (!user || user.role === 'SUPER_ADMIN') {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (!user.tenant?.ativo) {
      throw new ForbiddenException(
        'Acesso suspenso. Entre em contato com o administrador.',
      );
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
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '8h',
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
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantNome: user.tenant.nome,
      },
    };
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
      where: { id: userId, tenantId, ativo: true },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        tenantId: true,
        memberId: true,
        createdAt: true,
        membro: {
          where: { deletedAt: null, status: StatusMembro.ATIVO },
          select: {
            id: true,
            nome: true,
            nomeExibicao: true,
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
          select: { nome: true, slug: true, plano: true, limiteMembros: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    return user;
  }

  async changePassword(
    userId: string,
    tenantId: string,
    dto: ChangePasswordDto,
    ip?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, ativo: true },
      select: { id: true, senhaHash: true },
    });

    if (!user) {
      throw new UnauthorizedException('Sessao invalida.');
    }

    const senhaAtualValida = await bcrypt.compare(dto.senhaAtual, user.senhaHash);
    if (!senhaAtualValida) {
      throw new UnauthorizedException('Senha atual invalida.');
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

    return { message: 'Senha alterada com sucesso.' };
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
        memberId: true,
        createdAt: true,
        membro: {
          select: { id: true, nome: true },
        },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findAllAuditLogs(tenantId: string) {
    return this.prisma.auditLog.findMany({
      where: { tenantId },
      include: {
        user: {
          select: { id: true, nome: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
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

    const senhaHash = await bcrypt.hash(dto.senha, 10);

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
        throw new ConflictException('Este membro já possui um usuário vinculado.');
      }
    }

    const newUser = await this.prisma.user.create({
      data: {
        tenantId,
        nome: dto.nome,
        email: dto.email,
        senhaHash,
        role: dto.role,
        ativo: dto.ativo ?? true,
        memberId: dto.memberId ?? null,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        ativo: true,
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

    return newUser;
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
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (dto.email && dto.email !== user.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException('Este e-mail já está em uso por outro usuário.');
      }
    }

    const updateData: any = {};
    if (dto.nome !== undefined) updateData.nome = dto.nome;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.ativo !== undefined) updateData.ativo = dto.ativo;
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
          throw new ConflictException('Este membro já possui um usuário vinculado.');
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

  async deleteUser(
    id: string,
    tenantId: string,
    actorId: string,
    ip?: string,
  ) {
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
      data: { ativo: false },
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
}
