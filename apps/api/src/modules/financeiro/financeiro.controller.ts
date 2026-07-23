import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import type { Multer } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MAX_FINANCIAL_RECEIPT_SIZE } from '../../common/storage/image-upload';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { CreateFinancialAccountDto } from './dto/create-financial-account.dto';
import { CreateFinancialCategoryDto } from './dto/create-financial-category.dto';
import { CreateFinancialTransactionDto } from './dto/create-financial-transaction.dto';
import { UpdateFinancialAccountDto } from './dto/update-financial-account.dto';
import { UpdateFinancialCategoryDto } from './dto/update-financial-category.dto';
import { UpdateFinancialTransactionDto } from './dto/update-financial-transaction.dto';
import { UpdateFinancePermissionDto } from './dto/update-finance-permission.dto';
import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialCategoriesService } from './financial-categories.service';
import { FinancialTransactionsService } from './financial-transactions.service';
import { FinanceiroService } from './financeiro.service';

function getClientIp(req: Request): string | undefined {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0]?.trim();
  }
  return req.ip;
}

@Controller('financeiro')
export class FinanceiroController {
  constructor(
    private readonly financeiroService: FinanceiroService,
    private readonly accountsService: FinancialAccountsService,
    private readonly categoriesService: FinancialCategoriesService,
    private readonly transactionsService: FinancialTransactionsService,
  ) {}

  @Get('permissions/me')
  async getMyPermission(@CurrentUser() user: JwtPayload) {
    return this.financeiroService.getPermissionSummary(user.tenantId!, user);
  }

  @Get('permissions')
  async listPermissions(@CurrentUser() user: JwtPayload) {
    return this.financeiroService.listPermissions(user.tenantId!, user);
  }

  @Patch('permissions/users/:id')
  async updateUserPermission(
    @Param('id') id: string,
    @Body() dto: UpdateFinancePermissionDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.financeiroService.updateUserPermission(
      user.tenantId!,
      id,
      dto.role,
      user,
      getClientIp(req),
    );
  }

  @Get('accounts')
  async listAccounts(@CurrentUser() user: JwtPayload) {
    return this.accountsService.findAll(user.tenantId!, user);
  }

  @Post('accounts')
  async createAccount(
    @Body() dto: CreateFinancialAccountDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.accountsService.create(user.tenantId!, user, dto);
  }

  @Patch('accounts/:id')
  async updateAccount(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialAccountDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.accountsService.update(user.tenantId!, user, id, dto);
  }

  @Delete('accounts/:id')
  async deactivateAccount(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.accountsService.deactivate(user.tenantId!, user, id);
  }

  @Get('categories')
  async listCategories(@CurrentUser() user: JwtPayload) {
    return this.categoriesService.findAll(user.tenantId!, user);
  }

  @Post('categories')
  async createCategory(
    @Body() dto: CreateFinancialCategoryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.categoriesService.create(user.tenantId!, user, dto);
  }

  @Patch('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialCategoryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.categoriesService.update(user.tenantId!, user, id, dto);
  }

  @Delete('categories/:id')
  async deactivateCategory(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.categoriesService.deactivate(user.tenantId!, user, id);
  }

  @Get('transactions')
  async listTransactions(
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: any,
    @Query('status') status?: any,
    @Query('accountId') accountId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.transactionsService.findAll(user.tenantId!, user, {
      startDate,
      endDate,
      type,
      status,
      accountId,
      categoryId,
    });
  }

  @Get('summary')
  async getSummary(
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('accountId') accountId?: string,
  ) {
    return this.transactionsService.getSummary(user.tenantId!, user, {
      startDate,
      endDate,
      accountId,
    });
  }

  @Post('transactions')
  async createTransaction(
    @Body() dto: CreateFinancialTransactionDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.transactionsService.create(
      user.tenantId!,
      user,
      dto,
      getClientIp(req),
    );
  }

  @Patch('transactions/:id')
  async updateTransaction(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialTransactionDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.transactionsService.update(
      user.tenantId!,
      user,
      id,
      dto,
      getClientIp(req),
    );
  }

  @Patch('transactions/:id/cancel')
  async cancelTransaction(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.transactionsService.cancel(
      user.tenantId!,
      user,
      id,
      getClientIp(req),
    );
  }

  @Post('transactions/:id/receipt')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: MAX_FINANCIAL_RECEIPT_SIZE },
  }))
  async uploadTransactionReceipt(
    @Param('id') id: string,
    @UploadedFile() file: Multer.File,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.transactionsService.uploadReceipt(
      user.tenantId!,
      user,
      id,
      file,
      getClientIp(req),
    );
  }

  @Delete('transactions/:id/receipt')
  async removeTransactionReceipt(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.transactionsService.removeReceipt(
      user.tenantId!,
      user,
      id,
      getClientIp(req),
    );
  }
}
