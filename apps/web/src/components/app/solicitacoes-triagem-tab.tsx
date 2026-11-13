'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ModalShell } from '@/components/app/modal-shell';
import { TextareaField } from '@/components/app/form-field';
import { WelcomeActivationModal } from '@/components/app/welcome-activation-modal';
import {
  Heart,
  UserPlus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Link as LinkIcon,
  Loader2,
  Calendar,
  Phone,
  Mail,
  RefreshCw,
  Search,
  Inbox,
  Sparkles,
} from 'lucide-react';

interface SolicitacaoItem {
  id: string;
  tenantId: string;
  tipo: 'VISITANTE' | 'MEMBRO';
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO';
  nome: string;
  telefone: string;
  cpf: string | null;
  email: string | null;
  dataNascimento: string | null;
  sexo: string | null;
  estadoCivil: string | null;
  batizadoAguas: boolean | null;
  igrejaAnterior: string | null;
  quemConvidou: string | null;
  observacoes: string | null;
  createdAt: string;
  duplicidade: {
    isDuplicate: boolean;
    membroExistenteId?: string;
    membroExistenteNome?: string;
    membroExistenteStatus?: string;
    motivoDuplicidade?: string;
  };
}

interface SolicitacoesTriagemTabProps {
  onCountChanged?: () => void;
  tenantName?: string;
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
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    id: string | null;
    nome: string | null;
    motivo: string;
    loading: boolean;
  }>({
    isOpen: false,
    id: null,
    nome: null,
    motivo: '',
    loading: false,
  });

  // Modal de Boas-Vindas pós-aprovação
  const [welcomeModal, setWelcomeModal] = useState<{
    isOpen: boolean;
    membro: any;
    user: any;
    activationLink: string | null;
  }>({
    isOpen: false,
    membro: null,
    user: null,
    activationLink: null,
  });

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

  async function handleAprovar(id: string, vincularMembroId?: string) {
    try {
      setActionLoadingId(id);
      const res = await api.post<any>(`/api/membros/solicitacoes/${id}/aprovar`, {
        vincularMembroId,
      });

      // Recarrega lista e atualiza contador de badge
      await loadItems();
      onCountChanged?.();

      // Abre modal de acolhimento para membros (ou visitantes)
      setWelcomeModal({
        isOpen: true,
        membro: res.membro,
        user: res.user,
        activationLink: res.activationLink,
      });
    } catch (err: any) {
      alert(err.message || 'Erro ao aprovar ficha.');
    } finally {
      setActionLoadingId(null);
    }
  }

  function openRejectModal(item: SolicitacaoItem) {
    setRejectModal({
      isOpen: true,
      id: item.id,
      nome: item.nome,
      motivo: '',
      loading: false,
    });
  }

  async function handleConfirmReject() {
    if (!rejectModal.id) return;
    try {
      setRejectModal((prev) => ({ ...prev, loading: true }));
      await api.post(`/api/membros/solicitacoes/${rejectModal.id}/rejeitar`, {
        motivo: rejectModal.motivo.trim() || undefined,
      });
      setRejectModal({ isOpen: false, id: null, nome: null, motivo: '', loading: false });
      await loadItems();
      onCountChanged?.();
    } catch (err: any) {
      alert(err.message || 'Erro ao rejeitar ficha.');
      setRejectModal((prev) => ({ ...prev, loading: false }));
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
    <div className="space-y-4">
      {/* Barra de Filtro e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterStatus('PENDENTE')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              filterStatus === 'PENDENTE'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Pendentes
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('TODOS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              filterStatus === 'TODOS'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas as Fichas
          </button>

          <button
            type="button"
            onClick={loadItems}
            disabled={loading}
            title="Recarregar"
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-100 shadow-2xs">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-600 mb-2" />
          <span className="text-xs font-medium text-gray-500">Carregando fichas de cadastro...</span>
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center p-10 bg-white rounded-2xl border border-rose-200 shadow-2xs text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Erro ao carregar fichas</p>
            <p className="text-xs text-rose-700 mt-1">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={loadItems}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar novamente
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-100 shadow-2xs text-center">
          <div className="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 mb-3 border border-gray-100">
            <Inbox className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-gray-800">
            {filterStatus === 'PENDENTE'
              ? 'Nenhuma ficha pendente de moderação'
              : 'Nenhuma ficha encontrada'}
          </p>
          <p className="text-xs text-gray-500 max-w-sm mt-1">
            Novos cadastros feitos pelo link público ou QR Code aparecerão automaticamente aqui para triagem da secretaria.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isPending = item.status === 'PENDENTE';
            const isVisitorDuplicate =
              item.duplicidade.isDuplicate &&
              item.duplicidade.membroExistenteStatus === 'VISITANTE';

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs p-4 sm:p-5 transition-all hover:border-gray-300 space-y-3"
              >
                {/* Linha de Topo: Badge de Perfil, Nome e Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        item.tipo === 'VISITANTE'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      {item.tipo === 'VISITANTE' ? (
                        <>
                          <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
                          Visitante
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5 text-indigo-600" />
                          Quero ser Membro
                        </>
                      )}
                    </span>

                    <h4 className="text-sm font-bold text-gray-900">{item.nome}</h4>

                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Recebido em {formatTimestampDate(item.createdAt)}
                    </span>
                  </div>

                  {/* Status da Ficha */}
                  <div>
                    {item.status === 'APROVADO' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Aprovado
                      </span>
                    )}
                    {item.status === 'REJEITADO' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                        <XCircle className="h-3.5 w-3.5" />
                        Rejeitado
                      </span>
                    )}
                    {item.status === 'PENDENTE' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Pendente de Aprovação
                      </span>
                    )}
                  </div>
                </div>

                {/* Dados de Contato e Eclesiásticos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-800">{item.telefone}</span>
                  </div>

                  {item.email && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{item.email}</span>
                    </div>
                  )}

                  {item.dataNascimento && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">Nascimento:</span>
                      <span>{formatDate(item.dataNascimento)}</span>
                    </div>
                  )}

                  {item.quemConvidou && (
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-gray-400">Convidado por:</span>
                      <span className="truncate font-medium text-gray-700">{item.quemConvidou}</span>
                    </div>
                  )}
                </div>

                {/* Bloco de Duplicidade Inteligente */}
                {item.duplicidade.isDuplicate && isPending && (
                  <div
                    className={`rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border ${
                      isVisitorDuplicate
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                        : 'bg-rose-50/80 border-rose-200 text-rose-900'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <p className="font-semibold">
                          {isVisitorDuplicate
                            ? `Já cadastrado como Visitante: "${item.duplicidade.membroExistenteNome}"`
                            : `Cadastro similar existente: "${item.duplicidade.membroExistenteNome}" (${item.duplicidade.motivoDuplicidade})`}
                        </p>
                        <p className="opacity-80 text-[11px] mt-0.5">
                          {isVisitorDuplicate
                            ? 'Você pode promover este visitante diretamente a Membro Ativo vinculando os registros.'
                            : 'Verifique se esta pessoa já possui cadastro ativo para evitar duplicidades.'}
                        </p>
                      </div>
                    </div>

                    {isVisitorDuplicate && item.tipo === 'MEMBRO' && (
                      <button
                        type="button"
                        onClick={() => handleAprovar(item.id, item.duplicidade.membroExistenteId)}
                        disabled={actionLoadingId === item.id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-amber-700 active:scale-95 transition-all shrink-0"
                      >
                        {actionLoadingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <LinkIcon className="h-3.5 w-3.5" />
                        )}
                        Vincular ao Visitante Existente
                      </button>
                    )}
                  </div>
                )}

                {/* Observações da Ficha */}
                {item.observacoes && (
                  <div className="rounded-xl bg-gray-50 p-2.5 text-xs text-gray-700 border border-gray-100">
                    <span className="font-semibold text-gray-900">Mensagem / Observação: </span>
                    {item.observacoes}
                  </div>
                )}

                {/* Botões de Ação na Fila de Pendentes */}
                {isPending && (
                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => openRejectModal(item)}
                      disabled={actionLoadingId === item.id}
                      className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
                    >
                      Rejeitar Ficha
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAprovar(item.id)}
                      disabled={actionLoadingId === item.id}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 active:scale-95 transition-all"
                    >
                      {actionLoadingId === item.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Aprovando...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Aprovar Cadastro</span>
                        </>
                      )}
                    </button>
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
          onClose={() => setRejectModal({ isOpen: false, id: null, nome: null, motivo: '', loading: false })}
          size="sm"
        >
          <div className="space-y-4 p-5">
            <p className="text-xs text-gray-600">
              Tem certeza que deseja rejeitar a ficha de <strong>{rejectModal.nome}</strong>? O registro permanecerá salvo como rejeitado para auditoria.
            </p>

            <TextareaField
              label="Motivo da Rejeição (opcional)"
              placeholder="Ex: Dados de contato incorretos, duplicidade..."
              value={rejectModal.motivo}
              onChange={(e) => setRejectModal((prev) => ({ ...prev, motivo: e.target.value }))}
              rows={2}
            />

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRejectModal({ isOpen: false, id: null, nome: null, motivo: '', loading: false })}
                className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={rejectModal.loading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rejectModal.loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Modal de Envio no WhatsApp pós-aprovação */}
      {welcomeModal.isOpen && welcomeModal.membro && (
        <WelcomeActivationModal
          isOpen={welcomeModal.isOpen}
          onClose={() => setWelcomeModal({ isOpen: false, membro: null, user: null, activationLink: null })}
          membro={welcomeModal.membro}
          user={welcomeModal.user}
          activationLink={welcomeModal.activationLink}
          tenantName={tenantName}
        />
      )}
    </div>
  );
}
