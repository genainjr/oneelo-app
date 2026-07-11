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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Multer } from 'multer';
import { MembrosService } from './membros.service';
import { CreateMembroDto } from './dto/create-membro.dto';
import { UpdateMembroDto } from './dto/update-membro.dto';
import { FilterMembrosDto } from './dto/filter-membros.dto';
import { FilterMembrosVisualizacaoDto } from './dto/filter-membros-visualizacao.dto';
import { BulkTagMembrosDto } from './dto/bulk-tag-membros.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { MAX_IMAGE_SIZE } from '../../common/storage/image-upload';

@Controller('membros')
export class MembrosController {
  constructor(private readonly membrosService: MembrosService) {}

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  create(@Body() createMembroDto: CreateMembroDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.membrosService.create(tenantId, createMembroDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  findAll(@Query() query: FilterMembrosDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.membrosService.findAll(tenantId, query);
  }

  @Get('visualizacao')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  findVisualizacao(@Query() query: FilterMembrosVisualizacaoDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.membrosService.findVisualizacao(tenantId, query, user);
  }

  @Get('aniversariantes')
  @Roles(Role.ADMIN, Role.STAFF, Role.BASIC)
  findAniversariantes(@Query() query: FilterMembrosVisualizacaoDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.membrosService.findAniversariantes(tenantId, query, user);
  }

  @Post('bulk-tag')
  @Roles(Role.ADMIN, Role.STAFF)
  bulkTag(@Body() bulkTagMembrosDto: BulkTagMembrosDto, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.membrosService.bulkTag(tenantId, bulkTagMembrosDto);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  findOne(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.membrosService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  update(
    @Param('id') id: string,
    @Body() updateMembroDto: UpdateMembroDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.membrosService.update(tenantId, id, updateMembroDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  remove(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.membrosService.remove(tenantId, id);
  }

  @Post(':id/foto')
  @Roles(Role.ADMIN, Role.STAFF)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_IMAGE_SIZE,
      },
    }),
  )
  uploadFoto(
    @Param('id') id: string,
    @UploadedFile() file: Multer.File,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.membrosService.uploadMemberPhoto(tenantId, id, file);
  }

  @Delete(':id/foto')
  @Roles(Role.ADMIN, Role.STAFF)
  removeFoto(@Param('id') id: string, @Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.membrosService.removeMemberPhoto(tenantId, id);
  }
}
