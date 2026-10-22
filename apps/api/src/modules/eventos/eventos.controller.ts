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
  Res,
} from '@nestjs/common';
import { EventosService } from './eventos.service';
import { CreateEventoDto } from './dto/create-evento.dto';
import { UpdateEventoDto } from './dto/update-evento.dto';
import { FilterEventosDto } from './dto/filter-eventos.dto';
import { CreateEventosEmLoteDto } from './dto/create-eventos-em-lote.dto';
import { ExportEventoDto } from './dto/export-evento.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { ExportServiceUnavailableException } from '../../common/export';

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

  @Get('exportacao')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  async exportar(
    @Query() query: ExportEventoDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    const rawIfNoneMatch = req.headers['if-none-match'];
    const ifNoneMatch = Array.isArray(rawIfNoneMatch)
      ? rawIfNoneMatch.join(', ')
      : rawIfNoneMatch;

    try {
      const document = await this.eventosService.exportar(
        tenantId,
        query,
        user,
        ifNoneMatch,
      );

      res.setHeader('X-Document-Page-Count', String(document.pageCount));
      if (document.etag) {
        res.setHeader('ETag', document.etag);
        res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
      }

      if (document.notModified) {
        return res.status(304).end();
      }

      if (document.kind === 'batch') {
        return res.json({
          files: document.files,
          pageCount: document.pageCount,
        });
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
