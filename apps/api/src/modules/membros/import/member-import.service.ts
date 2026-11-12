import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  canAddMember,
  getEffectiveMemberLimit,
  isUnlimitedMembers,
} from '../../../common/utils/tenant-plan';
import {
  ConfirmImportDto,
  ConfirmImportResultDto,
  ImportMemberRowData,
  ImportPreviewResponseDto,
} from '../dto/import-membros.dto';
import { AcaoAuditoria, EstadoCivil, SexoMembro } from '@prisma/client';

@Injectable()
export class MemberImportService {
  private readonly logger = new Logger(MemberImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normaliza texto de cabeçalho para comparação flexível
   */
  private normalizeHeader(header?: any): string {
    if (!header) return '';
    return String(header)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .trim();
  }

  /**
   * Mapeia cabeçalho normalizado para chave canônica do Membro
   */
  private mapHeaderToField(normalized: string): string | null {
    if (!normalized) return null;

    if (
      normalized === 'nome' ||
      normalized === 'nome completo' ||
      normalized === 'membro' ||
      normalized === 'nome do membro'
    ) {
      return 'nome';
    }
    if (
      normalized === 'nome de exibicao' ||
      normalized === 'nome exibicao' ||
      normalized === 'apelido' ||
      normalized === 'como chamar'
    ) {
      return 'nomeExibicao';
    }
    if (
      normalized === 'whatsapp' ||
      normalized === 'celular' ||
      normalized === 'telefone' ||
      normalized === 'zap' ||
      normalized === 'fone' ||
      normalized === 'whatsapp celular'
    ) {
      return 'whatsapp';
    }
    if (normalized === 'email' || normalized === 'e mail') {
      return 'email';
    }
    if (
      normalized === 'data de nascimento' ||
      normalized === 'data nascimento' ||
      normalized === 'nascimento' ||
      normalized === 'aniversario' ||
      normalized === 'dt nascimento'
    ) {
      return 'dataNascimento';
    }
    if (normalized === 'sexo' || normalized === 'genero') {
      return 'sexo';
    }
    if (normalized === 'estado civil' || normalized === 'civil') {
      return 'estadoCivil';
    }
    if (
      normalized === 'cargo' ||
      normalized === 'cargo funcao' ||
      normalized === 'funcao' ||
      normalized === 'papel'
    ) {
      return 'cargo';
    }
    if (
      normalized === 'data de batismo' ||
      normalized === 'data batismo' ||
      normalized === 'batismo' ||
      normalized === 'dt batismo'
    ) {
      return 'dataBatismo';
    }
    if (normalized === 'cpf') {
      return 'cpf';
    }
    if (normalized === 'rg') {
      return 'rg';
    }
    if (
      normalized === 'matricula' ||
      normalized === 'rol' ||
      normalized === 'matricula rol' ||
      normalized === 'registro'
    ) {
      return 'matricula';
    }
    if (
      normalized === 'observacoes' ||
      normalized === 'observacao' ||
      normalized === 'obs' ||
      normalized === 'notas'
    ) {
      return 'observacoes';
    }

    return null;
  }

  /**
   * Normaliza número de telefone para formato E.164 brasileiro
   */
  normalizePhone(phone?: string | null): { phone?: string; aviso?: string } {
    if (!phone) return {};
    const clean = phone.replace(/[^\d+]/g, '');
    if (!clean) return {};

    try {
      const parsed = clean.startsWith('+')
        ? parsePhoneNumberFromString(clean)
        : parsePhoneNumberFromString(clean, 'BR');

      if (parsed && parsed.isValid()) {
        return { phone: parsed.number };
      }
    } catch {
      // Ignora erro do parser e tenta fallback
    }

    // Fallback: se tiver 10 ou 11 dígitos numéricos
    const digitsOnly = clean.replace(/\D/g, '');
    if (digitsOnly.length === 10 || digitsOnly.length === 11) {
      return { phone: `+55${digitsOnly}` };
    }

    return {
      phone: clean,
      aviso: 'Formato de telefone não pôde ser validado com precisão internacional.',
    };
  }

  /**
   * Sanitiza CPF
   */
  normalizeCpf(cpf?: string | null): { cpf?: string; erro?: string } {
    if (!cpf) return {};
    const digits = cpf.replace(/\D/g, '');
    if (!digits) return {};

    if (digits.length !== 11) {
      return { erro: 'CPF deve conter 11 dígitos numéricos.' };
    }

    return { cpf: digits };
  }

  /**
   * Normaliza data (DD/MM/AAAA, AAAA-MM-DD, Date ou Excel Serial)
   */
  normalizeDate(val: any): { dateIso?: string; erro?: string } {
    if (val === null || val === undefined || val === '') return {};

    // Se já for Date
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return { erro: 'Data inválida.' };
      return { dateIso: val.toISOString().slice(0, 10) };
    }

    // Se for número serial do Excel
    if (typeof val === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const millis = val * 86400000;
      const d = new Date(excelEpoch.getTime() + millis);
      if (!isNaN(d.getTime())) {
        return { dateIso: d.toISOString().slice(0, 10) };
      }
      return { erro: 'Data serial numérica inválida.' };
    }

    // Se for string
    const str = String(val).trim();
    if (!str) return {};

    // Formato DD/MM/AAAA ou DD-MM-AAAA
    const brMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
    if (brMatch) {
      const day = parseInt(brMatch[1], 10);
      const month = parseInt(brMatch[2], 10) - 1;
      const year = parseInt(brMatch[3], 10);
      const d = new Date(Date.UTC(year, month, day));
      if (
        d.getUTCFullYear() === year &&
        d.getUTCMonth() === month &&
        d.getUTCDate() === day
      ) {
        return { dateIso: d.toISOString().slice(0, 10) };
      }
      return { erro: 'Dia, mês ou ano fora dos limites válidos.' };
    }

    // Formato ISO AAAA-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      const d = new Date(Date.UTC(year, month, day));
      if (!isNaN(d.getTime())) {
        return { dateIso: d.toISOString().slice(0, 10) };
      }
    }

