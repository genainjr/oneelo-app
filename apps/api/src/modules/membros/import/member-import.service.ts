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
  CampoAlteradoDto,
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

    // Nome Completo
    if (
      normalized === 'nome' ||
      normalized === 'nome completo' ||
      normalized === 'membro' ||
      normalized === 'nome do membro' ||
      normalized.includes('nome completo')
    ) {
      return 'nome';
    }
    // Nome de Exibição / Apelido
    if (
      normalized === 'nome de exibicao' ||
      normalized === 'nome exibicao' ||
      normalized === 'apelido' ||
      normalized === 'como chamar' ||
      normalized.includes('exibicao') ||
      normalized.includes('apelido')
    ) {
      return 'nomeExibicao';
    }
    // WhatsApp / Celular / Telefone
    if (
      normalized === 'whatsapp' ||
      normalized === 'celular' ||
      normalized === 'telefone' ||
      normalized === 'zap' ||
      normalized === 'fone' ||
      normalized === 'whatsapp celular' ||
      normalized.includes('whatsapp') ||
      normalized.includes('celular') ||
      normalized.includes('telefone') ||
      normalized.includes('fone')
    ) {
      return 'whatsapp';
    }
    // E-mail
    if (
      normalized === 'email' ||
      normalized === 'e mail' ||
      normalized.includes('email') ||
      normalized.includes('e mail')
    ) {
      return 'email';
    }
    // Data de Nascimento
    if (
      normalized === 'data de nascimento' ||
      normalized === 'data nascimento' ||
      normalized === 'nascimento' ||
      normalized === 'aniversario' ||
      normalized === 'dt nascimento' ||
      normalized.includes('nasc') ||
      normalized.includes('aniversario')
    ) {
      return 'dataNascimento';
    }
    // Data de Batismo
    if (
      normalized === 'data de batismo' ||
      normalized === 'data batismo' ||
      normalized === 'batismo' ||
      normalized === 'dt batismo' ||
      normalized.includes('batis')
    ) {
      return 'dataBatismo';
    }
    // Sexo / Gênero
    if (
      normalized === 'sexo' ||
      normalized === 'genero' ||
      normalized.includes('sexo') ||
      normalized.includes('genero')
    ) {
      return 'sexo';
    }
    // Estado Civil
    if (
      normalized === 'estado civil' ||
      normalized === 'civil' ||
      normalized.includes('civil')
    ) {
      return 'estadoCivil';
    }
    // Cargo / Função
    if (
      normalized === 'cargo' ||
      normalized === 'cargo funcao' ||
      normalized === 'funcao' ||
      normalized === 'papel' ||
      normalized.includes('cargo') ||
      normalized.includes('funcao')
    ) {
      return 'cargo';
    }
    // CPF
    if (normalized === 'cpf' || normalized.includes('cpf')) {
      return 'cpf';
    }
    // RG
    if (normalized === 'rg' || normalized.includes('rg') || normalized.includes('identidade')) {
      return 'rg';
    }
    // Matrícula / Rol
    if (
      normalized === 'matricula' ||
      normalized === 'rol' ||
      normalized === 'matricula rol' ||
      normalized === 'registro' ||
      normalized.includes('matricula') ||
      normalized.includes('rol')
    ) {
      return 'matricula';
    }
    // Observações
    if (
      normalized === 'observacoes' ||
      normalized === 'observacao' ||
      normalized === 'obs' ||
      normalized === 'notas' ||
      normalized.includes('observ') ||
      normalized.includes('nota')
    ) {
      return 'observacoes';
    }

    return null;
  }

  /**
   * Normaliza nome completo para comparação e deduplicação
   */
  normalizeName(name?: string | null): string {
    if (!name) return '';
    return String(name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normaliza número de telefone para formato E.164 brasileiro
   */
  normalizePhone(phone?: string | number | null): { phone?: string; aviso?: string } {
    if (phone === null || phone === undefined || phone === '') return {};
    const str = String(phone).trim();
    if (!str || str === '-' || str === '--') return {};

    const clean = str.replace(/[^\d+]/g, '');
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

    let digitsOnly = clean.replace(/\D/g, '');
    if (digitsOnly.startsWith('0') && (digitsOnly.length === 11 || digitsOnly.length === 12)) {
      digitsOnly = digitsOnly.slice(1);
    }

    if (digitsOnly.startsWith('55') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
      return { phone: `+${digitsOnly}` };
    }

    if (digitsOnly.length === 10 || digitsOnly.length === 11) {
      return { phone: `+55${digitsOnly}` };
    }

    if (digitsOnly.length === 8 || digitsOnly.length === 9) {
      return {
        phone: digitsOnly,
        aviso: 'Telefone informado sem DDD (ex: 8 ou 9 dígitos).',
      };
    }

    if (clean.startsWith('+') && clean.length >= 8) {
      return { phone: clean };
    }

    return {
      phone: digitsOnly || clean,
      aviso: 'Formato de telefone não padronizado.',
    };
  }

  /**
   * Sanitiza CPF
   */
  normalizeCpf(cpf?: string | number | null): { cpf?: string; erro?: string } {
    if (cpf === null || cpf === undefined || cpf === '') return {};
    let digits = String(cpf).replace(/\D/g, '');
    if (!digits) return {};

    if (digits.length === 10) {
      digits = digits.padStart(11, '0');
    }

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

    // Se já for Date (ExcelJS date)
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return { erro: 'Data inválida.' };
      const year = val.getUTCFullYear();
      const month = String(val.getUTCMonth() + 1).padStart(2, '0');
      const day = String(val.getUTCDate()).padStart(2, '0');
      return { dateIso: `${year}-${month}-${day}` };
    }

    // Se for número serial do Excel
    if (typeof val === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const millis = val * 86400000;
      const d = new Date(excelEpoch.getTime() + millis);
      if (!isNaN(d.getTime())) {
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return { dateIso: `${year}-${month}-${day}` };
      }
      return { erro: 'Data serial numérica inválida.' };
    }

    // Se for string
    const str = String(val).trim();
    if (!str) return {};

    // Formato DD/MM/AAAA ou DD-MM-AAAA (aceita horário no final)
    const brMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})(?:\s+.*)?$/);
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
        const yearStr = d.getUTCFullYear();
        const monthStr = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getUTCDate()).padStart(2, '0');
        return { dateIso: `${yearStr}-${monthStr}-${dayStr}` };
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
        const yearStr = d.getUTCFullYear();
        const monthStr = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getUTCDate()).padStart(2, '0');
        return { dateIso: `${yearStr}-${monthStr}-${dayStr}` };
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
  /**
   * Compara os dados da planilha com o membro existente no banco
   * e retorna os campos que possuem alteração
   */
  detectFieldChanges(
    existing: any,
    incoming: Partial<ImportMemberRowData>,
  ): CampoAlteradoDto[] {
    const changes: CampoAlteradoDto[] = [];

    const fieldsToCheck: Array<{ key: string; label: string; isDate?: boolean }> = [
      { key: 'nome', label: 'Nome' },
      { key: 'nomeExibicao', label: 'Nome de Exibição' },
      { key: 'whatsapp', label: 'WhatsApp / Celular' },
      { key: 'email', label: 'E-mail' },
      { key: 'dataNascimento', label: 'Data de Nascimento', isDate: true },
      { key: 'sexo', label: 'Sexo' },
      { key: 'estadoCivil', label: 'Estado Civil' },
      { key: 'cargo', label: 'Cargo / Função' },
      { key: 'dataBatismo', label: 'Data de Batismo', isDate: true },
      { key: 'cpf', label: 'CPF' },
      { key: 'rg', label: 'RG' },
      { key: 'matricula', label: 'Matrícula / Rol' },
      { key: 'observacoes', label: 'Observações' },
    ];

    for (const { key, label, isDate } of fieldsToCheck) {
      let existingVal: any = existing[key];
      let incomingVal: any = (incoming as any)[key];

      if (isDate) {
        existingVal = existingVal instanceof Date ? existingVal.toISOString().slice(0, 10) : existingVal || null;
        incomingVal = incomingVal ? String(incomingVal).slice(0, 10) : null;
      } else {
        existingVal = existingVal !== null && existingVal !== undefined ? String(existingVal).trim() : null;
        incomingVal = incomingVal !== null && incomingVal !== undefined ? String(incomingVal).trim() : null;
      }

      // Se foi preenchido na planilha e é diferente do valor que está no banco
      if (
        incomingVal !== null &&
        incomingVal !== undefined &&
        incomingVal !== '' &&
        incomingVal !== existingVal
      ) {
        changes.push({
          campo: key,
          label,
          anterior: existingVal,
          novo: incomingVal,
        });
      }
    }

    return changes;
  }

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
          let resolvedVal: any = val;

          // ExcelJS pode retornar objetos ricos para richText, links e fórmulas
          if (val && typeof val === 'object') {
            if ('text' in val) {
              resolvedVal = (val as any).text;
            } else if ('richText' in val && Array.isArray((val as any).richText)) {
              resolvedVal = (val as any).richText.map((r: any) => r.text).join('');
            } else if ('result' in val) {
              resolvedVal = (val as any).result;
            }
          }

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
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        nome: true,
        nomeExibicao: true,
        email: true,
        whatsapp: true,
        dataNascimento: true,
        sexo: true,
        estadoCivil: true,
        cargo: true,
        dataBatismo: true,
        cpf: true,
        rg: true,
        matricula: true,
        observacoes: true,
      },
    });

    const dbMemberById = new Map<string, any>();

    const totalAtivos = existingMembers.length;
    const limit = getEffectiveMemberLimit(tenant);
    const disponiveis = limit !== null ? Math.max(0, limit - totalAtivos) : null;

    // Mapas para duplicidade contra o banco
    const dbCpfMap = new Map<string, string>(); // cpf -> id
    const dbEmailMap = new Map<string, string>(); // email -> id
    const dbPhoneMap = new Map<string, { id: string; nome: string }>(); // phone -> {id, nome}
    const dbNameMap = new Map<string, { id: string; nome: string }[]>(); // normName -> [{id, nome}]

    for (const m of existingMembers) {
      dbMemberById.set(m.id, m);
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
      if (m.nome) {
        const norm = this.normalizeName(m.nome);
        if (norm) {
          const list = dbNameMap.get(norm) || [];
          list.push({ id: m.id, nome: m.nome });
          dbNameMap.set(norm, list);
        }
      }
    }

    // Conjuntos para rastrear duplicidades internas no próprio arquivo
    const fileSeenCpfs = new Set<string>();
    const fileSeenEmails = new Set<string>();
    const fileSeenNames = new Map<string, number>();

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
        const normName = this.normalizeName(nome);

        // A) Duplicidade Interna no Arquivo
        if (cpf && fileSeenCpfs.has(cpf)) {
          statusLinha = 'DUPLICADO';
          erros.push(`CPF duplicado dentro do próprio arquivo (linha repetida).`);
        } else if (email && fileSeenEmails.has(email)) {
          statusLinha = 'DUPLICADO';
          erros.push(`E-mail duplicado dentro do próprio arquivo.`);
        } else if (!cpf && !email && !whatsapp && fileSeenNames.has(normName)) {
          statusLinha = 'DUPLICADO';
          avisos.push(
            `Nome repetido dentro do próprio arquivo (já apareceu na linha ${fileSeenNames.get(normName)}).`,
          );
        } else {
          if (cpf) fileSeenCpfs.add(cpf);
          if (email) fileSeenEmails.add(email);
          if (normName) fileSeenNames.set(normName, linha);

          // B) Duplicidade contra o Banco de Dados (Documento e Contato direto)
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

          // C) Duplicidade por Nome Completo Exato
          // Se ainda não houve match por CPF/E-mail/WhatsApp, checa se há membro com mesmo nome
          if (!membroExistenteId && normName && dbNameMap.has(normName)) {
            const matches = dbNameMap.get(normName)!;
            const matchCandidate = matches.find((m) => {
              const dbM = dbMemberById.get(m.id);
              if (!dbM) return false;
              // Se ambos têm CPF e são divergentes, não é a mesma pessoa (homônimo legítimo)
              if (cpf && dbM.cpf && dbM.cpf.replace(/\D/g, '') !== cpf) {
                return false;
              }
              // Se ambos têm email e são divergentes, não é a mesma pessoa
              if (email && dbM.email && dbM.email.toLowerCase().trim() !== email) {
                return false;
              }
              return true;
            });

            if (matchCandidate) {
              statusLinha = 'DUPLICADO';
              membroExistenteId = matchCandidate.id;
              avisos.push(
                `Membro com mesmo nome completo já cadastrado no sistema (${matchCandidate.nome}).`,
              );
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

      let camposAlterados: CampoAlteradoDto[] | undefined;
      if (statusLinha === 'DUPLICADO' && membroExistenteId && dbMemberById.has(membroExistenteId)) {
        const existingMember = dbMemberById.get(membroExistenteId);
        camposAlterados = this.detectFieldChanges(existingMember, {
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
        });

        if (camposAlterados.length > 0) {
          avisos.push(
            `${camposAlterados.length} campo(s) com alteração para atualização: ${camposAlterados.map((c) => c.label).join(', ')}`,
          );
        } else {
          avisos.push('Dados idênticos aos já cadastrados no sistema (nenhuma alteração detectada).');
        }
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
        camposAlterados,
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
            nomeExibicao: item.nomeExibicao || null,
            whatsapp: item.whatsapp || null,
            email: item.email || null,
            dataNascimento: item.dataNascimento ? new Date(item.dataNascimento) : null,
            sexo: item.sexo || null,
            estadoCivil: item.estadoCivil || null,
            cargo: item.cargo || null,
            dataBatismo: item.dataBatismo ? new Date(item.dataBatismo) : null,
            cpf: item.cpf || null,
            rg: item.rg || null,
            matricula: item.matricula || null,
            observacoes: item.observacoes || null,
          },
        });
        inseridos++;
      }

      // Atualização dos duplicados quando selecionada estratégia UPDATE
      for (const item of toUpdate) {
        if (!item.membroExistenteId) continue;
        const updateData: Record<string, any> = {};

        if (item.nome) updateData.nome = item.nome;
        if (item.nomeExibicao !== undefined) updateData.nomeExibicao = item.nomeExibicao || null;
        if (item.whatsapp !== undefined) updateData.whatsapp = item.whatsapp || null;
        if (item.email !== undefined) updateData.email = item.email || null;
        if (item.dataNascimento !== undefined) {
          updateData.dataNascimento = item.dataNascimento ? new Date(item.dataNascimento) : null;
        }
        if (item.sexo !== undefined) updateData.sexo = item.sexo || null;
        if (item.estadoCivil !== undefined) updateData.estadoCivil = item.estadoCivil || null;
        if (item.cargo !== undefined) updateData.cargo = item.cargo || null;
        if (item.dataBatismo !== undefined) {
          updateData.dataBatismo = item.dataBatismo ? new Date(item.dataBatismo) : null;
        }
        if (item.cpf !== undefined) updateData.cpf = item.cpf || null;
        if (item.rg !== undefined) updateData.rg = item.rg || null;
        if (item.matricula !== undefined) updateData.matricula = item.matricula || null;
        if (item.observacoes !== undefined) updateData.observacoes = item.observacoes || null;

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
