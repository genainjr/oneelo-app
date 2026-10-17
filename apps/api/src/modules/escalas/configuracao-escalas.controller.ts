import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ConfiguracaoEscalasService } from './configuracao-escalas.service';
import { CreateSegmentoDto } from './dto/create-segmento.dto';
import { UpdateSegmentoDto } from './dto/update-segmento.dto';
import { ReorderSegmentosDto } from './dto/reorder-segmentos.dto';
import { UpdateFuncaoConfiguracaoDto } from './dto/update-funcao-configuracao.dto';
import { UpsertCompatibilidadeDto } from './dto/upsert-compatibilidade.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express';

@Controller('escalas/configuracao')
@Roles(Role.ADMIN, Role.STAFF)
export class ConfiguracaoEscalasController {
  constructor(
    private readonly configuracaoService: ConfiguracaoEscalasService,
  ) {}

  // ─── Segmentos do Culto ─────────────────────────────────────────

  @Get('segmentos')
  listSegmentos(@Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.configuracaoService.listSegmentos(tenantId);
  }

  @Post('segmentos')
  createSegmento(@Body() dto: CreateSegmentoDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.configuracaoService.createSegmento(tenantId, dto);
  }

  @Post('segmentos/template-padrao')
  loadTemplatePadrao(@Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.configuracaoService.loadTemplatePadrao(tenantId);
  }

  @Patch('segmentos/ordem')
  reorderSegmentos(@Body() dto: ReorderSegmentosDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.configuracaoService.reorderSegmentos(tenantId, dto);
  }

  @Patch('segmentos/:id')
  updateSegmento(
    @Param('id') id: string,
    @Body() dto: UpdateSegmentoDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.configuracaoService.updateSegmento(tenantId, id, dto);
  }

  @Delete('segmentos/:id')
  deleteSegmento(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.configuracaoService.deleteSegmento(tenantId, id);
  }

  // ─── Funções (Segmentos e Locais de Atuação) ─────────────────────

  @Get('funcoes')
  listFuncoes(
    @Query('ministerioId') ministerioId: string | undefined,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.configuracaoService.listFuncoes(tenantId, ministerioId);
  }

  @Put('funcoes/:id')
  updateFuncaoConfiguracao(
    @Param('id') id: string,
    @Body() dto: UpdateFuncaoConfiguracaoDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.configuracaoService.updateFuncaoConfiguracao(tenantId, id, dto);
  }

  // ─── Matriz de Compatibilidade ──────────────────────────────────

  @Get('compatibilidade')
  listCompatibilidades(@Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.configuracaoService.listCompatibilidades(tenantId);
  }

  @Put('compatibilidade')
  upsertCompatibilidade(
    @Body() dto: UpsertCompatibilidadeDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.configuracaoService.upsertCompatibilidade(tenantId, dto);
  }

  @Delete('compatibilidade/:id')
  deleteCompatibilidade(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.configuracaoService.deleteCompatibilidade(tenantId, id);
  }
}
