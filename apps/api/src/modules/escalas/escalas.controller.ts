import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
} from '@nestjs/common';
import { EscalasService } from './escalas.service';
import { CreateEscalaDto } from './dto/create-escala.dto';
import { UpdateEscalaDto } from './dto/update-escala.dto';
import { FilterEscalaDto } from './dto/filter-escala.dto';
import { FilterEscalaVisualizacaoDto } from './dto/filter-escala-visualizacao.dto';
import { ManageEscalaItemDto } from './dto/manage-escala-item.dto';
import { ConfirmarEscalaItemDto } from './dto/confirmar-escala-item.dto';
import { ReorderDiasDto } from './dto/reorder-dias.dto';
import { ToggleDiaFuncaoOcultaDto } from './dto/toggle-dia-funcao-oculta.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtPayload } from '../../common/types/jwt-payload.interface';

@Controller('escalas')
export class EscalasController {
  constructor(private readonly escalasService: EscalasService) {}

  @Post()
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  create(@Body() createEscalaDto: CreateEscalaDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.create(tenantId, createEscalaDto, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  findAll(@Query() query: FilterEscalaDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.findAll(tenantId, query, user);
  }

  @Get('visualizacao')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  findVisualizacao(@Query() query: FilterEscalaVisualizacaoDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.findVisualizacao(tenantId, query, user);
  }

  @Get('minhas')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  findMinhas(@Query() query: FilterEscalaVisualizacaoDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.findMinhas(tenantId, query, user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  findOne(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.findOne(tenantId, id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  update(
    @Param('id') id: string,
    @Body() updateEscalaDto: UpdateEscalaDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.update(tenantId, id, updateEscalaDto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  remove(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.remove(tenantId, id, user);
  }

  // ─── Gestão de Dias ─────────────────────────────

  @Patch(':id/dias/order')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  reorderDias(
    @Param('id') id: string,
    @Body() dto: ReorderDiasDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.reorderDias(tenantId, id, dto, user);
  }

  @Post(':id/dias')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  addDia(
    @Param('id') id: string,
    @Body() body: { data: string; titulo?: string },
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.addDia(tenantId, id, body, user);
  }

  @Delete('dias/:diaId')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  removeDia(
    @Param('diaId') diaId: string,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.removeDia(tenantId, diaId, user);
  }

  // ─── Gestão de Itens da Escala ─────────────────────────────

  @Post('dias/:diaId/itens')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  addMembro(
    @Param('diaId') diaId: string,
    @Body() manageEscalaItemDto: ManageEscalaItemDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    manageEscalaItemDto.escalaDiaId = diaId;
    return this.escalasService.addMembro(tenantId, diaId, manageEscalaItemDto, user);
  }

  @Delete('itens/:itemId')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  removeMembro(
    @Param('itemId') itemId: string,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.removeMembro(tenantId, itemId, user);
  }

  // ─── Visibilidade de Célula (Dia × Função) ──────────────────

  @Patch('dias/:diaId/funcoes-ocultas')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  toggleDiaFuncaoOculta(
    @Param('diaId') diaId: string,
    @Body() dto: ToggleDiaFuncaoOcultaDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.toggleDiaFuncaoOculta(tenantId, diaId, dto, user);
  }

  // ─── Confirmação de Presença pelo Membro ─────────────────────

  @Patch('itens/:itemId/confirmar')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  confirmar(
    @Param('itemId') itemId: string,
    @Body() confirmarEscalaItemDto: ConfirmarEscalaItemDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.confirmar(tenantId, itemId, confirmarEscalaItemDto, user);
  }

  // ─── Alteração Direta do Status pelo Administrador/Líder ───

  @Patch('itens/:itemId/status')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  updateItemStatus(
    @Param('itemId') itemId: string,
    @Body() confirmarEscalaItemDto: ConfirmarEscalaItemDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.updateItemStatus(
      tenantId,
      itemId,
      confirmarEscalaItemDto,
      user,
    );
  }
}
