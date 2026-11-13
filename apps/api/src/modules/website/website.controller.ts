import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { memoryStorage, type Multer } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MAX_IMAGE_SIZE } from '../../common/storage/image-upload';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { getClientIp } from '../../common/utils/request-ip';
import { CreateChurchScheduleDto } from './dto/create-church-schedule.dto';
import { CreateTenantNewsDto } from './dto/create-tenant-news.dto';
import { ReorderSchedulesDto } from './dto/reorder-schedules.dto';
import { UpdateChurchScheduleDto } from './dto/update-church-schedule.dto';
import { UpdateTenantNewsDto } from './dto/update-tenant-news.dto';
import { UpdateWebsiteConfigDto } from './dto/update-website-config.dto';
import { UpdateCustomDomainDto } from './dto/update-custom-domain.dto';
import { WebsiteService } from './website.service';

@ApiTags('CMS Site da Igreja')
@Controller('site')
@Roles(Role.ADMIN, Role.STAFF)
export class WebsiteController {
  constructor(private readonly websiteService: WebsiteService) {}

  @Get('config')
  @ApiOperation({
    summary: 'Retorna a configuração institucional do site do tenant',
  })
  async getConfig(@CurrentUser() user: JwtPayload) {
    return this.websiteService.getConfig(user.tenantId!);
  }

  @Put('config')
  @ApiOperation({
    summary: 'Atualiza a configuração institucional do site do tenant',
  })
  async updateConfig(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateWebsiteConfigDto,
    @Req() req: Request,
  ) {
    return this.websiteService.updateConfig(
      user.tenantId!,
      dto,
      user.sub,
      getClientIp(req),
    );
  }

  @Post('banner')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE },
    }),
  )
  @ApiOperation({ summary: 'Faz upload do banner principal do site' })
  async uploadBanner(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Multer.File,
    @Req() req: Request,
  ) {
    return this.websiteService.uploadConfigMedia(
      user.tenantId!,
      'banner',
      file,
      user.sub,
      getClientIp(req),
    );
  }

  @Delete('banner')
  @ApiOperation({ summary: 'Remove o banner principal do site' })
  async removeBanner(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.websiteService.removeConfigMedia(
      user.tenantId!,
      'banner',
      user.sub,
      getClientIp(req),
    );
  }

  @Post('pastores-foto')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE },
    }),
  )
  @ApiOperation({ summary: 'Faz upload da foto dos pastores presidentes' })
  async uploadPastorsPhoto(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Multer.File,
    @Req() req: Request,
  ) {
    return this.websiteService.uploadConfigMedia(
      user.tenantId!,
      'pastors',
      file,
      user.sub,
      getClientIp(req),
    );
  }

  @Delete('pastores-foto')
  @ApiOperation({ summary: 'Remove a foto dos pastores presidentes' })
  async removePastorsPhoto(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.websiteService.removeConfigMedia(
      user.tenantId!,
      'pastors',
      user.sub,
      getClientIp(req),
    );
  }

  @Get('cultos')
  @ApiOperation({
    summary: 'Lista horários de cultos regulares configurados no site',
  })
  async listSchedules(@CurrentUser() user: JwtPayload) {
    return this.websiteService.listSchedules(user.tenantId!);
  }

  @Post('cultos')
  @ApiOperation({ summary: 'Cadastra um novo horário de culto regular' })
  async createSchedule(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateChurchScheduleDto,
    @Req() req: Request,
  ) {
    return this.websiteService.createSchedule(
      user.tenantId!,
      dto,
      user.sub,
      getClientIp(req),
    );
  }

  @Put('cultos/:id')
  @ApiOperation({ summary: 'Atualiza um horário de culto regular' })
  async updateSchedule(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateChurchScheduleDto,
    @Req() req: Request,
  ) {
    return this.websiteService.updateSchedule(
      user.tenantId!,
      id,
      dto,
      user.sub,
      getClientIp(req),
    );
  }

  @Delete('cultos/:id')
  @ApiOperation({ summary: 'Exclui um horário de culto regular' })
  async deleteSchedule(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.websiteService.deleteSchedule(
      user.tenantId!,
      id,
      user.sub,
      getClientIp(req),
    );
  }

  @Patch('cultos/reordenar')
  @ApiOperation({ summary: 'Reordena os horários de cultos regulares' })
  async reorderSchedules(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReorderSchedulesDto,
    @Req() req: Request,
  ) {
    return this.websiteService.reorderSchedules(
      user.tenantId!,
      dto,
      user.sub,
      getClientIp(req),
    );
  }

  @Get('noticias')
  @ApiOperation({
    summary: 'Lista os informativos e notícias cadastrados no site',
  })
  async listNews(@CurrentUser() user: JwtPayload) {
    return this.websiteService.listNews(user.tenantId!);
  }

  @Post('noticias')
  @ApiOperation({ summary: 'Cria um informativo/notícia para o site' })
  async createNews(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTenantNewsDto,
    @Req() req: Request,
  ) {
    return this.websiteService.createNews(
      user.tenantId!,
      dto,
      user.sub,
      getClientIp(req),
    );
  }

  @Put('noticias/:id')
  @ApiOperation({ summary: 'Atualiza um informativo/notícia do site' })
  async updateNews(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTenantNewsDto,
    @Req() req: Request,
  ) {
    return this.websiteService.updateNews(
      user.tenantId!,
      id,
      dto,
      user.sub,
      getClientIp(req),
    );
  }

  @Delete('noticias/:id')
  @ApiOperation({ summary: 'Remove um informativo/notícia do site' })
  async deleteNews(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.websiteService.deleteNews(
      user.tenantId!,
      id,
      user.sub,
      getClientIp(req),
    );
  }

  @Post('noticias/:id/imagem')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE },
    }),
  )
  @ApiOperation({ summary: 'Faz upload da imagem de capa de um informativo' })
  async uploadNewsImage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: Multer.File,
    @Req() req: Request,
  ) {
    return this.websiteService.uploadNewsImage(
      user.tenantId!,
      id,
      file,
      user.sub,
      getClientIp(req),
    );
  }

  @Delete('noticias/:id/imagem')
  @ApiOperation({ summary: 'Remove a imagem de capa de um informativo' })
  async removeNewsImage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.websiteService.removeNewsImage(
      user.tenantId!,
      id,
      user.sub,
      getClientIp(req),
    );
  }

  @Put('custom-domain')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Configura e registra o domínio próprio da igreja na Vercel (ADMIN)',
  })
  async setCustomDomain(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCustomDomainDto,
    @Req() req: Request,
  ) {
    return this.websiteService.setCustomDomain(
      user.tenantId!,
      dto.customDomain,
      user.sub,
      getClientIp(req),
    );
  }

  @Post('custom-domain/verify')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Verifica apontamento DNS e status SSL do domínio próprio (ADMIN)',
  })
  async verifyCustomDomain(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.websiteService.verifyCustomDomain(
      user.tenantId!,
      user.sub,
      getClientIp(req),
    );
  }

  @Delete('custom-domain')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Remove o domínio próprio da igreja e da Vercel (ADMIN)',
  })
  async removeCustomDomain(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.websiteService.removeCustomDomain(
      user.tenantId!,
      user.sub,
      getClientIp(req),
    );
  }
}
