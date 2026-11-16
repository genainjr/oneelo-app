'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  Info,
  ShieldCheck,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { ModalError, ModalFooter, ModalShell } from '@/components/app/modal-shell';
import { StatusBadge } from '@/components/app/status-badge';
import {
  STATUS_MEMBRO_COLOR,
  STATUS_MEMBRO_LABEL,
  formatDate,
  formatPhone,
  getCivilDateKey,
} from '@/lib/utils';
import type { EstadoCivil, Role, SexoMembro, StatusMembro, UserStatus } from '@/types';

export type SolicitacaoMergeField =
  | 'nome'
  | 'whatsapp'
  | 'email'
  | 'cpf'
  | 'dataNascimento'
  | 'sexo'
  | 'estadoCivil';

export type UserAccessOutcome =
  | 'CREATED'
  | 'REGENERATED'
  | 'ALREADY_ACTIVE'
  | 'DISABLED'
  | 'PROTECTED_ROLE'
  | 'NONE';

export interface SolicitacaoExistingMemberSnapshot {
  id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  cpf: string | null;
  dataNascimento: string | null;
  sexo: SexoMembro | null;
  estadoCivil: EstadoCivil | null;
  observacoes: string | null;
  status: StatusMembro;
}

export interface SolicitacaoExistingUserSnapshot {
  id: string;
  role: Role;
  status: UserStatus;
  ativo: boolean;
  email: string;
  telefoneLogin: string | null;
}

export interface SolicitacaoDuplicidadeInfo {
  isDuplicate: boolean;
  membroExistenteId?: string;
  membroExistenteNome?: string;
  membroExistenteStatus?: string;
  motivoDuplicidade?:
    | 'TELEFONE'
    | 'CPF'
    | 'EMAIL'
    | 'NOME_EXATO'
    | 'FICHA_PENDENTE';
  membroExistente?: SolicitacaoExistingMemberSnapshot;
  usuarioExistente?: SolicitacaoExistingUserSnapshot | null;
}

export interface SolicitacaoItem {
  id: string;
  tenantId: string;
  tipo: 'VISITANTE' | 'MEMBRO';
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO';
  nome: string;
  telefone: string;
  cpf: string | null;
  email: string | null;
  dataNascimento: string | null;
  sexo: SexoMembro | null;
  estadoCivil: EstadoCivil | null;
  batizadoAguas: boolean | null;
  igrejaAnterior: string | null;
  quemConvidou: string | null;
  observacoes: string | null;
  createdAt: string;
  duplicidade: SolicitacaoDuplicidadeInfo;
}

export interface SolicitacaoMergeSubmitPayload {
  vincularMembroId: string;
  camposAtualizar: SolicitacaoMergeField[];
  anexarObservacoes: boolean;
  criarOuRegenerarAcesso: boolean;
  promoverParaAtivo: boolean;
}

interface SolicitacaoDuplicidadeModalProps {
  isOpen: boolean;
  item: SolicitacaoItem | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (payload: SolicitacaoMergeSubmitPayload) => Promise<void> | void;
}

const SEXO_LABEL: Record<SexoMembro, string> = {
  MASCULINO: 'Masculino',
  FEMININO: 'Feminino',
};

const ESTADO_CIVIL_LABEL: Record<EstadoCivil, string> = {
  SOLTEIRO: 'Solteiro(a)',
  CASADO: 'Casado(a)',
  DIVORCIADO: 'Divorciado(a)',
  VIUVO: 'Viúvo(a)',
  UNIAO_ESTAVEL: 'União Estável',
};

const MOTIVO_LABEL: Record<
  NonNullable<SolicitacaoDuplicidadeInfo['motivoDuplicidade']>,
  string
> = {
  CPF: 'CPF idêntico',
  TELEFONE: 'Mesmo WhatsApp / Telefone',
  EMAIL: 'Mesmo E-mail',
  NOME_EXATO: 'Nome completo idêntico',
  FICHA_PENDENTE: 'Outra ficha pendente',
};

function normalizeDigits(value?: string | null): string {
  return value ? value.replace(/\D/g, '') : '';
}

function formatCpfDisplay(value?: string | null): string | null {
  const digits = normalizeDigits(value);
  if (!digits) return null;
  const padded = digits.length === 10 ? digits.padStart(11, '0') : digits;
  if (padded.length !== 11) return value?.trim() || null;
  return `${padded.slice(0, 3)}.${padded.slice(3, 6)}.${padded.slice(6, 9)}-${padded.slice(9, 11)}`;
}

