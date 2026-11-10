import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { DocumentJobsService } from './document-jobs.service';
import { CreateDocumentJobDto } from './dto/create-document-job.dto';
import { FilterDocumentJobsDto } from './dto/filter-document-jobs.dto';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('documents')
export class DocumentsController {
  private readonly documentsBucket = 'tenant-documents';

  constructor(
    private readonly jobsService: DocumentJobsService,
    private readonly storageService: SupabaseStorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('validar/carteirinha/:id')
  async validateCarteirinha(@Param('id') memberId: string) {
    const member = await this.prisma.client.membro.findFirst({
      where: { id: memberId, deletedAt: null },
      include: {
        tenant: {
          select: { id: true, nome: true, logoUrl: true, slug: true, ativo: true },
        },
      },
    });

    if (!member || !member.tenant?.ativo) {
      throw new NotFoundException('Carteirinha não encontrada ou inativa.');
    }

    return {
      valido: true,
      membro: {
        id: member.id,
        nome: member.nome,
        nomeExibicao: member.nomeExibicao,
        fotoUrl: member.fotoUrl,
        cargo: member.cargo || 'Membro',
        matricula: member.matricula,
        status: member.status,
        dataBatismo: member.dataBatismo,
        membroDesde: member.createdAt,
      },
      igreja: {
        nome: member.tenant.nome,
        logoUrl: member.tenant.logoUrl,
      },
    };
  }

  @Post('jobs')
  async createJob(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDocumentJobDto,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Usuário sem tenant associado.');
    }

    const job = await this.jobsService.createJob(user.tenantId, user.sub, dto);

    // Se o job já estiver concluído (reaproveitado de cache sem alteração), anexa a URL assinada imediatamente
    let downloadUrl: string | null = null;
    if (job.status === 'COMPLETED' && job.storageKey) {
      downloadUrl = await this.storageService.createSignedUrl(
        this.documentsBucket,
        job.storageKey,
        3600,
      );
    }

    return {
      ...job,
      downloadUrl,
    };
  }

  @Get('jobs/:id')
  async getJob(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Usuário sem tenant associado.');
    }

    const job = await this.jobsService.getJobById(user.tenantId, id);

    // Se o job estiver concluído, anexa a URL assinada para conveniência
    let downloadUrl: string | null = null;
    if (job.status === 'COMPLETED' && job.storageKey) {
      downloadUrl = await this.storageService.createSignedUrl(
        this.documentsBucket,
        job.storageKey,
        3600,
      );
    }

    return {
      ...job,
      downloadUrl,
    };
  }

  @Get('history')
  async listHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: FilterDocumentJobsDto,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Usuário sem tenant associado.');
    }

    return this.jobsService.listJobs(user.tenantId, query);
  }

  @Get([':id/download', 'jobs/:id/download'])
  async getDownloadUrl(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Usuário sem tenant associado.');
    }

    const job = await this.jobsService.getJobById(user.tenantId, id);
    if (job.status !== 'COMPLETED' || !job.storageKey) {
      throw new BadRequestException('Documento ainda não está concluído ou falhou.');
    }

    const downloadUrl = await this.storageService.createSignedUrl(
      this.documentsBucket,
      job.storageKey,
      3600,
    );

    return {
      downloadUrl,
      fileName: job.fileName,
      fileSize: job.fileSize,
      tipoDocumento: job.tipoDocumento,
      formato: job.formato,
    };
  }

  @Post([':id/retry', 'jobs/:id/retry'])
  @Roles(Role.ADMIN, Role.STAFF)
  async retryJob(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Usuário sem tenant associado.');
    }

    return this.jobsService.retryJob(user.tenantId, id);
  }
}
