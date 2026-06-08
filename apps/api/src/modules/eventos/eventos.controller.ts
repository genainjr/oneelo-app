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
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express';

@Controller('eventos')
export class EventosController {
  constructor(private readonly eventosService: EventosService) {}

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  create(@Body() createEventoDto: CreateEventoDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.eventosService.create(tenantId, createEventoDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  findAll(@Query() query: FilterEventosDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.eventosService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  findOne(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.eventosService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  update(
    @Param('id') id: string,
    @Body() updateEventoDto: UpdateEventoDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.eventosService.update(tenantId, id, updateEventoDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  remove(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.eventosService.remove(tenantId, id);
  }
}
