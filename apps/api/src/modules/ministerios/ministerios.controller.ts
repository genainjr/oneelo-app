import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { MinisteriosService } from './ministerios.service';
import { CreateMinisterioDto } from './dto/create-ministerio.dto';
import { UpdateMinisterioDto } from './dto/update-ministerio.dto';
import {
  AddMembroMinisterioDto,
  AddLiderMinisterioDto,
} from './dto/manage-ministerio.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtPayload } from '../../common/types/jwt-payload.interface';

@Controller('ministerios')
export class MinisteriosController {
  constructor(private readonly ministeriosService: MinisteriosService) {}

  @Post()
  @Roles(Role.ADMIN_GERAL, Role.PASTOR)
  create(@Body() createMinisterioDto: CreateMinisterioDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.ministeriosService.create(tenantId, createMinisterioDto);
  }

  @Get()
  @Roles(Role.ADMIN_GERAL, Role.PASTOR, Role.SECRETARIO, Role.LIDER_MINISTERIO)
  findAll(@Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.ministeriosService.findAll(tenantId, user);
  }

  @Get(':id')
  @Roles(Role.ADMIN_GERAL, Role.PASTOR, Role.SECRETARIO, Role.LIDER_MINISTERIO)
  findOne(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.ministeriosService.findOne(tenantId, id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN_GERAL, Role.PASTOR)
  update(
    @Param('id') id: string,
    @Body() updateMinisterioDto: UpdateMinisterioDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.ministeriosService.update(tenantId, id, updateMinisterioDto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN_GERAL, Role.PASTOR)
  remove(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.ministeriosService.remove(tenantId, id, user);
  }

  // ─── Membros do ministério ────────────────────────────────
  @Post(':id/membros')
  @Roles(Role.ADMIN_GERAL, Role.PASTOR, Role.LIDER_MINISTERIO)
  addMembro(
    @Param('id') ministerioId: string,
    @Body() dto: AddMembroMinisterioDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.ministeriosService.addMembro(tenantId, ministerioId, dto.membroId);
  }

  @Delete(':id/membros/:membroId')
  @Roles(Role.ADMIN_GERAL, Role.PASTOR, Role.LIDER_MINISTERIO)
  removeMembro(
    @Param('id') ministerioId: string,
    @Param('membroId') membroId: string,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.ministeriosService.removeMembro(tenantId, ministerioId, membroId);
  }

  // ─── Líderes do ministério ────────────────────────────────
  @Post(':id/lideres')
  @Roles(Role.ADMIN_GERAL, Role.PASTOR)
  addLider(
    @Param('id') ministerioId: string,
    @Body() dto: AddLiderMinisterioDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.ministeriosService.addLider(tenantId, ministerioId, dto.userId);
  }

  @Delete(':id/lideres/:userId')
  @Roles(Role.ADMIN_GERAL, Role.PASTOR)
  removeLider(
    @Param('id') ministerioId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.ministeriosService.removeLider(tenantId, ministerioId, userId);
  }
}