    return { erro: 'Data não reconhecida. Use o formato DD/MM/AAAA.' };
  }

  /**
   * Normaliza Sexo para Enum SexoMembro
   */
  normalizeSexo(val?: string | null): SexoMembro | undefined {
    if (!val) return undefined;
    const clean = val.toLowerCase().trim();
    if (['m', 'masc', 'masculino', 'homem'].includes(clean)) {
      return SexoMembro.MASCULINO;
    }
    if (['f', 'fem', 'feminino', 'mulher'].includes(clean)) {
      return SexoMembro.FEMININO;
    }
    return undefined;
  }

  /**
   * Normaliza Estado Civil para Enum EstadoCivil
   */
  normalizeEstadoCivil(val?: string | null): EstadoCivil | undefined {
    if (!val) return undefined;
    const clean = val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/g, '');

    if (clean.startsWith('solteir')) return EstadoCivil.SOLTEIRO;
    if (clean.startsWith('casad')) return EstadoCivil.CASADO;
    if (clean.startsWith('divorciad')) return EstadoCivil.DIVORCIADO;
    if (clean.startsWith('viuv')) return EstadoCivil.VIUVO;
    if (clean.includes('uniao') || clean.includes('estavel')) return EstadoCivil.UNIAO_ESTAVEL;

    return undefined;
  }

  /**
   * Lê o buffer de uma planilha (.xlsx ou .csv) e retorna as linhas brutas mapeadas
   */
  async extractRowsFromBuffer(
    buffer: Buffer,
    filename: string,
  ): Promise<Record<string, any>[]> {
    const workbook = new ExcelJS.Workbook();
    const isCsv = filename.toLowerCase().endsWith('.csv');

    if (isCsv) {
      // Converte CSV para stream ou usa método nativo do ExcelJS
      const text = buffer.toString('utf-8');
      const stream = require('stream');
      const readable = new stream.Readable();
      readable._read = () => {};
      readable.push(text);
      readable.push(null);
      await workbook.csv.read(readable);
    } else {
      await workbook.xlsx.load(buffer as any);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) {
      throw new BadRequestException(
        'A planilha está vazia ou não contém dados além do cabeçalho.',
      );
    }

    // Linha 1 = Cabeçalhos
    const headerRow = worksheet.getRow(1);
    const colIndexToField: Record<number, string> = {};

    headerRow.eachCell((cell, colNumber) => {
      const normalized = this.normalizeHeader(cell.value);
      const field = this.mapHeaderToField(normalized);
      if (field) {
        colIndexToField[colNumber] = field;
      }
    });

    if (!Object.values(colIndexToField).includes('nome')) {
      throw new BadRequestException(
        'Coluna obrigatória "Nome Completo" não foi encontrada na planilha. Baixe o modelo oficial para conferir.',
      );
    }

    const rawRows: Record<string, any>[] = [];

    // Itera da linha 2 até o final
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      let hasData = false;
      const rowData: Record<string, any> = { _rowNumber: rowNumber };

      row.eachCell((cell, colNumber) => {
        const field = colIndexToField[colNumber];
        if (field) {
          const val = cell.value;
          // ExcelJS pode retornar objetos ricos para links/fórmulas
          const resolvedVal =
            val && typeof val === 'object' && 'text' in val ? (val as any).text : val;
          if (resolvedVal !== null && resolvedVal !== undefined && resolvedVal !== '') {
            hasData = true;
            rowData[field] = resolvedVal;
          }
        }
      });

      // Ignora linhas totalmente em branco
      if (hasData) {
        rawRows.push(rowData);
      }
    }

    return rawRows;
  }

  /**
   * Processa o arquivo em memória e gera a prévia completa (Dry-Run)
   */
  async generatePreview(
    tenantId: string,
    fileBuffer: Buffer,
    filename: string,
  ): Promise<ImportPreviewResponseDto> {
    const rawRows = await this.extractRowsFromBuffer(fileBuffer, filename);

    // Busca o tenant e membros existentes no banco para validação de duplicidade e limites
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, plano: true, limiteMembros: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado.');
    }

    const existingMembers = await this.prisma.client.membro.findMany({
      where: { tenantId },
      select: {
        id: true,
        nome: true,
        email: true,
        whatsapp: true,
        cpf: true,
      },
    });

    const totalAtivos = existingMembers.length;
    const limit = getEffectiveMemberLimit(tenant);
    const disponiveis = limit !== null ? Math.max(0, limit - totalAtivos) : null;

    // Mapas para duplicidade contra o banco
    const dbCpfMap = new Map<string, string>(); // cpf -> id
    const dbEmailMap = new Map<string, string>(); // email -> id
    const dbPhoneMap = new Map<string, { id: string; nome: string }>(); // phone -> {id, nome}

    for (const m of existingMembers) {
      if (m.cpf) {
        dbCpfMap.set(m.cpf.replace(/\D/g, ''), m.id);
      }
      if (m.email) {
        dbEmailMap.set(m.email.toLowerCase().trim(), m.id);
      }
      if (m.whatsapp) {
        const clean = m.whatsapp.replace(/\D/g, '');
        if (clean) {
          dbPhoneMap.set(clean, { id: m.id, nome: m.nome });
        }
      }
    }

    // Conjuntos para rastrear duplicidades internas no próprio arquivo
    const fileSeenCpfs = new Set<string>();
    const fileSeenEmails = new Set<string>();

    const parsedRows: ImportMemberRowData[] = [];
    let validosCount = 0;
    let duplicadosCount = 0;
    let errosCount = 0;

    for (const raw of rawRows) {
      const linha = raw._rowNumber;
      const erros: string[] = [];
      const avisos: string[] = [];
      let statusLinha: 'VALIDO' | 'DUPLICADO' | 'ERRO' = 'VALIDO';
      let membroExistenteId: string | undefined;

      // 1. Validação de Nome (Obrigatório)
      const nome = raw.nome ? String(raw.nome).trim() : '';
      if (!nome) {
        erros.push('Nome Completo é obrigatório.');
      } else if (nome.length < 2) {
        erros.push('Nome Completo muito curto.');
      }

      // 2. Telefone / WhatsApp
      const phoneNorm = this.normalizePhone(raw.whatsapp);
      const whatsapp = phoneNorm.phone;
      if (phoneNorm.aviso) avisos.push(phoneNorm.aviso);

      // 3. E-mail
      let email: string | undefined;
      if (raw.email) {
        const cleanEmail = String(raw.email).toLowerCase().trim();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          email = cleanEmail;
        } else {
          erros.push('E-mail em formato inválido.');
        }
      }

      // 4. CPF
      let cpf: string | undefined;
      if (raw.cpf) {
        const cpfNorm = this.normalizeCpf(String(raw.cpf));
        if (cpfNorm.erro) {
          erros.push(cpfNorm.erro);
        } else {
          cpf = cpfNorm.cpf;
        }
      }

      // 5. Datas
      let dataNascimento: string | undefined;
      if (raw.dataNascimento) {
        const dateNorm = this.normalizeDate(raw.dataNascimento);
        if (dateNorm.erro) {
          erros.push(`Nascimento: ${dateNorm.erro}`);
        } else {
          dataNascimento = dateNorm.dateIso;
        }
      }

      let dataBatismo: string | undefined;
      if (raw.dataBatismo) {
        const batismoNorm = this.normalizeDate(raw.dataBatismo);
        if (batismoNorm.erro) {
          erros.push(`Batismo: ${batismoNorm.erro}`);
        } else {
          dataBatismo = batismoNorm.dateIso;
        }
      }

      // 6. Enums
      const sexo = this.normalizeSexo(raw.sexo);
      const estadoCivil = this.normalizeEstadoCivil(raw.estadoCivil);

      // 7. Checagem de Duplicidades (se não tiver erros fatais)
      if (erros.length === 0) {
        // A) Duplicidade Interna no Arquivo
        if (cpf && fileSeenCpfs.has(cpf)) {
          statusLinha = 'DUPLICADO';
          erros.push(`CPF duplicado dentro do próprio arquivo (linha repetida).`);
        } else if (email && fileSeenEmails.has(email)) {
          statusLinha = 'DUPLICADO';
          erros.push(`E-mail duplicado dentro do próprio arquivo.`);
        } else {
          if (cpf) fileSeenCpfs.add(cpf);
          if (email) fileSeenEmails.add(email);

          // B) Duplicidade contra o Banco de Dados
          if (cpf && dbCpfMap.has(cpf)) {
            statusLinha = 'DUPLICADO';
            membroExistenteId = dbCpfMap.get(cpf);
            avisos.push(`Membro com mesmo CPF já cadastrado no sistema.`);
          } else if (email && dbEmailMap.has(email)) {
            statusLinha = 'DUPLICADO';
            membroExistenteId = dbEmailMap.get(email);
            avisos.push(`Membro com mesmo e-mail já cadastrado.`);
          } else if (whatsapp) {
            const cleanPhone = whatsapp.replace(/\D/g, '');
            const existingWithPhone = dbPhoneMap.get(cleanPhone);
            if (existingWithPhone) {
              const firstNameNew = nome.split(' ')[0].toLowerCase();
              const firstNameExisting = existingWithPhone.nome.split(' ')[0].toLowerCase();

              if (firstNameNew === firstNameExisting) {
                statusLinha = 'DUPLICADO';
                membroExistenteId = existingWithPhone.id;
                avisos.push(
                  `Membro com mesmo telefone e primeiro nome similar (${existingWithPhone.nome}).`,
                );
              } else {
                avisos.push(
                  `Telefone compartilhado com outro membro da igreja (${existingWithPhone.nome}).`,
                );
              }
            }
          }
        }
      }

      // Determina status final da linha
      if (erros.length > 0) {
        statusLinha = 'ERRO';
        errosCount++;
      } else if (statusLinha === 'DUPLICADO') {
        duplicadosCount++;
      } else {
        statusLinha = 'VALIDO';
        validosCount++;
      }

      parsedRows.push({
        linha,
        nome,
        nomeExibicao: raw.nomeExibicao ? String(raw.nomeExibicao).trim() : undefined,
        whatsapp,
        email,
        dataNascimento,
        sexo,
        estadoCivil,
        cargo: raw.cargo ? String(raw.cargo).trim() : undefined,
        dataBatismo,
        cpf,
        rg: raw.rg ? String(raw.rg).trim() : undefined,
        matricula: raw.matricula ? String(raw.matricula).trim() : undefined,
        observacoes: raw.observacoes ? String(raw.observacoes).trim() : undefined,
        statusLinha,
        erros: erros.length > 0 ? erros : undefined,
        avisos: avisos.length > 0 ? avisos : undefined,
        membroExistenteId,
      });
    }

    const excedeuLimite =
      !isUnlimitedMembers(tenant.plano) &&
      limit !== null &&
      totalAtivos + validosCount > limit;

    return {
      totalLinhas: rawRows.length,
      validosCount,
      duplicadosCount,
      errosCount,
      limitePlano: {
        limite: limit,
        totalAtivos,
        disponiveis,
        excedeuLimite,
      },
      linhas: parsedRows,
    };
  }

  /**
   * Confirma a importação definitiva em lote com auditoria
   */
  async confirmImport(
    tenantId: string,
    userId: string,
    dto: ConfirmImportDto,
  ): Promise<ConfirmImportResultDto> {
    const { estrategiaDuplicados, membros } = dto;

    if (!Array.isArray(membros) || membros.length === 0) {
      throw new BadRequestException('Nenhum membro fornecido para confirmação.');
    }

    // 1. Valida limites do plano
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, plano: true, limiteMembros: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado.');
    }

    const totalAtivos = await this.prisma.client.membro.count({
      where: { tenantId },
    });

    // Separa os novos membros a criar
    const toCreate = membros.filter((m) => m.statusLinha === 'VALIDO');
    const toUpdate =
      estrategiaDuplicados === 'UPDATE'
        ? membros.filter((m) => m.statusLinha === 'DUPLICADO' && m.membroExistenteId)
        : [];
    const toSkip =
      estrategiaDuplicados === 'SKIP'
        ? membros.filter((m) => m.statusLinha === 'DUPLICADO')
        : [];

    if (!canAddMember(tenant, totalAtivos + toCreate.length)) {
      const effectiveLimit = getEffectiveMemberLimit(tenant);
      throw new ForbiddenException(
        `A importação de ${toCreate.length} novos membros excede o limite (${effectiveLimit}) do plano ${tenant.plano}. Faça upgrade para continuar.`,
      );
    }

    let inseridos = 0;
    let atualizados = 0;

    // 2. Executa em transação atômica
    await this.prisma.client.$transaction(async (tx) => {
      // Inserção em lote dos válidos
      for (const item of toCreate) {
        await tx.membro.create({
          data: {
            tenantId,
            nome: item.nome,
            nomeExibicao: item.nomeExibicao,
            whatsapp: item.whatsapp,
            email: item.email,
            dataNascimento: item.dataNascimento ? new Date(item.dataNascimento) : undefined,
            sexo: item.sexo,
            estadoCivil: item.estadoCivil,
            cargo: item.cargo,
            dataBatismo: item.dataBatismo ? new Date(item.dataBatismo) : undefined,
            cpf: item.cpf,
            rg: item.rg,
            matricula: item.matricula,
            observacoes: item.observacoes,
          },
        });
        inseridos++;
      }

      // Atualização dos duplicados quando selecionada estratégia UPDATE
      for (const item of toUpdate) {
        if (!item.membroExistenteId) continue;
        const updateData: Record<string, any> = {};

        if (item.nomeExibicao) updateData.nomeExibicao = item.nomeExibicao;
        if (item.whatsapp) updateData.whatsapp = item.whatsapp;
        if (item.email) updateData.email = item.email;
        if (item.dataNascimento) updateData.dataNascimento = new Date(item.dataNascimento);
        if (item.sexo) updateData.sexo = item.sexo;
        if (item.estadoCivil) updateData.estadoCivil = item.estadoCivil;
        if (item.cargo) updateData.cargo = item.cargo;
        if (item.dataBatismo) updateData.dataBatismo = new Date(item.dataBatismo);
        if (item.cpf) updateData.cpf = item.cpf;
        if (item.rg) updateData.rg = item.rg;
        if (item.matricula) updateData.matricula = item.matricula;
        if (item.observacoes) updateData.observacoes = item.observacoes;

        if (Object.keys(updateData).length > 0) {
          await tx.membro.update({
            where: { id: item.membroExistenteId },
            data: updateData,
          });
          atualizados++;
        }
      }

      // 3. Registra auditoria
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          entidade: 'MEMBRO',
          entidadeId: 'import-batch',
          acao: AcaoAuditoria.CRIAR,
          payloadAfter: {
            tipo: 'IMPORTACAO_PLANILHA',
            estrategia: estrategiaDuplicados,
            totalProcessados: membros.length,
            inseridos,
            atualizados,
            pulados: toSkip.length,
          },
        },
      });
    });

    this.logger.log(
      `Importação concluída com sucesso no tenant ${tenantId}: inseridos=${inseridos}, atualizados=${atualizados}, pulados=${toSkip.length}`,
    );

    return {
      totalProcessados: membros.length,
      inseridos,
      atualizados,
      pulados: toSkip.length,
    };
  }
}
