'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ModalError, ModalShell } from '@/components/app/modal-shell';
import { TextareaField } from '@/components/app/form-field';
import { WelcomeActivationModal } from '@/components/app/welcome-activation-modal';
import { FilterShell, FilterActions } from '@/components/app/filter-shell';
import { FilterInput, FilterSelect } from '@/components/app/filter-field';
import { EmptyState } from '@/components/app/empty-state';
import {
  SolicitacaoDuplicidadeModal,
  type SolicitacaoItem,
  type SolicitacaoMergeSubmitPayload,
  type UserAccessOutcome,
} from '@/components/app/solicitacao-duplicidade-modal';
import {
  Heart,
  UserPlus,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  XCircle,
  GitMerge,
  Loader2,
  Calendar,
  Phone,
  Mail,
  RefreshCw,
  Inbox,
} from 'lucide-react';

interface AprovarSolicitacaoResponse {
  membro: any;
  user: any;
  activationLink: string | null;
  userAccessOutcome?: UserAccessOutcome;
}

interface SolicitacoesTriagemTabProps {
  onCountChanged?: () => void;
  tenantName?: string;
}

function getMotivoDuplicidadeLabel(
  motivo?: SolicitacaoItem['duplicidade']['motivoDuplicidade'],
): string {
  switch (motivo) {
    case 'CPF':
      return 'CPF';
    case 'TELEFONE':
      return 'Telefone';
    case 'EMAIL':
      return 'E-mail';
    case 'NOME_EXATO':
      return 'Nome Exato';
    case 'FICHA_PENDENTE':
      return 'Ficha Pendente';
    default:
      return 'Similar';
  }
}

function getDuplicityAccessHint(
  duplicidade: SolicitacaoItem['duplicidade'],
): string {
  const user = duplicidade.usuarioExistente;
  const status = duplicidade.membroExistenteStatus;
  const isVisitor = status === 'VISITANTE';
  const isFormerMember = status === 'INATIVO' || status === 'TRANSFERIDO';
  const formerLabel = status === 'TRANSFERIDO' ? 'Transferido' : 'Inativo';

  if (!user) {
    if (isFormerMember) {
      return `Ex-membro (${formerLabel}) ainda sem acesso. Você pode revisar os dados para reativar o cadastro histórico e, se aplicável, gerar convite de usuário.`;
    }
    return isVisitor
      ? 'Visitante ainda sem acesso. Você pode revisar os dados, promover a Membro Ativo e gerar convite de usuário.'
      : 'Membro ativo sem usuário de acesso. Revise os dados para atualizar o cadastro e criar o convite de ativação.';
  }

  if (user.role !== 'BASIC') {
    return `Possui conta administrativa (${user.role} · ${user.email}). Apenas os dados cadastrais do membro podem ser atualizados.`;
  }

  if (user.status === 'DISABLED') {
    if (isFormerMember) {
      return `Ex-membro (${formerLabel}) com usuário desativado (${user.email}). Revise os dados para reativar o membro e decidir se deseja reativar o acesso ao aplicativo.`;
    }
    return `Usuário desativado (${user.email}). Revise para atualizar dados ou reativar a conta explicitamente, caso deseje.`;
  }

  if (user.status === 'ACTIVE') {
    if (isFormerMember) {
      return `Ex-membro (${formerLabel}) com usuário ativo (${user.email}). Revise para reativar o cadastro preservando o login atual.`;
    }
    return `Usuário já ativo (${user.email}). Revise para atualizar apenas os dados cadastrais sem duplicar cadastro.`;
  }

  return `Convite de acesso pendente (${user.email}). Revise para atualizar os dados e gerar novo link de ativação (72h).`;
}

