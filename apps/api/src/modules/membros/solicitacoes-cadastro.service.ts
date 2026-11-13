import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthService } from '../auth/auth.service';
import { SubmitMemberRegistrationDto } from './dto/submit-member-registration.dto';
import {
  normalizeCpf,
  normalizeEmail,
  normalizePhone,
  extractPhoneDigits,
  checkMemberDuplicity,
  DuplicityCheckResult,
} from './member-deduplication.helper';
import {
  AcaoAuditoria,
  Role,
  StatusMembro,
  StatusSolicitacaoCadastro,
  TipoSolicitacaoCadastro,
} from '@prisma/client';
import { canAddMember } from '../../common/utils/tenant-plan';

export interface SolicitacaoComDuplicidade {
  id: string;
  tenantId: string;
  tipo: TipoSolicitacaoCadastro;
  status: StatusSolicitacaoCadastro;
  nome: string;
  telefone: string;
  cpf: string | null;
  email: string | null;
  dataNascimento: Date | null;
  sexo: string | null;
  estadoCivil: string | null;
  batizadoAguas: boolean | null;
  igrejaAnterior: string | null;
  quemConvidou: string | null;
  observacoes: string | null;
  consentimentoEm: Date;
  ipAddress: string | null;
  membroId: string | null;
  userId: string | null;
  rejectionReason: string | null;
  processedAt: Date | null;
  processedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  duplicidade: DuplicityCheckResult;
}

