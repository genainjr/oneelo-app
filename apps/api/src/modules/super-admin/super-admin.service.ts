import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: AdminLoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, tenantId: null, role: Role.SUPER_ADMIN, ativo: true },
    });

    if (!user) throw new UnauthorizedException('Credenciais inválidas.');

    const senhaValida = await bcrypt.compare(dto.senha, user.senhaHash);
    if (!senhaValida) throw new UnauthorizedException('Credenciais inválidas.');

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '8h',
    });

    return {
      accessToken,
      user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
    };
  }

  async listTenants() {
    return this.prisma.tenant.findMany({
      select: {
        id: true,
        nome: true,
        slug: true,
        plano: true,
        statusAssinatura: true,
        ativo: true,
        email: true,
        telefone: true,
        idioma: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTenant(dto: CreateTenantDto) {
    const slugExists = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (slugExists) throw new ConflictException('Slug já está em uso.');

    const emailExists = await this.prisma.user.findFirst({ where: { email: dto.adminEmail } });
    if (emailExists) throw new ConflictException('E-mail do administrador já está em uso.');

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          nome: dto.nome,
          slug: dto.slug,
          plano: dto.plano ?? 'GRATUITO',
          email: dto.email,
          telefone: dto.telefone,
          idioma: dto.idioma,
        },
      });

      const senhaHash = await bcrypt.hash(dto.adminSenha, 10);
      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          nome: dto.adminNome,
          email: dto.adminEmail,
          senhaHash,
          role: Role.ADMIN,
        },
        select: { id: true, nome: true, email: true, role: true },
      });

      return { tenant, adminUser };
    });
  }

  async updateTenant(id: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined && { nome: dto.nome }),
        ...(dto.plano !== undefined && { plano: dto.plano }),
        ...(dto.ativo !== undefined && { ativo: dto.ativo }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.telefone !== undefined && { telefone: dto.telefone }),
        ...(dto.idioma !== undefined && { idioma: dto.idioma }),
      },
      select: {
        id: true,
        nome: true,
        slug: true,
        plano: true,
        statusAssinatura: true,
        ativo: true,
        email: true,
        telefone: true,
        idioma: true,
        createdAt: true,
      },
    });
  }

  async createTenantUser(tenantId: string, dto: CreateTenantUserDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');

    const emailExists = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (emailExists) throw new ConflictException('E-mail já está em uso.');

    const senhaHash = await bcrypt.hash(dto.senha, 10);
    return this.prisma.user.create({
      data: {
        tenantId,
        nome: dto.nome,
        email: dto.email,
        senhaHash,
        role: dto.role ?? Role.ADMIN,
      },
      select: { id: true, nome: true, email: true, role: true, createdAt: true },
    });
  }
}
