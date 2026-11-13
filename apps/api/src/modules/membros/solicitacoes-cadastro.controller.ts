import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, StatusSolicitacaoCadastro } from '@prisma/client';
import { SolicitacoesCadastroService } from './solicitacoes-cadastro.service';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';

export class AprovarSolicitacaoDto {
  @IsOptional()
  @IsString()
  vincularMembroId?: string;
}

export class RejeitarSolicitacaoDto {
  @IsOptional()
  @IsString()
  motivo?: string;
}

@Controller('membros/solicitacoes')
export class SolicitacoesCadastroController {
  constructor(
    private readonly solicitacoesService: SolicitacoesCadastroService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  async list(
    @Req() req: Request,
    @Query('status') status?: StatusSolicitacaoCadastro,
  ) {
    const tenantId = req['tenantId'] as string;
    return this.solicitacoesService.listSolicitacoes(tenantId, status);
  }

  @Get('count')
  @Roles(Role.ADMIN, Role.STAFF)
  async count(@Req() req: Request) {
    const tenantId = req['tenantId'] as string;
    return this.solicitacoesService.countPendentes(tenantId);
  }

  @Post(':id/aprovar')
  @Roles(Role.ADMIN, Role.STAFF)
  async aprovar(
    @Param('id') id: string,
    @Body() body: AprovarSolicitacaoDto,
    @Req() req: Request,
    @Ip() ip?: string,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.solicitacoesService.aprovarSolicitacao(
      tenantId,
      id,
      user.sub,
      body,
      ip,
    );
  }

  @Post(':id/rejeitar')
  @Roles(Role.ADMIN, Role.STAFF)
  async rejeitar(
    @Param('id') id: string,
    @Body() body: RejeitarSolicitacaoDto,
    @Req() req: Request,
    @Ip() ip?: string,
  ) {
    const tenantId = req['tenantId'] as string;
    const user = req['user'] as JwtPayload;
    return this.solicitacoesService.rejeitarSolicitacao(
      tenantId,
      id,
      user.sub,
      body?.motivo,
      ip,
    );
  }
}
