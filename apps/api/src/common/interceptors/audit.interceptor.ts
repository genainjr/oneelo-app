import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../types/jwt-payload.interface';
import { AcaoAuditoria } from '@prisma/client';
import { Request } from 'express';
import { getClientIp } from '../utils/request-ip';

// Entidades que serão auditadas automaticamente
const AUDITED_PATHS = [
  'membros',
  'escalas',
  'eventos',
  'ministerios',
  'usuarios',
];

// Mapa de método HTTP para ação de auditoria
const METHOD_ACTION_MAP: Record<string, AcaoAuditoria> = {
  POST: AcaoAuditoria.CRIAR,
  PATCH: AcaoAuditoria.ATUALIZAR,
  PUT: AcaoAuditoria.ATUALIZAR,
  DELETE: AcaoAuditoria.DELETAR,
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body } = request;
    const ip = getClientIp(request);

    const acao = METHOD_ACTION_MAP[method];

    // Auditar somente mutações (POST, PATCH, PUT, DELETE)
    if (!acao) {
      return next.handle();
    }

    // Verificar se a rota pertence a uma entidade auditada
    const isAudited = AUDITED_PATHS.some((path) => url.includes(`/${path}`));
    if (!isAudited) {
      return next.handle();
    }

    const user: JwtPayload | undefined = request['user'];

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          // Extrair entidade e ID da URL (ex: /api/membros/123 → entidade=membros, id=123)
          const urlParts = url.split('/').filter(Boolean);
          const entityIndex = urlParts.findIndex((part) =>
            AUDITED_PATHS.includes(part),
          );
          const entidade = urlParts[entityIndex] ?? 'desconhecido';
          const entidadeId =
            urlParts[entityIndex + 1] ?? responseData?.id ?? 'novo';

          if (user?.tenantId) {
            await this.prisma.auditLog.create({
              data: {
                tenantId: user.tenantId,
                userId: user.sub,
                entidade,
                entidadeId: String(entidadeId),
                acao,
                payloadBefore: method === 'DELETE' ? body : undefined,
                payloadAfter:
                  method !== 'DELETE' ? (responseData ?? body) : undefined,
                ipAddress: ip,
              },
            });
          }
        } catch (err) {
          // Auditoria nunca deve quebrar a requisição principal
          console.error('[AuditInterceptor] Erro ao salvar audit log:', err);
        }
      }),
    );
  }
}