function normalizePhoneDigits(value?: string | null): string {
  let digits = normalizeDigits(value);
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

function formatWhatsappDisplay(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const digits = normalizePhoneDigits(value);
  if (digits.length === 10 || digits.length === 11) {
    return formatPhone(digits);
  }
  return value.trim();
}

interface FieldComparisonRow {
  key: SolicitacaoMergeField;
  label: string;
  currentDisplay: string | null;
  incomingDisplay: string | null;
  hasIncomingValue: boolean;
  isDifferent: boolean;
  isNewFill: boolean;
}

function buildFieldComparisons(
  item: SolicitacaoItem,
  membro: SolicitacaoExistingMemberSnapshot,
): FieldComparisonRow[] {
  const incomingEmailNorm = item.email?.trim().toLowerCase() || null;
  const existingEmailNorm = membro.email?.trim().toLowerCase() || null;

  const incomingCpfDigits = normalizeDigits(item.cpf);
  const existingCpfDigits = normalizeDigits(membro.cpf);

  const incomingPhoneDigits = normalizePhoneDigits(item.telefone);
  const existingPhoneDigits = normalizePhoneDigits(membro.whatsapp);

  const incomingDateKey = getCivilDateKey(item.dataNascimento);
  const existingDateKey = getCivilDateKey(membro.dataNascimento);

  const rows: Array<{
    key: SolicitacaoMergeField;
    label: string;
    currentDisplay: string | null;
    incomingDisplay: string | null;
    equals: boolean;
  }> = [
    {
      key: 'nome',
      label: 'Nome completo',
      currentDisplay: membro.nome?.trim() || null,
      incomingDisplay: item.nome?.trim() || null,
      equals: (membro.nome?.trim() ?? '') === (item.nome?.trim() ?? ''),
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp / Celular',
      currentDisplay: formatWhatsappDisplay(membro.whatsapp),
      incomingDisplay: formatWhatsappDisplay(item.telefone),
      equals:
        Boolean(incomingPhoneDigits && existingPhoneDigits) &&
        incomingPhoneDigits === existingPhoneDigits,
    },
    {
      key: 'email',
      label: 'E-mail',
      currentDisplay: existingEmailNorm,
      incomingDisplay: incomingEmailNorm,
      equals:
        Boolean(incomingEmailNorm && existingEmailNorm) &&
        incomingEmailNorm === existingEmailNorm,
    },
    {
      key: 'cpf',
      label: 'CPF',
      currentDisplay: formatCpfDisplay(membro.cpf),
      incomingDisplay: formatCpfDisplay(item.cpf),
      equals:
        Boolean(incomingCpfDigits && existingCpfDigits) &&
        incomingCpfDigits.padStart(11, '0') === existingCpfDigits.padStart(11, '0'),
    },
    {
      key: 'dataNascimento',
      label: 'Data de Nascimento',
      currentDisplay: existingDateKey ? formatDate(membro.dataNascimento) : null,
      incomingDisplay: incomingDateKey ? formatDate(item.dataNascimento) : null,
      equals:
        Boolean(incomingDateKey && existingDateKey) &&
        incomingDateKey === existingDateKey,
    },
    {
      key: 'sexo',
      label: 'Sexo',
      currentDisplay: membro.sexo ? SEXO_LABEL[membro.sexo] : null,
      incomingDisplay: item.sexo ? SEXO_LABEL[item.sexo] : null,
      equals: Boolean(membro.sexo && item.sexo) && membro.sexo === item.sexo,
    },
    {
      key: 'estadoCivil',
      label: 'Estado Civil',
      currentDisplay: membro.estadoCivil
        ? ESTADO_CIVIL_LABEL[membro.estadoCivil]
        : null,
      incomingDisplay: item.estadoCivil
        ? ESTADO_CIVIL_LABEL[item.estadoCivil]
        : null,
      equals:
        Boolean(membro.estadoCivil && item.estadoCivil) &&
        membro.estadoCivil === item.estadoCivil,
    },
  ];

  return rows.map((row) => {
    const hasIncomingValue = Boolean(row.incomingDisplay);
    const isNewFill = !row.currentDisplay && hasIncomingValue;
    const isDifferent = hasIncomingValue && !row.equals;
    return {
      key: row.key,
      label: row.label,
      currentDisplay: row.currentDisplay,
      incomingDisplay: row.incomingDisplay,
      hasIncomingValue,
      isDifferent,
      isNewFill,
    };
  });
}

function getUserSummaryMeta(usuario?: SolicitacaoExistingUserSnapshot | null) {
  if (!usuario) {
    return {
      badge: 'Sem usuário de acesso',
      badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
    };
  }
  if (usuario.role !== 'BASIC') {
    return {
      badge: `Conta administrativa (${usuario.role})`,
      badgeClass: 'bg-blue-50 text-blue-800 border border-blue-200',
    };
  }
  if (usuario.status === 'DISABLED') {
    return {
      badge: 'Usuário desativado',
      badgeClass: 'bg-gray-100 text-gray-700 border border-gray-200',
    };
  }
  if (usuario.status === 'ACTIVE') {
    return {
      badge: 'Usuário já ativo',
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    };
  }
  return {
    badge: 'Convite pendente (72h)',
    badgeClass: 'bg-accent-soft text-accent-ink border border-accent-soft-border',
  };
}

export function SolicitacaoDuplicidadeModal({
  isOpen,
  item,
  submitting,
  error,
  onClose,
  onConfirm,
}: SolicitacaoDuplicidadeModalProps) {
  const membro = item?.duplicidade.membroExistente;
  const usuario = item?.duplicidade.usuarioExistente ?? null;

  const comparisons = useMemo(() => {
    if (!item || !membro) return [];
    return buildFieldComparisons(item, membro);
  }, [item, membro]);

  const hasPastoralNotes = Boolean(
    item &&
      (item.igrejaAnterior ||
        item.quemConvidou ||
        item.batizadoAguas !== null ||
        item.observacoes),
  );

  const [selectedFields, setSelectedFields] = useState<Set<SolicitacaoMergeField>>(
    () => new Set(),
  );
  const [anexarObservacoes, setAnexarObservacoes] = useState(true);
  const [promoverParaAtivo, setPromoverParaAtivo] = useState(true);
  const [criarOuRegenerarAcesso, setCriarOuRegenerarAcesso] = useState(true);
  const [showUnchanged, setShowUnchanged] = useState(false);

  useEffect(() => {
    if (!isOpen || !item || !membro) return;

    const initialFields = new Set<SolicitacaoMergeField>();
    for (const row of buildFieldComparisons(item, membro)) {
      if (row.isNewFill) {
        initialFields.add(row.key);
      }
    }
    setSelectedFields(initialFields);
    setAnexarObservacoes(true);
    const shouldPromoteDefault =
      membro.status === 'ATIVO' ? true : item.tipo === 'MEMBRO';
    setPromoverParaAtivo(shouldPromoteDefault);

    const hasValidEmailCandidate = Boolean(
      (
        (initialFields.has('email') ? item.email : membro.email) ||
        item.email ||
        ''
      ).trim(),
    );

    if (!usuario) {
      setCriarOuRegenerarAcesso(
        shouldPromoteDefault && item.tipo === 'MEMBRO' && hasValidEmailCandidate,
      );
    } else if (usuario.role === 'BASIC' && usuario.status === 'PENDING') {
      setCriarOuRegenerarAcesso(true);
    } else {
      setCriarOuRegenerarAcesso(false);
    }
    setShowUnchanged(false);
  }, [isOpen, item, membro, usuario]);

  if (!isOpen || !item || !membro) return null;

  const isExistingActive = membro.status === 'ATIVO';
  const willBeActiveMember = isExistingActive || promoverParaAtivo;

  const finalEmailCandidate = (
    (selectedFields.has('email') ? item.email : membro.email) ||
    item.email ||
    ''
  ).trim();
  const hasFinalValidEmail = Boolean(finalEmailCandidate);

  const selectableRows = comparisons.filter((r) => r.isDifferent);
  const unchangedRows = comparisons.filter((r) => !r.isDifferent);

  const userMeta = getUserSummaryMeta(usuario);
  const motivoText = item.duplicidade.motivoDuplicidade
    ? MOTIVO_LABEL[item.duplicidade.motivoDuplicidade]
    : 'Cadastro similar';

  function toggleField(field: SolicitacaoMergeField) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }

  function selectAllDifferent() {
    setSelectedFields(new Set(selectableRows.map((r) => r.key)));
  }

  async function handleSubmit() {
    if (!item || !membro) return;
    await onConfirm({
      vincularMembroId: membro.id,
      camposAtualizar: Array.from(selectedFields),
      anexarObservacoes,
      promoverParaAtivo: isExistingActive ? false : promoverParaAtivo,
      criarOuRegenerarAcesso: willBeActiveMember ? criarOuRegenerarAcesso : false,
    });
  }

  const canCreateNewUser = !usuario && willBeActiveMember && hasFinalValidEmail;
  const canRegeneratePending =
    Boolean(usuario && usuario.role === 'BASIC' && usuario.status === 'PENDING') &&
    willBeActiveMember;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={submitting ? () => undefined : onClose}
      size="lg"
      icon={<GitMerge className="h-5 w-5" />}
      title="Revisar e Atualizar Cadastro Existente"
      description={`Critério identificado: ${motivoText}`}
      bodyClassName="p-4 sm:p-6 space-y-5"
      footer={
        <ModalFooter
          primaryLabel="Aplicar Atualização"
          cancelLabel="Cancelar"
          onCancel={onClose}
          loading={submitting}
          type="button"
          onClick={handleSubmit}
        />
      }
    >
      {error && <ModalError message={error} className="mx-0 mt-0" />}

      {/* Resumo do cadastro coincidente */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Cadastro já existente no sistema
            </p>
            <h3 className="text-base font-bold text-gray-900 mt-0.5">{membro.nome}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={STATUS_MEMBRO_LABEL[membro.status] ?? membro.status}
              className={STATUS_MEMBRO_COLOR[membro.status] ?? 'bg-gray-100 text-gray-700'}
            />
            <StatusBadge label={userMeta.badge} className={userMeta.badgeClass} />
          </div>
        </div>
        {usuario && (
          <p className="text-xs text-gray-600">
            Conta vinculada: <span className="font-semibold text-gray-800">{usuario.email}</span>
            {usuario.telefoneLogin ? ` · Login por telefone: ${formatWhatsappDisplay(usuario.telefoneLogin)}` : ''}
          </p>
        )}
      </div>

      {/* Opção de promoção quando for Visitante */}
      {!isExistingActive && (
        <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 cursor-pointer">
          <input
            type="checkbox"
            checked={promoverParaAtivo}
            onChange={(e) => {
              const checked = e.target.checked;
              setPromoverParaAtivo(checked);
              if (!checked) {
                setCriarOuRegenerarAcesso(false);
              }
            }}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-accent-ring text-accent-ink focus:ring-accent-ring"
          />
          <div className="text-sm">
            <span className="font-semibold text-amber-950 block">
              Promover este Visitante para Membro Ativo
            </span>
            <span className="text-xs text-amber-800 block mt-0.5">
              {item.tipo === 'VISITANTE'
                ? 'A ficha foi enviada na aba Visitante; marque apenas se desejar efetivá-lo como membro ativo agora.'
                : 'Atualiza o status para Ativo validando a cota de membros do plano e libera criação de acesso.'}
            </span>
          </div>
        </label>
      )}

      {/* Comparação campo a campo */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-gray-900">
              Comparação de Dados (Atual × Ficha Recebida)
            </h4>
            <p className="text-xs text-gray-500">
              Campos vazios no sistema já vêm pré-marcados. Divergências ficam sob sua escolha.
            </p>
          </div>
          {selectableRows.length > 0 && (
            <button
              type="button"
              onClick={selectAllDifferent}
              className="text-xs font-semibold text-accent-ink hover:underline"
            >
              Selecionar todos os campos da ficha
            </button>
          )}
        </div>

        {selectableRows.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-sm text-emerald-900 flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              Os dados principais da ficha já coincidem com o cadastro atual. Você pode apenas
              anexar observações ou concluir o fluxo de acesso abaixo.
            </span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectableRows.map((row) => {
              const checked = selectedFields.has(row.key);
              return (
                <label
                  key={row.key}
                  className={`block rounded-xl border p-3.5 transition-all cursor-pointer ${
                    checked
                      ? 'border-accent-soft-border bg-accent-soft/60 shadow-2xs'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleField(row.key)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 accent-accent-ring text-accent-ink focus:ring-accent-ring"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {row.label}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            row.isNewFill
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {row.isNewFill ? 'Novo dado' : 'Valor divergente'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-white/90 border border-gray-200 px-2.5 py-2">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                            Cadastro Atual
                          </span>
                          <span className="mt-0.5 block font-medium text-gray-700 break-words">
                            {row.currentDisplay ?? 'Em branco'}
                          </span>
                        </div>
                        <div className="rounded-lg bg-white border border-gray-200 px-2.5 py-2">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-accent-ink">
                            Ficha Recebida
                          </span>
                          <span className="mt-0.5 block font-semibold text-gray-900 break-words">
                            {row.incomingDisplay}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {unchangedRows.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowUnchanged((v) => !v)}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 underline underline-offset-2"
            >
              {showUnchanged
                ? `Ocultar campos idênticos ou sem novidade (${unchangedRows.length})`
                : `Ver campos idênticos ou sem novidade (${unchangedRows.length})`}
            </button>
            {showUnchanged && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {unchangedRows.map((row) => (
                  <div
                    key={row.key}
                    className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-gray-600">{row.label}: </span>
                    <span className="text-gray-700">
                      {row.currentDisplay ?? 'Não informado'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Observações e histórico pastoral */}
      <div className="rounded-xl border border-gray-200 bg-white p-3.5 space-y-2.5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={anexarObservacoes}
            onChange={(e) => setAnexarObservacoes(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-accent-ring text-accent-ink focus:ring-accent-ring"
          />
          <div className="text-sm">
            <span className="font-semibold text-gray-900 block">
              Anexar dados pastorais e observações ao histórico do membro
            </span>
            <span className="text-xs text-gray-500 block mt-0.5">
              Preserva as observações já existentes e registra o bloco datado desta ficha.
            </span>
          </div>
        </label>

        {hasPastoralNotes && (
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-2.5 text-xs text-gray-600 space-y-1">
            {item.igrejaAnterior && (
              <p>
                <span className="font-semibold text-gray-800">Igreja anterior:</span>{' '}
                {item.igrejaAnterior}
              </p>
            )}
            {item.quemConvidou && (
              <p>
                <span className="font-semibold text-gray-800">Convidado por:</span>{' '}
                {item.quemConvidou}
              </p>
            )}
            {item.batizadoAguas !== null && (
              <p>
                <span className="font-semibold text-gray-800">Batizado nas águas:</span>{' '}
                {item.batizadoAguas ? 'Sim' : 'Não'}
              </p>
            )}
            {item.observacoes && (
              <p>
                <span className="font-semibold text-gray-800">Observação:</span>{' '}
                {item.observacoes}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Fluxo de Usuário / Acesso ao Sistema */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2.5">
        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-accent-ink" />
          Fluxo de Acesso do Usuário
        </h4>

        {!usuario ? (
          !willBeActiveMember ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-gray-400" />
              <span>
                Cadastro permanecerá como Visitante — usuários de acesso são criados apenas para
                Membros Ativos.
              </span>
            </div>
          ) : !hasFinalValidEmail ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Sem e-mail válido no cadastro atual nem nesta ficha. A atualização cadastral será
                salva, mas o usuário de acesso não pode ser criado agora sem e-mail.
              </span>
            </div>
          ) : (
            <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-accent-soft-border bg-accent-soft/40 p-3">
              <input
                type="checkbox"
                checked={canCreateNewUser && criarOuRegenerarAcesso}
                onChange={(e) => setCriarOuRegenerarAcesso(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-accent-ring text-accent-ink focus:ring-accent-ring"
              />
              <div className="text-sm">
                <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4 text-accent-ink" />
                  Criar usuário de acesso (perfil Membro) e gerar link de ativação
                </span>
                <span className="text-xs text-gray-600 block mt-0.5">
                  Será vinculada uma conta pendente para{' '}
                  <strong>{finalEmailCandidate}</strong> (sem duplicar membro nem consumir nova
                  vaga do plano) com envio direto por WhatsApp.
                </span>
              </div>
            </label>
          )
        ) : usuario.role !== 'BASIC' ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
            <span>
              Este membro possui conta administrativa (<strong>{usuario.role}</strong> ·{' '}
              {usuario.email}). Apenas os dados cadastrais selecionados do membro serão
              atualizados; credenciais e permissões administrativas não serão alteradas.
            </span>
          </div>
        ) : usuario.status === 'DISABLED' ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-gray-500" />
            <span>
              O usuário vinculado ({usuario.email}) está <strong>desativado</strong>. Somente os
              dados cadastrais do membro serão atualizados — a conta permanecerá desativada.
            </span>
          </div>
        ) : usuario.status === 'ACTIVE' ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>
              O membro já possui acesso ativo no sistema ({usuario.email}). Somente os dados
              cadastrais selecionados serão atualizados, sem gerar novo usuário nem alterar a senha
              atual.
            </span>
          </div>
        ) : (
          <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-accent-soft-border bg-accent-soft/40 p-3">
            <input
              type="checkbox"
              checked={canRegeneratePending && criarOuRegenerarAcesso}
              onChange={(e) => setCriarOuRegenerarAcesso(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-accent-ring text-accent-ink focus:ring-accent-ring"
            />
            <div className="text-sm">
              <span className="font-semibold text-gray-900 block">
                Gerar novo link de ativação (72h) para este usuário pendente
              </span>
              <span className="text-xs text-gray-600 block mt-0.5">
                E-mail ou telefone alterados na comparação acima também serão sincronizados neste
                convite pendente ({usuario.email}) e você poderá enviar o novo link no WhatsApp.
              </span>
            </div>
          </label>
        )}
      </div>
    </ModalShell>
  );
}
