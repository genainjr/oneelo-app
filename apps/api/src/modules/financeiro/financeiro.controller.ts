import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import type { Multer } from 'multer';
import { performance } from 'node:perf_hooks';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ExportServiceUnavailableException } from '../../common/export';
import { MAX_FINANCIAL_RECEIPT_SIZE } from '../../common/storage/image-upload';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { ConfirmFinancialTransactionDto } from './dto/confirm-financial-transaction.dto';
import { CreateFinancialAccountDto } from './dto/create-financial-account.dto';
import { CreateFinancialCategoryDto } from './dto/create-financial-category.dto';
import { CreateFinancialTransactionDto } from './dto/create-financial-transaction.dto';
import { CreateFinancialTransactionsBatchDto } from './dto/create-financial-transactions-batch.dto';
import { ExportFinanceiroDto } from './dto/export-financeiro.dto';
import { UpdateFinancialAccountDto } from './dto/update-financial-account.dto';
import { UpdateFinancialCategoryDto } from './dto/update-financial-category.dto';
import { UpdateFinancialTransactionDto } from './dto/update-financial-transaction.dto';
import { UpdateFinancePermissionDto } from './dto/update-finance-permission.dto';
import { FinanceiroDocumentRendererService } from './export/financeiro-document-renderer.service';
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
    private readonly documentRenderer: FinanceiroDocumentRendererService,
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
    @Query('eventoId') eventoId?: string,
    @Query('memberId') memberId?: string,
    @Query('recurringGroupId') recurringGroupId?: string,
    @Query('description') description?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transactionsService.findAll(user.tenantId!, user, {
      startDate,
      endDate,
      type,
      status,
      accountId,
      categoryId,
      eventoId,
      memberId,
      recurringGroupId,
      description,
      limit: limit !== undefined ? Number(limit) : undefined,
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

  @Get('exportacao')
  async exportPdf(
    @Query() query: ExportFinanceiroDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const rawIfNoneMatch = req.headers['if-none-match'];
    const ifNoneMatch = Array.isArray(rawIfNoneMatch)
      ? rawIfNoneMatch.join(', ')
      : rawIfNoneMatch;

    try {
      const queryStart = performance.now();
      const input = await this.transactionsService.prepareExportData(
        user.tenantId!,
        query,
        user,
      );
      const queryMs = Math.round(performance.now() - queryStart);
      const document = await this.documentRenderer.renderPdf(input, {
        ifNoneMatch,
        queryMs,
      });

      res.setHeader('X-Document-Page-Count', String(document.pageCount));
      if (document.etag) {
        res.setHeader('ETag', document.etag);
        res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
      }

      if (document.notModified) {
        return res.status(304).end();
      }

      res.setHeader('Content-Type', document.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${document.fileName}"`,
      );
      return res.send(document.buffer);
    } catch (error) {
      if (error instanceof ExportServiceUnavailableException) {
        res.setHeader('Retry-After', String(error.retryAfterSeconds));
      }
      throw error;
    }
  }

  @Post('transactions/batch')
  async createTransactionsBatch(
    @Body() dto: CreateFinancialTransactionsBatchDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.transactionsService.createBatch(
      user.tenantId!,
      user,
      dto,
      getClientIp(req),
    );
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

  @Patch('transactions/:id/confirm')
  async confirmTransaction(
    @Param('id') id: string,
    @Body() dto: ConfirmFinancialTransactionDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.transactionsService.confirm(
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