function buildUpdateOnlyFeedback(
  nome: string,
  outcome?: UserAccessOutcome,
): { title: string; description: string } {
  switch (outcome) {
    case 'ALREADY_ACTIVE':
      return {
        title: `Cadastro de ${nome} atualizado com sucesso.`,
        description:
          'A conta de usuário desse membro já está ativa — nenhum novo acesso foi criado e o login atual permanece intacto.',
      };
    case 'DISABLED':
      return {
        title: `Cadastro de ${nome} atualizado com sucesso.`,
        description:
          'O usuário vinculado está desativado; apenas os dados cadastrais do membro foram atualizados sem reativar a conta.',
      };
    case 'PROTECTED_ROLE':
      return {
        title: `Dados do membro ${nome} atualizados com sucesso.`,
        description:
          'A conta administrativa vinculada foi preservada intacta sem alterações de permissão ou credencial.',
      };
    default:
      return {
        title: `Cadastro de ${nome} atualizado com sucesso.`,
        description:
          'Os dados selecionados foram aplicados ao cadastro existente e a ficha foi concluída sem gerar duplicidade.',
      };
  }
}

export function SolicitacoesTriagemTab({
  onCountChanged,
  tenantName,
}: SolicitacoesTriagemTabProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<SolicitacaoItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<'PENDENTE' | 'TODOS'>('PENDENTE');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modal de Rejeição
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    id: string | null;
    nome: string | null;
    motivo: string;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    id: null,
    nome: null,
    motivo: '',
    loading: false,
    error: null,
  });

  // Modal de Boas-Vindas pós-aprovação
  const [welcomeModal, setWelcomeModal] = useState<{
    isOpen: boolean;
    membro: any;
    user: any;
    activationLink: string | null;
    title?: string;
    badgeTitle?: string;
    description?: string;
  }>({
    isOpen: false,
    membro: null,
    user: null,
    activationLink: null,
  });

  // Modal de revisão/mesclagem de duplicidade
  const [reviewModalItem, setReviewModalItem] = useState<SolicitacaoItem | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Confirmação explícita de homônimo (NOME_EXATO)
  const [homonymConfirmItem, setHomonymConfirmItem] = useState<SolicitacaoItem | null>(null);

  // Feedback para atualizações concluídas sem geração de link
  const [successBanner, setSuccessBanner] = useState<{
    title: string;
    description: string;
  } | null>(null);

  async function loadItems() {
    try {
      setLoading(true);
      setLoadError(null);
      const queryParam = filterStatus === 'PENDENTE' ? '?status=PENDENTE' : '';
      const data = await api.get<SolicitacaoItem[]>(`/api/membros/solicitacoes${queryParam}`);
      setItems(data);
    } catch (err: any) {
      console.error('Erro ao carregar fichas de triagem:', err);
      setLoadError(err?.message || 'Não foi possível carregar as fichas de cadastro.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, [filterStatus]);

  async function applyApprovalSuccess(
    res: AprovarSolicitacaoResponse,
    item: SolicitacaoItem,
    isLinkFlow: boolean,
  ) {
    await loadItems();
    onCountChanged?.();

    if (res.activationLink) {
      const isRegenerated = res.userAccessOutcome === 'REGENERATED';
      const isReactivated = res.userAccessOutcome === 'REACTIVATED';
      setSuccessBanner(null);
      setWelcomeModal({
        isOpen: true,
        membro: res.membro,
        user: res.user,
        activationLink: res.activationLink,
        title: isReactivated
          ? 'Cadastro e Acesso Reativados!'
          : isRegenerated
            ? 'Cadastro Atualizado e Novo Link Gerado!'
            : isLinkFlow
              ? 'Cadastro Atualizado e Acesso Criado!'
              : undefined,
        badgeTitle: isReactivated
          ? `${res.membro.nome} reativado(a) com novo link de ativação!`
          : isRegenerated
            ? `${res.membro.nome} atualizado com novo link de ativação!`
            : isLinkFlow
              ? `${res.membro.nome} atualizado e vinculado ao acesso!`
              : undefined,
        description: isReactivated
          ? 'O cadastro e a conta anterior foram reativados com um novo token válido por 72 horas. Envie o link de definição de senha no WhatsApp abaixo.'
          : isRegenerated
            ? 'Dados atualizados no cadastro existente e novo token válido por 72 horas gerado. Envie no WhatsApp abaixo.'
            : undefined,
      });
      return;
    }

    if (!isLinkFlow && item.tipo === 'VISITANTE') {
      setSuccessBanner(null);
      setWelcomeModal({
        isOpen: true,
        membro: res.membro,
        user: res.user,
        activationLink: null,
      });
      return;
    }

    setSuccessBanner(
      buildUpdateOnlyFeedback(res.membro?.nome || item.nome, res.userAccessOutcome),
    );
  }

  async function handleAprovar(
    item: SolicitacaoItem,
    permitirCriarNovoMesmoDuplicado = false,
  ) {
    try {
      setActionLoadingId(item.id);
      setActionError(null);
      const res = await api.post<AprovarSolicitacaoResponse>(
        `/api/membros/solicitacoes/${item.id}/aprovar`,
        permitirCriarNovoMesmoDuplicado
          ? { permitirCriarNovoMesmoDuplicado: true }
          : {},
      );
      setHomonymConfirmItem(null);
      await applyApprovalSuccess(res, item, false);
    } catch (err: any) {
      setActionError(err?.message || 'Erro ao aprovar ficha.');
    } finally {
      setActionLoadingId(null);
    }
  }

  function openReviewModal(item: SolicitacaoItem) {
    setReviewError(null);
    setActionError(null);
    setReviewModalItem(item);
  }

  async function handleConfirmMerge(payload: SolicitacaoMergeSubmitPayload) {
    if (!reviewModalItem) return;
    const currentItem = reviewModalItem;
    try {
      setReviewSubmitting(true);
      setReviewError(null);
      const res = await api.post<AprovarSolicitacaoResponse>(
        `/api/membros/solicitacoes/${currentItem.id}/aprovar`,
        payload,
      );
      setReviewModalItem(null);
      await applyApprovalSuccess(res, currentItem, true);
    } catch (err: any) {
      setReviewError(err?.message || 'Não foi possível atualizar o cadastro existente.');
    } finally {
      setReviewSubmitting(false);
    }
  }

  function openRejectModal(item: SolicitacaoItem) {
    setRejectModal({
      isOpen: true,
      id: item.id,
      nome: item.nome,
      motivo: '',
      loading: false,
      error: null,
    });
  }

  async function handleConfirmReject() {
    if (!rejectModal.id) return;
    try {
      setRejectModal((prev) => ({ ...prev, loading: true, error: null }));
      await api.post(`/api/membros/solicitacoes/${rejectModal.id}/rejeitar`, {
        motivo: rejectModal.motivo.trim() || undefined,
      });
      setRejectModal({
        isOpen: false,
        id: null,
        nome: null,
        motivo: '',
        loading: false,
        error: null,
      });
      await loadItems();
      onCountChanged?.();
    } catch (err: any) {
      setRejectModal((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Erro ao rejeitar ficha.',
      }));
    }
  }

  function formatTimestampDate(iso: string | null) {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
  }

  const filteredItems = items.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.nome.toLowerCase().includes(term) ||
      item.telefone.toLowerCase().includes(term) ||
      (item.email && item.email.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-5">
      {/* Barra de Filtro padrão ODS (alinhada à esquerda) */}
      <FilterShell
        actions={
          <FilterActions
            clearLabel="Limpar"
            reloadLabel="Recarregar"
            onClear={() => {
              setSearchTerm('');
              setFilterStatus('PENDENTE');
            }}
            onReload={loadItems}
            loading={loading}
          />
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FilterInput
            id="search-solicitacoes"
            type="search"
            label="Buscar"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail..."
          />

          <FilterSelect
            id="filter-solicitacoes-status"
            label="Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'PENDENTE' | 'TODOS')}
          >
            <option value="PENDENTE">Pendentes</option>
            <option value="TODOS">Todas as Fichas</option>
          </FilterSelect>
        </div>
      </FilterShell>

      {successBanner && (
        <div className="p-4 text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-950">{successBanner.title}</p>
              <p className="text-xs sm:text-sm text-emerald-800 mt-0.5">
                {successBanner.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="font-semibold text-emerald-700 opacity-75 hover:opacity-100 shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between gap-3">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="font-semibold opacity-70 hover:opacity-100 shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Loader2 className="h-7 w-7 animate-spin text-accent-ink mb-3" />
          <span className="text-sm font-medium text-gray-500">Carregando fichas de cadastro...</span>
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center p-10 bg-white rounded-2xl border border-rose-200 shadow-sm text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">Erro ao carregar fichas</p>
            <p className="text-sm text-rose-700 mt-1">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={loadItems}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <EmptyState
            icon={<Inbox className="h-7 w-7" />}
            title={
              filterStatus === 'PENDENTE'
                ? 'Nenhuma ficha pendente de moderação'
                : 'Nenhuma ficha encontrada'
            }
            description="Novos cadastros feitos pelo link público ou QR Code aparecerão automaticamente aqui para triagem da secretaria."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const isPending = item.status === 'PENDENTE';
            const hasExistingMemberMatch =
              item.duplicidade.isDuplicate &&
              Boolean(item.duplicidade.membroExistenteId);
            const isVisitorDuplicate =
              hasExistingMemberMatch &&
              item.duplicidade.membroExistenteStatus === 'VISITANTE';
            const isFormerMemberDuplicate =
              hasExistingMemberMatch &&
              (item.duplicidade.membroExistenteStatus === 'INATIVO' ||
                item.duplicidade.membroExistenteStatus === 'TRANSFERIDO');
            const isPendingSheetDuplicate =
              item.duplicidade.isDuplicate && !hasExistingMemberMatch;
            const canApproveAsDifferentPerson =
              hasExistingMemberMatch &&
              item.duplicidade.motivoDuplicidade !== 'CPF';

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 transition-all hover:shadow-md space-y-4"
              >
                {/* Linha de Topo: Badge de Perfil, Nome e Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold ${
                        item.tipo === 'VISITANTE'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-accent-soft text-accent-ink border border-accent-soft-border'
                      }`}
                    >
                      {item.tipo === 'VISITANTE' ? (
                        <>
                          <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
                          Visitante
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5 text-accent-ink" />
                          Quero ser Membro
                        </>
                      )}
                    </span>

                    <h3 className="text-base font-bold text-gray-900">{item.nome}</h3>

                    <span className="text-xs sm:text-sm text-gray-500 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Recebido em {formatTimestampDate(item.createdAt)}
                    </span>
                  </div>

                  {/* Status da Ficha */}
                  <div>
                    {item.status === 'APROVADO' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Aprovado
                      </span>
                    )}
                    {item.status === 'REJEITADO' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                        <XCircle className="h-3.5 w-3.5" />
                        Rejeitado
                      </span>
                    )}
                    {item.status === 'PENDENTE' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Pendente de Aprovação
                      </span>
                    )}
                  </div>
                </div>

                {/* Dados de Contato e Eclesiásticos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-800">{item.telefone}</span>
                  </div>

                  {item.email && (
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="truncate">{item.email}</span>
                    </div>
                  )}

                  {item.dataNascimento && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Nascimento:</span>
                      <span className="text-gray-700">{formatDate(item.dataNascimento)}</span>
                    </div>
                  )}

                  {item.quemConvidou && (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-400 shrink-0">Convidado por:</span>
                      <span className="truncate font-medium text-gray-700">{item.quemConvidou}</span>
                    </div>
                  )}
                </div>

                {/* Bloco de Duplicidade Inteligente */}
                {item.duplicidade.isDuplicate && isPending && (
                  <div
                    className={`rounded-xl p-3.5 text-sm border ${
                      isVisitorDuplicate ||
                      isPendingSheetDuplicate ||
                      isFormerMemberDuplicate
                        ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                        : 'bg-rose-50/80 border-rose-200 text-rose-950'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle
                        className={`h-4 w-4 shrink-0 mt-1 ${
                          isVisitorDuplicate ||
                          isPendingSheetDuplicate ||
                          isFormerMemberDuplicate
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {isPendingSheetDuplicate
                            ? `Outra ficha pendente similar: "${item.duplicidade.membroExistenteNome}"`
                            : isVisitorDuplicate
                              ? `Já cadastrado como Visitante: "${item.duplicidade.membroExistenteNome}" (${getMotivoDuplicidadeLabel(item.duplicidade.motivoDuplicidade)})`
                              : isFormerMemberDuplicate
                                ? `Ex-membro encontrado (${item.duplicidade.membroExistenteStatus === 'TRANSFERIDO' ? 'Transferido' : 'Inativo'}): "${item.duplicidade.membroExistenteNome}" (${getMotivoDuplicidadeLabel(item.duplicidade.motivoDuplicidade)})`
                                : `Cadastro ativo existente: "${item.duplicidade.membroExistenteNome}" (${getMotivoDuplicidadeLabel(item.duplicidade.motivoDuplicidade)})`}
                        </p>
                        <p className="opacity-90 text-xs sm:text-sm mt-0.5 leading-relaxed">
                          {isPendingSheetDuplicate
                            ? 'Já existe outra solicitação aguardando aprovação com dados semelhantes. Ao aprovar uma delas, a outra passará a permitir revisão e atualização desse cadastro.'
                            : getDuplicityAccessHint(item.duplicidade)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Observações da Ficha */}
                {item.observacoes && (
                  <div className="rounded-xl bg-gray-50 p-3.5 text-sm text-gray-700 border border-gray-100 leading-relaxed">
                    <span className="font-semibold text-gray-900">Mensagem / Observação: </span>
                    {item.observacoes}
                  </div>
                )}

                {/* Botões de Ação na Fila de Pendentes */}
                {isPending && (
                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => openRejectModal(item)}
                      disabled={actionLoadingId === item.id}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
                    >
                      Rejeitar Ficha
                    </button>

                    {hasExistingMemberMatch ? (
                      <>
                        {canApproveAsDifferentPerson && (
                          <button
                            type="button"
                            onClick={() => setHomonymConfirmItem(item)}
                            disabled={actionLoadingId === item.id}
                            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                          >
                            Pessoa Diferente / Familiar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openReviewModal(item)}
                          disabled={actionLoadingId === item.id}
                          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-2xs hover:bg-brand-hover active:scale-95 transition-all"
                        >
                          <GitMerge className="h-4 w-4" />
                          <span>
                            {isVisitorDuplicate && item.tipo === 'MEMBRO'
                              ? 'Revisar e Promover Visitante'
                              : isFormerMemberDuplicate
                                ? 'Revisar e Reativar Cadastro'
                                : 'Revisar e Atualizar Cadastro'}
                          </span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAprovar(item)}
                        disabled={actionLoadingId === item.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-2xs hover:bg-brand-hover active:scale-95 transition-all"
                      >
                        {actionLoadingId === item.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Aprovando...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            <span>Aprovar Cadastro</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmação de Rejeição */}
      {rejectModal.isOpen && (
        <ModalShell
          isOpen
          title="Rejeitar Ficha de Cadastro"
          onClose={() =>
            setRejectModal({
              isOpen: false,
              id: null,
              nome: null,
              motivo: '',
              loading: false,
              error: null,
            })
          }
          size="sm"
          bodyClassName="p-6"
          footer={
            <>
              <button
                type="button"
                onClick={() =>
                  setRejectModal({
                    isOpen: false,
                    id: null,
                    nome: null,
                    motivo: '',
                    loading: false,
                    error: null,
                  })
                }
                disabled={rejectModal.loading}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-150 rounded-xl transition-all disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={rejectModal.loading}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rejectModal.loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar Rejeição
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {rejectModal.error && <ModalError>{rejectModal.error}</ModalError>}
            <p className="text-sm text-gray-600 leading-relaxed">
              Tem certeza que deseja rejeitar a ficha de <strong>{rejectModal.nome}</strong>? O registro permanecerá salvo como rejeitado para auditoria.
            </p>

            <TextareaField
              label="Motivo da Rejeição (opcional)"
              placeholder="Ex: Dados de contato incorretos, duplicidade..."
              value={rejectModal.motivo}
              onChange={(e) => setRejectModal((prev) => ({ ...prev, motivo: e.target.value }))}
              rows={2}
            />
          </div>
        </ModalShell>
      )}

      {/* Modal de Revisão Side-by-Side para Duplicidades */}
      <SolicitacaoDuplicidadeModal
        isOpen={Boolean(reviewModalItem)}
        item={reviewModalItem}
        submitting={reviewSubmitting}
        error={reviewError}
        onClose={() => {
          if (!reviewSubmitting) {
            setReviewModalItem(null);
            setReviewError(null);
          }
        }}
        onConfirm={handleConfirmMerge}
      />

      {/* Confirmação explícita para pessoa diferente / familiar (TELEFONE, EMAIL ou NOME_EXATO) */}
      {homonymConfirmItem && (
        <ModalShell
          isOpen
          title="Confirmar Cadastro Separado (Familiar / Pessoa Diferente)"
          onClose={() => {
            if (actionLoadingId !== homonymConfirmItem.id) {
              setHomonymConfirmItem(null);
            }
          }}
          size="sm"
          bodyClassName="p-6"
          footer={
            <>
              <button
                type="button"
                onClick={() => setHomonymConfirmItem(null)}
                disabled={actionLoadingId === homonymConfirmItem.id}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleAprovar(homonymConfirmItem, true)}
                disabled={actionLoadingId === homonymConfirmItem.id}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand-hover disabled:opacity-60"
              >
                {actionLoadingId === homonymConfirmItem.id && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Criar Cadastro Separado
              </button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
            <p>
              {homonymConfirmItem.duplicidade.motivoDuplicidade === 'TELEFONE' ? (
                <>
                  Esta ficha utiliza o mesmo telefone (<strong>{homonymConfirmItem.telefone}</strong>)
                  do cadastro de <strong>{homonymConfirmItem.duplicidade.membroExistenteNome}</strong>.
                  Confirma que <strong>{homonymConfirmItem.nome}</strong> é outra pessoa (ex.: filho(a),
                  cônjuge ou dependente) e deve ser criada como um cadastro separado?
                </>
              ) : homonymConfirmItem.duplicidade.motivoDuplicidade === 'EMAIL' ? (
                <>
                  Esta ficha compartilha o mesmo e-mail do cadastro de{' '}
                  <strong>{homonymConfirmItem.duplicidade.membroExistenteNome}</strong>. Confirma que{' '}
                  <strong>{homonymConfirmItem.nome}</strong> é outra pessoa e deve ser criada como um
                  cadastro separado?
                </>
              ) : (
                <>
                  Existe outro cadastro chamado{' '}
                  <strong>{homonymConfirmItem.duplicidade.membroExistenteNome}</strong>. Confirma que{' '}
                  <strong>{homonymConfirmItem.nome}</strong> é outra pessoa (homônimo) e deve ser criada
                  como um cadastro separado?
                </>
              )}
            </p>
            {homonymConfirmItem.tipo === 'MEMBRO' &&
              homonymConfirmItem.duplicidade.motivoDuplicidade === 'TELEFONE' && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  O WhatsApp de contato será mantido na ficha deste membro; se esse número já estiver
                  em uso no login de outro usuário, o acesso desta pessoa usará o e-mail informado.
                </p>
              )}
          </div>
        </ModalShell>
      )}

      {/* Modal de Envio no WhatsApp pós-aprovação */}
      {welcomeModal.isOpen && welcomeModal.membro && (
        <WelcomeActivationModal
          isOpen={welcomeModal.isOpen}
          onClose={() =>
            setWelcomeModal({
              isOpen: false,
              membro: null,
              user: null,
              activationLink: null,
            })
          }
          membro={welcomeModal.membro}
          user={welcomeModal.user}
          activationLink={welcomeModal.activationLink}
          tenantName={tenantName}
          title={welcomeModal.title}
          badgeTitle={welcomeModal.badgeTitle}
          description={welcomeModal.description}
        />
      )}
    </div>
  );
}
