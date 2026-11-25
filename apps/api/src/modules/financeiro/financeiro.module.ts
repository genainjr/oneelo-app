import { Module } from '@nestjs/common';
import { ExportModule } from '../../common/export';
import { UserThrottlerGuard } from '../../common/guards/user-throttler.guard';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StorageModule } from '../../common/storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContribuicoesController } from './contribuicoes.controller';
import { ContribuicoesService } from './contribuicoes.service';
import { FinanceiroDocumentRendererService } from './export/financeiro-document-renderer.service';
import { FinanceAuthorizationService } from './finance-authorization.service';
import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialCategoriesService } from './financial-categories.service';
import { FinancialTransactionsService } from './financial-transactions.service';
import { FinanceiroController } from './financeiro.controller';
import { FinanceiroService } from './financeiro.service';
import { TenantPixConfigService } from './tenant-pix-config.service';

@Module({
  imports: [PrismaModule, StorageModule, ExportModule, NotificationsModule],
  controllers: [FinanceiroController, ContribuicoesController],
  providers: [
    FinanceiroService,
    FinanceAuthorizationService,
    FinancialAccountsService,
    FinancialCategoriesService,
    FinancialTransactionsService,
    FinanceiroDocumentRendererService,
    TenantPixConfigService,
    ContribuicoesService,
    UserThrottlerGuard,
  ],
  exports: [
    FinanceiroService,
    FinanceAuthorizationService,
    FinancialAccountsService,
    FinancialCategoriesService,
    FinancialTransactionsService,
    FinanceiroDocumentRendererService,
    TenantPixConfigService,
    ContribuicoesService,
  ],
})
export class FinanceiroModule {}
