import { Module } from '@nestjs/common';
import { ExportModule } from '../../common/export';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StorageModule } from '../../common/storage/storage.module';
import { FinanceiroDocumentRendererService } from './export/financeiro-document-renderer.service';
import { FinanceAuthorizationService } from './finance-authorization.service';
import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialCategoriesService } from './financial-categories.service';
import { FinancialTransactionsService } from './financial-transactions.service';
import { FinanceiroController } from './financeiro.controller';
import { FinanceiroService } from './financeiro.service';

@Module({
  imports: [PrismaModule, StorageModule, ExportModule],
  controllers: [FinanceiroController],
  providers: [
    FinanceiroService,
    FinanceAuthorizationService,
    FinancialAccountsService,
    FinancialCategoriesService,
    FinancialTransactionsService,
    FinanceiroDocumentRendererService,
  ],
  exports: [
    FinanceiroService,
    FinanceAuthorizationService,
    FinancialAccountsService,
    FinancialCategoriesService,
    FinancialTransactionsService,
    FinanceiroDocumentRendererService,
  ],
})
export class FinanceiroModule {}
