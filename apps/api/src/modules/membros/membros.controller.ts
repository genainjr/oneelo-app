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
import { MembrosService } from './membros.service';
import { CreateMembroDto } from './dto/create-membro.dto';
import { UpdateMembroDto } from './dto/update-membro.dto';
import { FilterMembrosDto } from './dto/filter-membros.dto';
import { BulkTagMembrosDto } from './dto/bulk-tag-membros.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express';

@Controller('membros')
@Roles(Role.ADMIN, Role.STAFF)
export class MembrosController {
  constructor(private readonly membrosService: MembrosService) {}

  @Post()
  create(@Body() createMembroDto: CreateMembroDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.membrosService.create(tenantId, createMembroDto);
  }

  @Get()
  findAll(@Query() query: FilterMembrosDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.membrosService.findAll(tenantId, query);
  }

  @Post('bulk-tag')
  bulkTag(@Body() bulkTagMembrosDto: BulkTagMembrosDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.membrosService.bulkTag(tenantId, bulkTagMembrosDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.membrosService.findOne(tenantId, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateMembroDto: UpdateMembroDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.membrosService.update(tenantId, id, updateMembroDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.membrosService.remove(tenantId, id);
  }
}
