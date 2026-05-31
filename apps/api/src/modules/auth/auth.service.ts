import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { AcaoAuditoria } from '@prisma/client';
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

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (!user.tenant.ativo) {
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
      tenantId: user.tenantId,
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

  async logout(userId: string, tenantId: string, ip?: string) {
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
        createdAt: true,
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

  async findAllUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        ativo: true,
        createdAt: true,
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
}
