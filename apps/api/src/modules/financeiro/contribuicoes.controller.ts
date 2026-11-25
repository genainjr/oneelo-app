import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import type { Multer } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserThrottlerGuard } from '../../common/guards/user-throttler.guard';
import { MAX_FINANCIAL_RECEIPT_SIZE } from '../../common/storage/image-upload';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { ContribuicoesService } from './contribuicoes.service';
import { CreateMemberContributionDto } from './dto/create-member-contribution.dto';

function getClientIp(req: Request): string | undefined {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0]?.trim();
  }
  return req.ip;
}

@Controller('minhas-contribuicoes')
export class ContribuicoesController {
  constructor(private readonly contribuicoesService: ContribuicoesService) {}

  @Get('pix')
  async getPixInfo(
    @CurrentUser() user: JwtPayload,
    @Query('amount') amount?: string,
  ) {
    return this.contribuicoesService.getMemberPixInfo(user.tenantId!, user, amount);
  }

  @Get()
  async listMyContributions(
    @CurrentUser() user: JwtPayload,
    @Query('year') year?: string,
  ) {
    return this.contribuicoesService.listMyContributions(user.tenantId!, user, year);
  }

  @Post()
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FINANCIAL_RECEIPT_SIZE },
    }),
  )
  async createMyContribution(
    @Body() dto: CreateMemberContributionDto,
    @UploadedFile() file: Multer.File,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.contribuicoesService.createMyContribution(
      user.tenantId!,
      user,
      dto,
      file,
      getClientIp(req),
    );
  }

  @Delete(':id')
  async deleteMyContribution(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.contribuicoesService.deleteMyPendingContribution(
      user.tenantId!,
      user,
      id,
      getClientIp(req),
    );
  }

  @Get(':id/receipt-url')
  async getMyReceiptUrl(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contribuicoesService.getMyReceiptSignedUrl(user.tenantId!, user, id);
  }
}
