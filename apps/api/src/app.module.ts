import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MembrosModule } from './modules/membros/membros.module';
import { TagsModule } from './modules/tags/tags.module';
import { MinisteriosModule } from './modules/ministerios/ministerios.module';
import { EventosModule } from './modules/eventos/eventos.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EscalasModule } from './modules/escalas/escalas.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { LeadsModule } from './modules/leads/leads.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PwaModule } from './modules/pwa/pwa.module';
import { FinanceiroModule } from './modules/financeiro/financeiro.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Carrega variáveis de ambiente globalmente
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting global — login usa configuração mais restritiva via @Throttle()
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    // Jobs internos simples, sem Redis/BullMQ.
    ScheduleModule.forRoot(),
    // Banco de dados global
    PrismaModule,
    // Módulos de funcionalidade — Fase 2
    AuthModule,
    MembrosModule,
    // Módulos de funcionalidade — Fase 3
    TagsModule,
    MinisteriosModule,
    EventosModule,
    DashboardModule,
    EscalasModule,
    SuperAdminModule,
    LeadsModule,
    NotificationsModule,
    PwaModule,
    FinanceiroModule,
  ],
  controllers: [HealthController],
  providers: [
    // Filtro global de exceções HTTP
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Interceptor de auditoria global para mutações em entidades críticas
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    // Guard JWT global — todas as rotas exigem autenticação por padrão
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Guard de roles global — valida @Roles() em cada rota
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
