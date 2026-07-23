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
import { TenantMediaService } from '../../common/storage/tenant-media.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { Role, AcaoAuditoria, FinanceRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { Multer } from 'multer';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tenantMediaService: TenantMediaService,
  ) {}

  async login(dto: AdminLoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        tenantId: null,
        role: Role.SUPER_ADMIN,
        ativo: true,
        status: UserStatus.ACTIVE,
      },
    });

    if (!user) throw new UnauthorizedException('Credenciais inválidas.');

    if (!user.senhaHash) throw new UnauthorizedException('Credenciais invalidas.');

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
        logoUrl: true,
        logoKey: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTenant(dto: CreateTenantDto, adminId: string, ip?: string) {
    const slugExists = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (slugExists) throw new ConflictException('Slug já está em uso.');

    const emailExists = await this.prisma.user.findFirst({ where: { email: dto.adminEmail } });
    if (emailExists) throw new ConflictException('E-mail do administrador já está em uso.');

    const result = await this.prisma.$transaction(async (tx) => {
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
          status: UserStatus.ACTIVE,
          ativo: true,
          activatedAt: new Date(),
        },
        select: { id: true, nome: true, email: true, role: true },
      });

      await tx.financePermission.create({
        data: {
          tenantId: tenant.id,
          userId: adminUser.id,
          role: FinanceRole.FINANCE_MANAGER,
          createdByUserId: adminId,
          updatedByUserId: adminId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          entidade: 'Tenant',
          entidadeId: tenant.id,
          acao: AcaoAuditoria.CRIAR,
          ipAddress: ip ?? null,
          payloadAfter: { nome: dto.nome, slug: dto.slug, plano: dto.plano },
        },
      });

      return { tenant, adminUser };
    });

    return result;
  }

  async updateTenant(id: string, dto: UpdateTenantDto, adminId: string, ip?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');

    const updated = await this.prisma.tenant.update({
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
        logoUrl: true,
        logoKey: true,
        createdAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        tenantId: id,
        entidade: 'Tenant',
        entidadeId: id,
        acao: AcaoAuditoria.ATUALIZAR,
        ipAddress: ip ?? null,
        payloadBefore: { nome: tenant.nome, plano: tenant.plano, ativo: tenant.ativo },
        payloadAfter: dto as any,
      },
    });

    return updated;
  }

  async uploadTenantLogo(
    tenantId: string,
    file: Multer.File,
    adminId: string,
    ip?: string,
  ) {
    return this.tenantMediaService.uploadTenantLogo(tenantId, file, adminId, ip);
  }

  async removeTenantLogo(tenantId: string, adminId: string, ip?: string) {
    return this.tenantMediaService.removeTenantLogo(tenantId, adminId, ip);
  }

  async createTenantUser(tenantId: string, dto: CreateTenantUserDto, adminId: string, ip?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');

    const emailExists = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (emailExists) throw new ConflictException('E-mail já está em uso.');

    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const newUser = await this.prisma.user.create({
      data: {
        tenantId,
        nome: dto.nome,
        email: dto.email,
        senhaHash,
        role: dto.role ?? Role.ADMIN,
        status: UserStatus.ACTIVE,
        ativo: true,
        activatedAt: new Date(),
      },
      select: { id: true, nome: true, email: true, role: true, createdAt: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        tenantId,
        entidade: 'User',
        entidadeId: newUser.id,
        acao: AcaoAuditoria.CRIAR,
        ipAddress: ip ?? null,
        payloadAfter: { nome: dto.nome, email: dto.email, role: dto.role },
      },
    });

    return newUser;
  }
}
