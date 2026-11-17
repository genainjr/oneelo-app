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
  normalizeName,
  normalizePhone,
  extractPhoneDigits,
  checkMemberDuplicity,
  loadMemberDuplicityContext,
  DuplicityCheckResult,
} from './member-deduplication.helper';
import {
  AcaoAuditoria,
  Prisma,
  Role,
  StatusMembro,
  StatusSolicitacaoCadastro,
  TipoSolicitacaoCadastro,
  UserStatus,
} from '@prisma/client';
import { canAddMember } from '../../common/utils/tenant-plan';

export const SOLICITACAO_MERGE_FIELDS = [
  'nome',
  'whatsapp',
  'email',
  'cpf',
  'dataNascimento',
  'sexo',
  'estadoCivil',
] as const;

export type SolicitacaoMergeField = (typeof SOLICITACAO_MERGE_FIELDS)[number];

export type UserAccessOutcome =
  | 'CREATED'
  | 'REGENERATED'
  | 'ALREADY_ACTIVE'
  | 'DISABLED'
  | 'PROTECTED_ROLE'
  | 'NONE';

export interface AprovarSolicitacaoOptions {
  vincularMembroId?: string;
  camposAtualizar?: SolicitacaoMergeField[];
  anexarObservacoes?: boolean;
  criarOuRegenerarAcesso?: boolean;
  promoverParaAtivo?: boolean;
  permitirCriarNovoMesmoDuplicado?: boolean;
}

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

    // 4.1 Validação de nome do responsável quando dependente sem celular próprio
    if (dto.isDependente && !dto.responsavelNome?.trim()) {
      throw new BadRequestException(
        'Informe o nome do responsável pelo dependente.',
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
    const incomingNameNorm = normalizeName(dto.nome);

    const responsavelClean = dto.responsavelNome?.trim();
    const rawObservacoes = dto.observacoes?.trim();
    const dependentPrefix = dto.isDependente && responsavelClean
      ? `[Dependente — Responsável: ${responsavelClean}]`
      : responsavelClean
        ? `[Responsável: ${responsavelClean}]`
        : null;
    const combinedObservacoes = dependentPrefix
      ? rawObservacoes && !rawObservacoes.includes(dependentPrefix)
        ? `${dependentPrefix}\n${rawObservacoes}`
        : rawObservacoes || dependentPrefix
      : rawObservacoes;

    // 6. Idempotência por familiar (mesmo telefone + mesmo nome, ou mesmo CPF) pendente no mesmo tenant
    const pendingRequests =
      await this.prisma.solicitacaoCadastroMembro.findMany({
        where: {
          tenantId: tenant.id,
          status: 'PENDENTE',
        },
      });

    const existingPending = pendingRequests.find((r) => {
      if (cpfNorm && r.cpf) {
        const existingCpfNorm = normalizeCpf(r.cpf).cpf;
        if (existingCpfNorm && existingCpfNorm === cpfNorm) {
          return true;
        }
      }

      const samePhone = extractPhoneDigits(r.telefone) === phoneDigits;
      const sameName = Boolean(
        r.nome && incomingNameNorm && normalizeName(r.nome) === incomingNameNorm,
      );
      return samePhone && sameName;
    });

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
          observacoes: combinedObservacoes ?? existingPending.observacoes,
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
          observacoes: combinedObservacoes,
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

    if (list.length === 0) {
      return [];
    }

    const preloadedPending =
      !status || status === StatusSolicitacaoCadastro.PENDENTE
        ? list
            .filter((item) => item.status === StatusSolicitacaoCadastro.PENDENTE)
            .map((item) => ({
              id: item.id,
              nome: item.nome,
              telefone: item.telefone,
              cpf: item.cpf,
            }))
        : undefined;

    const duplicityContext = await loadMemberDuplicityContext(
      this.prisma,
      tenantId,
      preloadedPending,
    );

    const enriched: SolicitacaoComDuplicidade[] = [];
    for (const item of list) {
      const duplicidade = await checkMemberDuplicity(
        this.prisma,
        tenantId,
        {
          telefone: item.telefone,
          cpf: item.cpf,
          email: item.email,
          nome: item.nome,
          excludeSolicitacaoId: item.id,
        },
        duplicityContext,
      );

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
   * Aprova uma ficha de auto-cadastro com criação de membro ou vínculo/atualização de cadastro existente
   */
  async aprovarSolicitacao(
    tenantId: string,
    id: string,
    actorId: string,
    options: AprovarSolicitacaoOptions = {},
    ip?: string,
  ) {
    // Executa atomicamente em transação com claim da ficha pendente
    return this.prisma.$transaction(async (tx) => {
      const solicitacao = await tx.solicitacaoCadastroMembro.findFirst({
        where: { id, tenantId },
      });

      if (!solicitacao) {
        throw new NotFoundException('Ficha não encontrada.');
      }

      if (solicitacao.status !== StatusSolicitacaoCadastro.PENDENTE) {
        throw new BadRequestException('Esta ficha já foi processada.');
      }

      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { plano: true, limiteMembros: true },
      });

      if (!tenant) {
        throw new NotFoundException('Tenant não encontrado.');
      }

      const claim = await tx.solicitacaoCadastroMembro.updateMany({
        where: {
          id,
          tenantId,
          status: StatusSolicitacaoCadastro.PENDENTE,
        },
        data: {
          status: StatusSolicitacaoCadastro.APROVADO,
          processedAt: new Date(),
          processedByUserId: actorId,
        },
      });

      if (claim.count === 0) {
        throw new BadRequestException('Esta ficha já foi processada.');
      }

      const notesBlock = this.formatNotesBlock(solicitacao);

      // 1. FLUXO COM VÍNCULO / ATUALIZAÇÃO DE MEMBRO EXISTENTE (avaliado antes de tipo VISITANTE)
      if (options.vincularMembroId) {
        const existingMembro = await tx.membro.findFirst({
          where: { id: options.vincularMembroId, tenantId, deletedAt: null },
          include: {
            user: {
              select: {
                id: true,
                nome: true,
                email: true,
                telefoneLogin: true,
                role: true,
                status: true,
                ativo: true,
                activationExpiresAt: true,
              },
            },
          },
        });

        if (!existingMembro) {
          throw new NotFoundException('Membro para vínculo não encontrado.');
        }

        // Membro ATIVO nunca sofre downgrade para VISITANTE
        const shouldPromote =
          existingMembro.status === StatusMembro.ATIVO
            ? false
            : options.promoverParaAtivo !== undefined
              ? options.promoverParaAtivo
              : solicitacao.tipo === TipoSolicitacaoCadastro.MEMBRO;

        const targetStatus =
          existingMembro.status === StatusMembro.ATIVO
            ? StatusMembro.ATIVO
            : shouldPromote
              ? StatusMembro.ATIVO
              : existingMembro.status;

        // Valida cota do plano apenas quando um membro não-ativo é promovido a ATIVO
        if (
          existingMembro.status !== StatusMembro.ATIVO &&
          targetStatus === StatusMembro.ATIVO
        ) {
          const totalAtivos = await tx.membro.count({
            where: { tenantId, deletedAt: null, status: StatusMembro.ATIVO },
          });
          if (!canAddMember(tenant, totalAtivos)) {
            throw new ForbiddenException(
              'Limite de membros ativos do plano atingido. Faça upgrade para aprovar mais membros.',
            );
          }
        }

        const solicitacaoEmailNorm = solicitacao.email
          ? normalizeEmail(solicitacao.email)
          : null;
        const solicitacaoCpfNorm = solicitacao.cpf
          ? (normalizeCpf(solicitacao.cpf).cpf ?? solicitacao.cpf)
          : null;

        const updateData: Prisma.MembroUpdateInput = {
          status: targetStatus,
        };
        const selectedFields = options.camposAtualizar
          ? new Set<SolicitacaoMergeField>(options.camposAtualizar)
          : null;

        if (selectedFields) {
          if (selectedFields.has('nome') && solicitacao.nome?.trim()) {
            updateData.nome = solicitacao.nome.trim();
          }
          if (selectedFields.has('whatsapp') && solicitacao.telefone?.trim()) {
            updateData.whatsapp = solicitacao.telefone.trim();
          }
          if (selectedFields.has('email') && solicitacaoEmailNorm) {
            updateData.email = solicitacaoEmailNorm;
          }
          if (selectedFields.has('cpf') && solicitacaoCpfNorm) {
            updateData.cpf = solicitacaoCpfNorm;
          }
          if (
            selectedFields.has('dataNascimento') &&
            solicitacao.dataNascimento
          ) {
            updateData.dataNascimento = solicitacao.dataNascimento;
          }
          if (selectedFields.has('sexo') && solicitacao.sexo) {
            updateData.sexo = solicitacao.sexo;
          }
          if (selectedFields.has('estadoCivil') && solicitacao.estadoCivil) {
            updateData.estadoCivil = solicitacao.estadoCivil;
          }
        } else {
          // Retrocompatibilidade quando camposAtualizar não for enviado
          updateData.nome = existingMembro.nome || solicitacao.nome;
          updateData.whatsapp =
            solicitacao.telefone || existingMembro.whatsapp;
          updateData.email = solicitacaoEmailNorm || existingMembro.email;
          updateData.cpf = existingMembro.cpf ?? solicitacaoCpfNorm ?? null;
          updateData.dataNascimento =
            existingMembro.dataNascimento ?? solicitacao.dataNascimento ?? null;
          updateData.sexo = existingMembro.sexo ?? solicitacao.sexo ?? null;
          updateData.estadoCivil =
            existingMembro.estadoCivil ?? solicitacao.estadoCivil ?? null;
        }

        const shouldAppendNotes = options.anexarObservacoes !== false;
        if (shouldAppendNotes) {
          updateData.observacoes = existingMembro.observacoes
            ? `${existingMembro.observacoes}\n\n${notesBlock}`
            : notesBlock;
        }

        const payloadBefore = {
          status: existingMembro.status,
          nome: existingMembro.nome,
          whatsapp: existingMembro.whatsapp,
          email: existingMembro.email,
          cpf: existingMembro.cpf,
          dataNascimento: existingMembro.dataNascimento,
          sexo: existingMembro.sexo,
          estadoCivil: existingMembro.estadoCivil,
        };

        const updatedMembro = await tx.membro.update({
          where: { id: existingMembro.id },
          data: updateData,
        });

        const wantsAccess =
          options.criarOuRegenerarAcesso !== undefined
            ? options.criarOuRegenerarAcesso
            : targetStatus === StatusMembro.ATIVO &&
              solicitacao.tipo === TipoSolicitacaoCadastro.MEMBRO;
        const canReceiveBasicUser = targetStatus === StatusMembro.ATIVO;

        let finalUser: any = null;
        let activationLink: string | null = null;
        let userAccessOutcome: UserAccessOutcome = 'NONE';
        let resolvedUserId: string | null = existingMembro.user?.id ?? null;

        if (!existingMembro.user) {
          if (canReceiveBasicUser && wantsAccess) {
            const finalEmail = (
              updatedMembro.email ||
              solicitacaoEmailNorm ||
              ''
            )
              .trim()
              .toLowerCase();
            if (!finalEmail) {
              throw new BadRequestException(
                'Informe um e-mail válido no cadastro para criar o usuário de acesso.',
              );
            }

            const userResult = await this.authService.createPendingBasicUserInTx(
              tx,
              {
                tenantId,
                nome: updatedMembro.nome,
                email: finalEmail,
                telefoneLogin: updatedMembro.whatsapp ?? solicitacao.telefone,
                memberId: updatedMembro.id,
                actorId,
                ip,
              },
            );
            finalUser = userResult.user;
            activationLink = userResult.activationLink;
            userAccessOutcome = 'CREATED';
            resolvedUserId = userResult.user.id;
          }
        } else {
          const existingUser = existingMembro.user;
          const sanitizedExistingUser = {
            id: existingUser.id,
            nome: existingUser.nome,
            email: existingUser.email,
            role: existingUser.role,
            status: existingUser.status,
            activationExpiresAt: existingUser.activationExpiresAt ?? null,
          };

          if (existingUser.role !== Role.BASIC) {
            finalUser = sanitizedExistingUser;
            userAccessOutcome = 'PROTECTED_ROLE';
          } else if (existingUser.status === UserStatus.DISABLED) {
            finalUser = sanitizedExistingUser;
            userAccessOutcome = 'DISABLED';
          } else if (existingUser.status !== UserStatus.PENDING) {
            finalUser = sanitizedExistingUser;
            userAccessOutcome = 'ALREADY_ACTIVE';
          } else {
            const syncNome =
              selectedFields?.has('nome') && updatedMembro.nome
                ? updatedMembro.nome
                : undefined;
            const syncEmail =
              selectedFields?.has('email') && updatedMembro.email
                ? updatedMembro.email
                : undefined;
            const syncTelefone =
              selectedFields?.has('whatsapp')
                ? (updatedMembro.whatsapp ?? null)
                : undefined;

            const shouldTouchPendingUser =
              wantsAccess ||
              syncNome !== undefined ||
              syncEmail !== undefined ||
              syncTelefone !== undefined;

            if (shouldTouchPendingUser) {
              const regenerated =
                await this.authService.regeneratePendingActivationInTx(tx, {
                  userId: existingUser.id,
                  tenantId,
                  actorId,
                  ip,
                  nome: syncNome,
                  email: syncEmail,
                  telefoneLogin: syncTelefone,
                  regenerarLink: wantsAccess,
                  origemAuditoria: 'auto_cadastro_vinculo_atualizado',
                });
              finalUser = regenerated;
              activationLink = regenerated.activationLink;
              userAccessOutcome = wantsAccess ? 'REGENERATED' : 'NONE';
            } else {
              finalUser = sanitizedExistingUser;
              userAccessOutcome = 'NONE';
            }
          }
        }

        await tx.solicitacaoCadastroMembro.update({
          where: { id },
          data: {
            status: StatusSolicitacaoCadastro.APROVADO,
            membroId: updatedMembro.id,
            userId: resolvedUserId,
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            userId: actorId,
            entidade: 'membros',
            entidadeId: updatedMembro.id,
            acao: AcaoAuditoria.ATUALIZAR,
            payloadBefore,
            payloadAfter: {
              origem: 'auto_cadastro_membro_vinculado',
              statusAnterior: existingMembro.status,
              novoStatus: updatedMembro.status,
              camposAtualizados: selectedFields
                ? Array.from(selectedFields)
                : 'retrocompat_lacunas',
              anexarObservacoes: shouldAppendNotes,
              userAccessOutcome,
            },
            ipAddress: ip,
          },
        });

        return {
          membro: updatedMembro,
          user: finalUser,
          activationLink,
          userAccessOutcome,
        };
      }

      // 2. PROTEÇÃO CONTRA DUPLICATA ACIDENTAL AO CRIAR NOVO CADASTRO SEM VÍNCULO
      const duplicityInTx = await checkMemberDuplicity(tx, tenantId, {
        telefone: solicitacao.telefone,
        cpf: solicitacao.cpf,
        email: solicitacao.email,
        nome: solicitacao.nome,
        excludeSolicitacaoId: solicitacao.id,
      });

      if (duplicityInTx.isDuplicate && duplicityInTx.membroExistenteId) {
        if (duplicityInTx.motivoDuplicidade === 'CPF') {
          throw new ConflictException(
            `Já existe um cadastro com este CPF ("${duplicityInTx.membroExistenteNome}"). Revise e atualize o cadastro existente.`,
          );
        }
        if (
          (duplicityInTx.motivoDuplicidade === 'TELEFONE' ||
            duplicityInTx.motivoDuplicidade === 'EMAIL') &&
          !options.permitirCriarNovoMesmoDuplicado
        ) {
          throw new ConflictException(
            `Já existe um cadastro com este ${
              duplicityInTx.motivoDuplicidade === 'TELEFONE'
                ? 'telefone'
                : 'e-mail'
            } ("${duplicityInTx.membroExistenteNome}"). Revise o cadastro existente ou confirme se é um familiar / pessoa diferente.`,
          );
        }
        if (
          duplicityInTx.motivoDuplicidade === 'NOME_EXATO' &&
          !options.permitirCriarNovoMesmoDuplicado
        ) {
          throw new ConflictException(
            `Já existe um cadastro com o mesmo nome ("${duplicityInTx.membroExistenteNome}"). Revise o cadastro existente ou confirme se trata de outra pessoa.`,
          );
        }
      }

      // 3. FLUXO NOVO VISITANTE: cria o membro como VISITANTE, sem usuário e sem validar quota
      if (solicitacao.tipo === TipoSolicitacaoCadastro.VISITANTE) {
        const membro = await tx.membro.create({
          data: {
            tenantId,
            nome: solicitacao.nome,
            whatsapp: solicitacao.telefone,
            email: solicitacao.email ?? null,
            cpf: solicitacao.cpf ?? null,
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
          userAccessOutcome: 'NONE' as UserAccessOutcome,
        };
      }

      // 4. FLUXO NOVO MEMBRO (sem vínculo prévio)
      const totalAtivos = await tx.membro.count({
        where: { tenantId, deletedAt: null, status: StatusMembro.ATIVO },
      });
      if (!canAddMember(tenant, totalAtivos)) {
        throw new ForbiddenException(
          'Limite de membros ativos do plano atingido. Faça upgrade para aprovar mais membros.',
        );
      }

      const finalEmail = (solicitacao.email || '').trim().toLowerCase();
      if (!finalEmail) {
        throw new BadRequestException(
          'Informe um e-mail válido no cadastro para criar o usuário de acesso.',
        );
      }

      const membro = await tx.membro.create({
        data: {
          tenantId,
          nome: solicitacao.nome,
          whatsapp: solicitacao.telefone,
          email: finalEmail,
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
        email: finalEmail,
        telefoneLogin: solicitacao.telefone,
        memberId: membro.id,
        actorId,
        ip,
        ignorarTelefoneSeEmUso: Boolean(options.permitirCriarNovoMesmoDuplicado),
      });

      await tx.solicitacaoCadastroMembro.update({
        where: { id },
        data: {
          status: StatusSolicitacaoCadastro.APROVADO,
          membroId: membro.id,
          userId: userResult.user.id,
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
            userAccessOutcome: 'CREATED',
          },
          ipAddress: ip,
        },
      });

      return {
        membro,
        user: userResult.user,
        activationLink: userResult.activationLink,
        userAccessOutcome: 'CREATED' as UserAccessOutcome,
      };
    });
  }
}
