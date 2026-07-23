import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StorageModule } from '../../common/storage/storage.module';
import { FinanceAuthorizationService } from './finance-authorization.service';
import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialCategoriesService } from './financial-categories.service';
import { FinancialTransactionsService } from './financial-transactions.service';
import { FinanceiroController } from './financeiro.controller';
import { FinanceiroService } from './financeiro.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [FinanceiroController],
  providers: [
    FinanceiroService,
    FinanceAuthorizationService,
    FinancialAccountsService,
    FinancialCategoriesService,
    FinancialTransactionsService,
  ],
  exports: [
    FinanceiroService,
    FinanceAuthorizationService,
    FinancialAccountsService,
    FinancialCategoriesService,
    FinancialTransactionsService,
  ],
})
export class FinanceiroModule {}
