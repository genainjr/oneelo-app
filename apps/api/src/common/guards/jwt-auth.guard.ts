import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../types/jwt-payload.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Request } from 'express';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Verifica se a rota foi marcada com @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Extrai o token do cookie HTTP-only
    const token = request.cookies?.['access_token'];

    if (!token) {
      throw new UnauthorizedException('Token de acesso não encontrado.');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        email: true,
        role: true,
        memberId: true,
        tenantId: true,
        ativo: true,
        status: true,
        tenant: {
          select: { ativo: true },
        },
      },
    });

    if (
      !user ||
      !user.ativo ||
      user.status !== UserStatus.ACTIVE ||
      user.tenantId !== (payload.tenantId ?? null)
    ) {
      throw new UnauthorizedException('Sessão inválida ou usuário sem acesso.');
    }

    if (user.tenantId && !user.tenant?.ativo) {
      throw new ForbiddenException(
        'Acesso suspenso. Entre em contato com o administrador.',
      );
    }

    request['user'] = {
      ...payload,
      email: user.email,
      role: user.role,
      memberId: user.memberId ?? undefined,
      tenantId: user.tenantId ?? undefined,
    } satisfies JwtPayload;
    if (user.tenantId) {
      request['tenantId'] = user.tenantId;
    }

    return true;
  }
}
