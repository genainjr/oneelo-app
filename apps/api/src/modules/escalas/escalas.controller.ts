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
import { ManageEscalaItemDto } from './dto/manage-escala-item.dto';
import { ConfirmarEscalaItemDto } from './dto/confirmar-escala-item.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtPayload } from '../../common/types/jwt-payload.interface';

@Controller('escalas')
export class EscalasController {
  constructor(private readonly escalasService: EscalasService) {}

  @Post()
  @Roles(Role.ADMIN_GERAL, Role.PASTOR, Role.LIDER_MINISTERIO)
  create(@Body() createEscalaDto: CreateEscalaDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.create(tenantId, createEscalaDto, user);
  }

  @Get()
  @Roles(
    Role.ADMIN_GERAL,
    Role.PASTOR,
    Role.SECRETARIO,
    Role.LIDER_MINISTERIO,
    Role.MEMBRO,
  )
  findAll(@Query() query: FilterEscalaDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.findAll(tenantId, query, user);
  }

  @Get(':id')
  @Roles(
    Role.ADMIN_GERAL,
    Role.PASTOR,
    Role.SECRETARIO,
    Role.LIDER_MINISTERIO,
    Role.MEMBRO,
  )
  findOne(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.findOne(tenantId, id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN_GERAL, Role.PASTOR, Role.LIDER_MINISTERIO)
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
  @Roles(Role.ADMIN_GERAL, Role.PASTOR, Role.LIDER_MINISTERIO)
  remove(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.remove(tenantId, id, user);
  }

  // ─── Gestão de Itens da Escala ─────────────────────────────

  @Post(':id/itens')
  @Roles(Role.ADMIN_GERAL, Role.PASTOR, Role.LIDER_MINISTERIO)
  addMembro(
    @Param('id') id: string,
    @Body() manageEscalaItemDto: ManageEscalaItemDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.addMembro(tenantId, id, manageEscalaItemDto, user);
  }

  @Delete(':id/itens/:membroId')
  @Roles(Role.ADMIN_GERAL, Role.PASTOR, Role.LIDER_MINISTERIO)
  removeMembro(
    @Param('id') id: string,
    @Param('membroId') membroId: string,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.removeMembro(tenantId, id, membroId, user);
  }

  // ─── Confirmação de Presença pelo Membro ─────────────────────

  @Patch(':id/confirmar')
  @Roles(
    Role.ADMIN_GERAL,
    Role.PASTOR,
    Role.SECRETARIO,
    Role.LIDER_MINISTERIO,
    Role.MEMBRO,
  )
  confirmar(
    @Param('id') id: string,
    @Body() confirmarEscalaItemDto: ConfirmarEscalaItemDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.confirmar(tenantId, id, confirmarEscalaItemDto, user);
  }

  // ─── Alteração Direta do Status pelo Administrador/Líder/Secretário ───

  @Patch(':id/itens/:membroId/status')
  @Roles(Role.ADMIN_GERAL, Role.PASTOR, Role.SECRETARIO, Role.LIDER_MINISTERIO)
  updateItemStatus(
    @Param('id') id: string,
    @Param('membroId') membroId: string,
    @Body() confirmarEscalaItemDto: ConfirmarEscalaItemDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.escalasService.updateItemStatus(
      tenantId,
      id,
      membroId,
      confirmarEscalaItemDto,
      user,
    );
  }
}