@Injectable()
export class SolicitacoesCadastroService {
  private readonly logger = new Logger(SolicitacoesCadastroService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  /**
   * Retorna os dados públicos da igreja pelo slug para personalização da página de boas-vindas
   */
  async getPublicTenantInfo(slug: string) {
    const cleanSlug = slug.trim().toLowerCase();
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: cleanSlug },
      select: {
        id: true,
        nome: true,
        slug: true,
        logoUrl: true,
        pwaIconUrl: true,
        ativo: true,
      },
    });

    if (!tenant || !tenant.ativo) {
      throw new NotFoundException(
        'Igreja não encontrada ou temporariamente indisponível.',
      );
    }

    return {
      nome: tenant.nome,
      slug: tenant.slug,
      logoUrl: tenant.logoUrl || tenant.pwaIconUrl || null,
      pwaIconUrl: tenant.pwaIconUrl || null,
    };
  }

  /**
   * Recebe e armazena uma submissão pública de visitante ou membro
   */
  async submitRegistration(
    slug: string,
    dto: SubmitMemberRegistrationDto,
    ip?: string,
  ) {
    // 1. Verificação de Honeypot: Se preenchido, descarta silenciosamente sem dar pista ao bot
    if (dto.website && dto.website.trim().length > 0) {
      this.logger.warn(
        `Honeypot acionado para slug "${slug}" pelo IP ${ip || 'desconhecido'}.`,
      );
      return {
        success: true,
        message:
          'Ficha enviada com sucesso! Em breve a liderança entrará em contato.',
      };
    }

    // 2. Busca e validação do tenant
    const cleanSlug = slug.trim().toLowerCase();
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: cleanSlug },
      select: { id: true, nome: true, ativo: true },
    });

    if (!tenant || !tenant.ativo) {
      throw new NotFoundException('Igreja não encontrada ou inativa.');
    }

    // 3. Validação de LGPD
    if (!dto.consentimentoLgpd) {
      throw new BadRequestException(
        'É obrigatório consentir com o tratamento dos dados pessoais.',
      );
    }

    // 4. Validação de e-mail obrigatório para MEMBRO
    if (
      dto.tipo === TipoSolicitacaoCadastro.MEMBRO &&
      (!dto.email || !dto.email.trim())
    ) {
      throw new BadRequestException(
        'E-mail é obrigatório para cadastro de membro.',
      );
    }

    // 5. Normalização de dados
    const phoneNorm = normalizePhone(dto.telefone);
    if (!phoneNorm.phone) {
      throw new BadRequestException('Número de WhatsApp / celular inválido.');
    }

    let cpfNorm: string | undefined;
    if (dto.cpf && dto.cpf.trim()) {
      const parsedCpf = normalizeCpf(dto.cpf);
      if (parsedCpf.erro) {
        throw new BadRequestException(parsedCpf.erro);
      }
      cpfNorm = parsedCpf.cpf;
    }

    const emailNorm = dto.email ? normalizeEmail(dto.email) : undefined;
    const dataNascimento = dto.dataNascimento
      ? new Date(dto.dataNascimento)
      : undefined;
    const phoneDigits = extractPhoneDigits(phoneNorm.phone);

    // 6. Idempotência por telefone pendente no mesmo tenant
    const pendingRequests =
      await this.prisma.solicitacaoCadastroMembro.findMany({
        where: {
          tenantId: tenant.id,
          status: 'PENDENTE',
        },
      });

    const existingPending = pendingRequests.find(
      (r) => extractPhoneDigits(r.telefone) === phoneDigits,
    );

    let recordId: string;

    if (existingPending) {
      const updated = await this.prisma.solicitacaoCadastroMembro.update({
        where: { id: existingPending.id },
        data: {
          tipo: dto.tipo,
          nome: dto.nome.trim(),
          telefone: phoneNorm.phone,
          cpf: cpfNorm ?? existingPending.cpf,
          email: emailNorm ?? existingPending.email,
          dataNascimento: dataNascimento ?? existingPending.dataNascimento,
          sexo: dto.sexo ?? existingPending.sexo,
          estadoCivil: dto.estadoCivil ?? existingPending.estadoCivil,
          batizadoAguas: dto.batizadoAguas ?? existingPending.batizadoAguas,
          igrejaAnterior:
            dto.igrejaAnterior?.trim() ?? existingPending.igrejaAnterior,
          quemConvidou:
            dto.quemConvidou?.trim() ?? existingPending.quemConvidou,
          observacoes: dto.observacoes?.trim() ?? existingPending.observacoes,
          consentimentoEm: new Date(),
          ipAddress: ip ?? existingPending.ipAddress,
        },
      });
      recordId = updated.id;
    } else {
      const created = await this.prisma.solicitacaoCadastroMembro.create({
        data: {
          tenantId: tenant.id,
          tipo: dto.tipo,
          status: 'PENDENTE',
          nome: dto.nome.trim(),
          telefone: phoneNorm.phone,
          cpf: cpfNorm,
          email: emailNorm,
          dataNascimento,
          sexo: dto.sexo,
          estadoCivil: dto.estadoCivil,
          batizadoAguas: dto.batizadoAguas,
          igrejaAnterior: dto.igrejaAnterior?.trim(),
          quemConvidou: dto.quemConvidou?.trim(),
          observacoes: dto.observacoes?.trim(),
          consentimentoEm: new Date(),
          ipAddress: ip,
        },
      });
      recordId = created.id;
    }

    // 7. Notificação in-app para administradores e staff da igreja
    try {
      const admins = await this.prisma.user.findMany({
        where: {
          tenantId: tenant.id,
          role: { in: [Role.ADMIN, Role.STAFF] },
          ativo: true,
        },
        select: { id: true },
      });

      if (admins.length > 0) {
        const userIds = admins.map((a) => a.id);
        const tipoLabel =
          dto.tipo === TipoSolicitacaoCadastro.MEMBRO ? 'membro' : 'visitante';
        await this.notificationsService.sendToUsers(tenant.id, userIds, {
          title: 'Nova ficha recebida',
          body: `${dto.nome.trim()} enviou uma ficha de ${tipoLabel}.`,
          url: '/membros?tab=fichas',
        });
      }
    } catch (err) {
      this.logger.error(
        'Erro ao despachar notificação para administradores:',
        err,
      );
    }

    return {
      success: true,
      id: recordId,
      message:
        'Ficha enviada com sucesso! Em breve a equipe pastoral entrará em contato.',
    };
  }

  /**
   * Lista fichas de auto-cadastro para moderação pela liderança (com status de duplicidade)
   */
  async listSolicitacoes(
    tenantId: string,
    status?: StatusSolicitacaoCadastro,
  ): Promise<SolicitacaoComDuplicidade[]> {
    const list = await this.prisma.solicitacaoCadastroMembro.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched: SolicitacaoComDuplicidade[] = [];
    for (const item of list) {
      const duplicidade = await checkMemberDuplicity(this.prisma, tenantId, {
        telefone: item.telefone,
        cpf: item.cpf,
        email: item.email,
        nome: item.nome,
        excludeSolicitacaoId: item.id,
      });

      enriched.push({
        ...item,
        duplicidade,
      });
    }

    return enriched;
  }

  /**
   * Retorna a quantidade de fichas pendentes para exibição de badge
   */
  async countPendentes(tenantId: string): Promise<{ total: number }> {
    const total = await this.prisma.solicitacaoCadastroMembro.count({
      where: {
        tenantId,
        status: StatusSolicitacaoCadastro.PENDENTE,
      },
    });
    return { total };
  }

  /**
   * Rejeita uma solicitação pendente com justificativa opcional
   */
  async rejeitarSolicitacao(
    tenantId: string,
    id: string,
    actorId: string,
    motivo?: string,
    ip?: string,
  ) {
    const solicitacao = await this.prisma.solicitacaoCadastroMembro.findFirst({
      where: { id, tenantId },
    });

    if (!solicitacao) {
      throw new NotFoundException('Ficha não encontrada.');
    }

    if (solicitacao.status !== StatusSolicitacaoCadastro.PENDENTE) {
      throw new BadRequestException('Esta ficha já foi processada.');
    }

    const updated = await this.prisma.solicitacaoCadastroMembro.update({
      where: { id },
      data: {
        status: StatusSolicitacaoCadastro.REJEITADO,
        rejectionReason: motivo?.trim() ?? null,
        processedAt: new Date(),
        processedByUserId: actorId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        entidade: 'solicitacao_cadastro_membro',
        entidadeId: id,
        acao: AcaoAuditoria.ATUALIZAR,
        payloadAfter: { status: 'REJEITADO', motivo },
        ipAddress: ip,
      },
    });

    return updated;
  }

  /**
   * Formata bloco de histórico de auto-cadastro para inserção em observações
   */
  private formatNotesBlock(solicitacao: {
    createdAt: Date;
    igrejaAnterior?: string | null;
    quemConvidou?: string | null;
    batizadoAguas?: boolean | null;
    observacoes?: string | null;
  }): string {
    const dateStr = new Date(solicitacao.createdAt).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
    const lines = [`[Auto-cadastro em ${dateStr}]`];
    if (solicitacao.igrejaAnterior)
      lines.push(`Igreja anterior: ${solicitacao.igrejaAnterior}`);
    if (solicitacao.quemConvidou)
      lines.push(`Convidado por: ${solicitacao.quemConvidou}`);
    if (
      solicitacao.batizadoAguas !== null &&
      solicitacao.batizadoAguas !== undefined
    ) {
      lines.push(
        `Batizado nas águas: ${solicitacao.batizadoAguas ? 'Sim' : 'Não'}`,
      );
    }
    if (solicitacao.observacoes)
      lines.push(`Observações: ${solicitacao.observacoes}`);
    return lines.join('\n');
  }

  /**
   * Aprova uma ficha de auto-cadastro com criação de membro ou vínculo com visitante existente
   */
  async aprovarSolicitacao(
    tenantId: string,
    id: string,
    actorId: string,
    options: { vincularMembroId?: string } = {},
    ip?: string,
  ) {
    const solicitacao = await this.prisma.solicitacaoCadastroMembro.findFirst({
      where: { id, tenantId },
    });

    if (!solicitacao) {
      throw new NotFoundException('Ficha não encontrada.');
    }

    if (solicitacao.status !== StatusSolicitacaoCadastro.PENDENTE) {
      throw new BadRequestException('Esta ficha já foi processada.');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plano: true, limiteMembros: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado.');
    }

    const notesBlock = this.formatNotesBlock(solicitacao);

    // Executa atomicamente em transação
    return this.prisma.$transaction(async (tx) => {
      // 1. FLUXO VISITANTE: apenas cria o membro como VISITANTE, sem usuário e sem validar quota
      if (solicitacao.tipo === TipoSolicitacaoCadastro.VISITANTE) {
        const membro = await tx.membro.create({
          data: {
            tenantId,
            nome: solicitacao.nome,
            whatsapp: solicitacao.telefone,
            email: solicitacao.email ?? null,
            dataNascimento: solicitacao.dataNascimento ?? null,
            sexo: solicitacao.sexo ?? null,
            estadoCivil: solicitacao.estadoCivil ?? null,
            status: StatusMembro.VISITANTE,
            observacoes: notesBlock,
          },
        });

        await tx.solicitacaoCadastroMembro.update({
          where: { id },
          data: {
            status: StatusSolicitacaoCadastro.APROVADO,
            membroId: membro.id,
            processedAt: new Date(),
            processedByUserId: actorId,
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            userId: actorId,
            entidade: 'membros',
            entidadeId: membro.id,
            acao: AcaoAuditoria.CRIAR,
            payloadAfter: {
              origem: 'auto_cadastro_visitante',
              membroId: membro.id,
            },
            ipAddress: ip,
          },
        });

        return {
          membro,
          user: null,
          activationLink: null,
        };
      }

      // 2. FLUXO MEMBRO COM VÍNCULO A VISITANTE EXISTENTE
      if (options.vincularMembroId) {
        const existingMembro = await tx.membro.findFirst({
          where: { id: options.vincularMembroId, tenantId, deletedAt: null },
          include: { user: true },
        });

        if (!existingMembro) {
          throw new NotFoundException('Membro para vínculo não encontrado.');
        }

        if (existingMembro.user) {
          throw new ConflictException(
            'Este membro já possui um usuário de acesso vinculado.',
          );
        }

        // Se o membro não era ATIVO (ex: era VISITANTE ou INATIVO), valida quota do plano
        if (existingMembro.status !== StatusMembro.ATIVO) {
          const totalAtivos = await tx.membro.count({
            where: { tenantId, deletedAt: null, status: StatusMembro.ATIVO },
          });
          if (!canAddMember(tenant, totalAtivos)) {
            throw new ForbiddenException(
              'Limite de membros ativos do plano atingido. Faça upgrade para aprovar mais membros.',
            );
          }
        }

        const combinedNotes = existingMembro.observacoes
          ? `${existingMembro.observacoes}\n\n${notesBlock}`
          : notesBlock;

        const updatedMembro = await tx.membro.update({
          where: { id: existingMembro.id },
          data: {
            status: StatusMembro.ATIVO,
            nome: existingMembro.nome || solicitacao.nome,
            whatsapp: solicitacao.telefone || existingMembro.whatsapp,
            email: solicitacao.email || existingMembro.email,
            cpf: existingMembro.cpf ?? solicitacao.cpf ?? null,
            dataNascimento:
              existingMembro.dataNascimento ??
              solicitacao.dataNascimento ??
              null,
            sexo: existingMembro.sexo ?? solicitacao.sexo ?? null,
            estadoCivil:
              existingMembro.estadoCivil ?? solicitacao.estadoCivil ?? null,
            observacoes: combinedNotes,
          },
        });

        const userResult = await this.authService.createPendingBasicUserInTx(
          tx,
          {
            tenantId,
            nome: updatedMembro.nome,
            email: solicitacao.email!,
            telefoneLogin: solicitacao.telefone,
            memberId: updatedMembro.id,
            actorId,
            ip,
          },
        );

        await tx.solicitacaoCadastroMembro.update({
          where: { id },
          data: {
            status: StatusSolicitacaoCadastro.APROVADO,
            membroId: updatedMembro.id,
            userId: userResult.user.id,
            processedAt: new Date(),
            processedByUserId: actorId,
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            userId: actorId,
            entidade: 'membros',
            entidadeId: updatedMembro.id,
            acao: AcaoAuditoria.ATUALIZAR,
            payloadAfter: {
              origem: 'auto_cadastro_membro_vinculado',
              statusAnterior: existingMembro.status,
              novoStatus: StatusMembro.ATIVO,
            },
            ipAddress: ip,
          },
        });

        return {
          membro: updatedMembro,
          user: userResult.user,
          activationLink: userResult.activationLink,
        };
      }

      // 3. FLUXO NOVO MEMBRO (sem vínculo prévio)
      const totalAtivos = await tx.membro.count({
        where: { tenantId, deletedAt: null, status: StatusMembro.ATIVO },
      });
      if (!canAddMember(tenant, totalAtivos)) {
        throw new ForbiddenException(
          'Limite de membros ativos do plano atingido. Faça upgrade para aprovar mais membros.',
        );
      }

      const membro = await tx.membro.create({
        data: {
          tenantId,
          nome: solicitacao.nome,
          whatsapp: solicitacao.telefone,
          email: solicitacao.email,
          cpf: solicitacao.cpf ?? null,
          dataNascimento: solicitacao.dataNascimento ?? null,
          sexo: solicitacao.sexo ?? null,
          estadoCivil: solicitacao.estadoCivil ?? null,
          status: StatusMembro.ATIVO,
          observacoes: notesBlock,
        },
      });

      const userResult = await this.authService.createPendingBasicUserInTx(tx, {
        tenantId,
        nome: solicitacao.nome,
        email: solicitacao.email!,
        telefoneLogin: solicitacao.telefone,
        memberId: membro.id,
        actorId,
        ip,
      });

      await tx.solicitacaoCadastroMembro.update({
        where: { id },
        data: {
          status: StatusSolicitacaoCadastro.APROVADO,
          membroId: membro.id,
          userId: userResult.user.id,
          processedAt: new Date(),
          processedByUserId: actorId,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: actorId,
          entidade: 'membros',
          entidadeId: membro.id,
          acao: AcaoAuditoria.CRIAR,
          payloadAfter: {
            origem: 'auto_cadastro_novo_membro',
            membroId: membro.id,
          },
          ipAddress: ip,
        },
      });

      return {
        membro,
        user: userResult.user,
        activationLink: userResult.activationLink,
      };
    });
  }
}
