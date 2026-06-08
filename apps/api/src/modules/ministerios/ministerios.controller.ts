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
import { AddMembroMinisterioDto, UpdateMembroRoleDto } from './dto/manage-ministerio.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtPayload } from '../../common/types/jwt-payload.interface';

@Controller('ministerios')
export class MinisteriosController {
  constructor(private readonly ministeriosService: MinisteriosService) {}

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  create(@Body() createMinisterioDto: CreateMinisterioDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.ministeriosService.create(tenantId, createMinisterioDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  findAll(@Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.ministeriosService.findAll(tenantId, user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  findOne(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.ministeriosService.findOne(tenantId, id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF)
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
  @Roles(Role.ADMIN, Role.STAFF)
  remove(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.ministeriosService.remove(tenantId, id, user);
  }

  // ─── Membros do ministério ────────────────────────────────
  @Post(':id/membros')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  addMembro(
    @Param('id') ministerioId: string,
    @Body() dto: AddMembroMinisterioDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.ministeriosService.addMembro(tenantId, ministerioId, dto.membroId, dto.role, dto.funcaoIds);
  }

  @Patch(':id/membros/:membroId')
  @Roles(Role.ADMIN, Role.STAFF)
  updateMembroRole(
    @Param('id') ministerioId: string,
    @Param('membroId') membroId: string,
    @Body() dto: UpdateMembroRoleDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.ministeriosService.updateMembroRole(tenantId, ministerioId, membroId, dto.role, dto.funcaoIds, user);
  }

  @Delete(':id/membros/:membroId')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  removeMembro(
    @Param('id') ministerioId: string,
    @Param('membroId') membroId: string,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.ministeriosService.removeMembro(tenantId, ministerioId, membroId, user);
  }
}
