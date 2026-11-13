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
  Ip,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Multer } from 'multer';
import type { Response, Request } from 'express';
import { MembrosService } from './membros.service';
import { MemberImportService } from './import/member-import.service';
import { buildMemberImportTemplateBuffer } from './import/member-template.builder';
import { CreateMembroDto } from './dto/create-membro.dto';
import { UpdateMembroDto } from './dto/update-membro.dto';
import { FilterMembrosDto } from './dto/filter-membros.dto';
import { FilterMembrosVisualizacaoDto } from './dto/filter-membros-visualizacao.dto';
import { BulkTagMembrosDto } from './dto/bulk-tag-membros.dto';
import { ConfirmImportDto } from './dto/import-membros.dto';
import { BulkDeleteMembrosDto } from './dto/bulk-delete-membros.dto';
import { PromoteVisitanteDto } from './dto/promote-visitante.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { MAX_IMAGE_SIZE } from '../../common/storage/image-upload';

@Controller('membros')
export class MembrosController {
  constructor(
    private readonly membrosService: MembrosService,
    private readonly memberImportService: MemberImportService,
  ) {}

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

  @Get('import/template')
  @Roles(Role.ADMIN, Role.STAFF)
  async downloadTemplate(@Res() res: Response) {
    const buffer = await buildMemberImportTemplateBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="modelo-importacao-membros-oneelo.xlsx"',
    );
    res.send(buffer);
  }

  @Post('import/preview')
  @Roles(Role.ADMIN, Role.STAFF)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async previewImport(
    @UploadedFile() file: Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Nenhum arquivo enviado para importação.');
    }
    const ext = file.originalname.toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.csv')) {
      throw new BadRequestException('Apenas arquivos .xlsx ou .csv são aceitos.');
    }
    if (!user.tenantId) {
      throw new BadRequestException('Tenant não encontrado para o usuário.');
    }
    return this.memberImportService.generatePreview(
      user.tenantId,
      file.buffer,
      file.originalname,
    );
  }

  @Post('import/confirm')
  @Roles(Role.ADMIN, Role.STAFF)
  async confirmImport(
    @Body() dto: ConfirmImportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Tenant não encontrado para o usuário.');
    }
    return this.memberImportService.confirmImport(
      user.tenantId,
      user.sub,
      dto,
    );
  }

    @Post('bulk-delete')
  @Roles(Role.ADMIN, Role.STAFF)
  async bulkDeletePost(
    @Body() dto: BulkDeleteMembrosDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.membrosService.bulkRemove(tenantId, dto.ids, user?.sub);
  }

  @Delete('bulk')
  @Roles(Role.ADMIN, Role.STAFF)
  async bulkDelete(
    @Body() dto: BulkDeleteMembrosDto,
    @Req() req: Request,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.membrosService.bulkRemove(tenantId, dto.ids, user?.sub);
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

  @Post(':id/promover')
  @Roles(Role.ADMIN, Role.STAFF)
  promover(
    @Param('id') id: string,
    @Body() dto: PromoteVisitanteDto,
    @Req() req: Request,
    @Ip() ip?: string,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.membrosService.promoteVisitante(
      tenantId,
      id,
      dto,
      user?.sub,
      ip,
    );
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
