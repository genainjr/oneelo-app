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
import { EventosService } from './eventos.service';
import { CreateEventoDto } from './dto/create-evento.dto';
import { UpdateEventoDto } from './dto/update-evento.dto';
import { FilterEventosDto } from './dto/filter-eventos.dto';
import { CreateEventosEmLoteDto } from './dto/create-eventos-em-lote.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtPayload } from '../../common/types/jwt-payload.interface';

@Controller('eventos')
export class EventosController {
  constructor(private readonly eventosService: EventosService) {}

  @Post()
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  create(@Body() createEventoDto: CreateEventoDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.eventosService.create(tenantId, createEventoDto, user);
  }

  @Post('lote')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  createBatch(
    @Body() dto: CreateEventosEmLoteDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.eventosService.createBatch(tenantId, dto, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  findAll(@Query() query: FilterEventosDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.eventosService.findAll(tenantId, query, user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  findOne(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.eventosService.findOne(tenantId, id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  update(
    @Param('id') id: string,
    @Body() updateEventoDto: UpdateEventoDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.eventosService.update(tenantId, id, updateEventoDto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  remove(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.eventosService.remove(tenantId, id, user);
  }
}
