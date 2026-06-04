'use client';

import { useState, useEffect } from 'react';
import { useEscalas } from '@/hooks/use-escalas';
import { PageHeader } from '@/components/app/page-header';
import { api } from '@/lib/api';
import { Escala, EscalaDia, EscalaItem, Ministerio, MinisterioFuncao, AuthUser, Membro } from '@/types';

// ─── Utils ────────────────────────────────────────────────────────────────────

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'bg-gray-100 text-gray-600 border-gray-200',
  PUBLICADA: 'bg-green-50 text-green-700 border-green-200',
  ENCERRADA: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  PUBLICADA: 'Publicada',
  ENCERRADA: 'Encerrada',
};

const CONFIRMACAO_COLORS: Record<string, string> = {
  PENDENTE: 'text-amber-600',
  CONFIRMADO: 'text-green-600',
  RECUSADO: 'text-red-500',
};

function formatDayDate(dateStr: string) {
  const d = new Date(dateStr);
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return { dayName: days[d.getUTCDay()], day: d.getUTCDate() };
}

// ─── Grade Mensal ─────────────────────────────────────────────────────────────

interface EscalaGridProps {
  escala: Escala;
  funcoes: MinisterioFuncao[];
  ministryMembers: Membro[];
  canManage: boolean;
  onAddMembro: (diaId: string, membroId: string, funcaoId: string) => Promise<void>;
  onRemoveMembro: (itemId: string) => Promise<void>;
  onAddDia: (data: string, titulo?: string) => Promise<void>;
  onRemoveDia: (diaId: string) => Promise<void>;
}

function EscalaGrid({ escala, funcoes, ministryMembers, canManage, onAddMembro, onRemoveMembro, onAddDia, onRemoveDia }: EscalaGridProps) {
  const [addingDia, setAddingDia] = useState(false);
  const [newDiaDate, setNewDiaDate] = useState('');
  const [newDiaTitulo, setNewDiaTitulo] = useState('');
  const [savingDia, setSavingDia] = useState(false);

  const dias = (escala.dias || []).sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  if (funcoes.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        <p className="font-medium">Nenhuma função cadastrada neste ministério.</p>
        <p className="text-xs mt-1">Vá em Ministérios → Funções para adicionar as colunas da escala.</p>
      </div>
    );
  }

  async function handleSaveDia() {
    if (!newDiaDate) return;
    setSavingDia(true);
    try {
      await onAddDia(newDiaDate, newDiaTitulo || undefined);
      setAddingDia(false);
      setNewDiaDate('');
      setNewDiaTitulo('');
    } finally {
      setSavingDia(false);
    }
  }

  function getMembrosForCell(dia: EscalaDia, funcaoId: string): EscalaItem[] {
    return (dia.itens || []).filter(item => item.ministerioFuncaoId === funcaoId);
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28 border-r border-gray-200">
              Data
            </th>
            {funcoes.map((f) => (
              <th key={f.id} className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[160px]">
                {f.nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {dias.length === 0 ? (
            <tr>
              <td colSpan={funcoes.length + 1} className="text-center py-10 text-sm text-gray-400">
                Nenhum dia adicionado. Use o botão abaixo para adicionar cultos/eventos ao mês.
              </td>
            </tr>
          ) : (
            dias.map((dia) => {
              const { dayName, day } = formatDayDate(dia.data);
              return (
                <tr key={dia.id} className="hover:bg-gray-50/60 transition-colors group">
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50/60 px-4 py-3 border-r border-gray-100">
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <div className="text-xs font-bold text-indigo-600">{dayName}</div>
                        <div className="text-lg font-extrabold text-gray-800 leading-none">{day}</div>
                        {dia.titulo && <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">{dia.titulo}</div>}
                      </div>
                      {canManage && (
                        <button
                          onClick={() => onRemoveDia(dia.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition-all"
                          title="Remover dia"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                  {funcoes.map((funcao) => {
                    const cellItems = getMembrosForCell(dia, funcao.id);
                    return (
                      <td key={funcao.id} className="px-3 py-2 align-top">
                        <div className="space-y-1 min-h-[2rem]">
                          {cellItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-1 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 group/item"
                            >
                              <span className={`text-xs font-semibold truncate ${CONFIRMACAO_COLORS[item.statusConfirmacao]}`}>
                                {item.membro?.nome || '—'}
                              </span>
                              {canManage && (
                                <button
                                  onClick={() => onRemoveMembro(item.id)}
                                  className="opacity-0 group-hover/item:opacity-100 p-0.5 text-indigo-300 hover:text-red-400 transition-all shrink-0"
                                  title="Remover"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                          {canManage && escala.status !== 'ENCERRADA' && (
                            <CellMemberSelect
                              diaId={dia.id}
                              funcaoId={funcao.id}
                              membros={ministryMembers}
                              alreadyAssigned={cellItems.map(i => i.membroId)}
                              onAdd={onAddMembro}
                            />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {canManage && escala.status !== 'ENCERRADA' && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/40">
          {addingDia ? (
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="date"
                value={newDiaDate}
                onChange={(e) => setNewDiaDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              />
              <input
                type="text"
                value={newDiaTitulo}
                onChange={(e) => setNewDiaTitulo(e.target.value)}
                placeholder="Título (ex: Culto da Família)"
                className="flex-1 min-w-[180px] px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              />
              <button
                onClick={handleSaveDia}
                disabled={!newDiaDate || savingDia}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all"
              >
                {savingDia ? 'Salvando...' : 'Adicionar Dia'}
              </button>
              <button onClick={() => setAddingDia(false)} className="text-sm text-gray-400 hover:text-gray-600">
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingDia(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Adicionar Dia
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Cell Select Inline ───────────────────────────────────────────────────────

interface CellMemberSelectProps {
  diaId: string;
  funcaoId: string;
  membros: Membro[];
  alreadyAssigned: string[];
  onAdd: (diaId: string, membroId: string, funcaoId: string) => Promise<void>;
}

function CellMemberSelect({ diaId, funcaoId, membros, alreadyAssigned, onAdd }: CellMemberSelectProps) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const options = membros.filter(m => !alreadyAssigned.includes(m.id));

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const membroId = e.target.value;
    if (!membroId) return;
    setSaving(true);
    try {
      await onAdd(diaId, membroId, funcaoId);
      setValue('');
    } finally {
      setSaving(false);
    }
  }

  if (options.length === 0) return null;

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={saving}
      className="w-full text-xs border border-dashed border-gray-200 bg-transparent rounded-lg px-2 py-1 text-gray-400 hover:border-indigo-300 focus:outline-none focus:border-indigo-400 disabled:opacity-50 cursor-pointer transition-all"
    >
      <option value="">+ membro</option>
      {options.map((m) => (
        <option key={m.id} value={m.id}>{m.nome}</option>
      ))}
    </select>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function EscalasPage() {
  const {
    escalas,
    loading,
    error,
    refetch,
    applyFilter,
    createEscala,
    updateEscala,
    deleteEscala,
    addDia,
    removeDia,
    addMembroItem,
    removeMembroItem,
  } = useEscalas();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [selectedEscala, setSelectedEscala] = useState<Escala | null>(null);
  const [detailedEscala, setDetailedEscala] = useState<Escala | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [ministryMembers, setMinistryMembers] = useState<Membro[]>([]);

  // ─── Filter ──────────────────────────────────────────────────────────────────
  const hoje = new Date();
  const [filterMes, setFilterMes] = useState(String(hoje.getMonth() + 1));
  const [filterAno, setFilterAno] = useState(String(hoje.getFullYear()));
  const [filterMinId, setFilterMinId] = useState('');

  // ─── Create Modal ─────────────────────────────────────────────────────────────
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newMes, setNewMes] = useState(hoje.getMonth() + 1);
  const [newAno, setNewAno] = useState(hoje.getFullYear());
  const [newMinId, setNewMinId] = useState('');
  const [newObs, setNewObs] = useState('');
  const [creating, setCreating] = useState(false);

  // ─── Toast ───────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [aiToastOpen, setAiToastOpen] = useState(false);
  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ─── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get<AuthUser>('/api/auth/me').then(setCurrentUser).catch(() => setCurrentUser(null));
    api.get<Ministerio[]>('/api/ministerios').then(d => setMinisterios(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    applyFilter({ mes: filterMes, ano: filterAno, ministerioId: filterMinId || undefined });
  }, [filterMes, filterAno, filterMinId]);

  async function fetchDetail(escala: Escala) {
    setLoadingDetail(true);
    setDetailedEscala(null);
    setSelectedEscala(escala);
    try {
      const data = await api.get<Escala>(`/api/escalas/${escala.id}`);
      setDetailedEscala(data);

      // Load ministry members
      if (data.ministerioId) {
        const min = await api.get<any>(`/api/ministerios/${data.ministerioId}`);
        setMinistryMembers(min.membros?.map((mm: any) => mm.membro) || []);
      }
    } catch {
      showToast('Erro ao carregar detalhes da escala.', 'error');
    } finally {
      setLoadingDetail(false);
    }
  }

  async function refreshDetail() {
    if (!selectedEscala) return;
    setLoadingDetail(true);
    try {
      const data = await api.get<Escala>(`/api/escalas/${selectedEscala.id}`);
      setDetailedEscala(data);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newMinId) return;
    setCreating(true);
    try {
      await createEscala({ mes: newMes, ano: newAno, ministerioId: newMinId, observacoes: newObs || undefined });
      setIsCreateOpen(false);
      setNewMinId('');
      setNewObs('');
      showToast('Escala mensal criada com sucesso!');
    } catch (err: any) {
      showToast(err.message || 'Erro ao criar escala.', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateStatus(status: string) {
    if (!selectedEscala) return;
    try {
      await updateEscala(selectedEscala.id, { status: status as any });
      await refreshDetail();
      refetch();
      showToast('Status atualizado!');
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar status.', 'error');
    }
  }

  async function handleDelete() {
    if (!selectedEscala) return;
    if (!confirm(`Deletar a escala de ${MESES[selectedEscala.mes - 1]}/${selectedEscala.ano}?`)) return;
    try {
      await deleteEscala(selectedEscala.id);
      setSelectedEscala(null);
      setDetailedEscala(null);
      showToast('Escala removida.');
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover escala.', 'error');
    }
  }

  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'STAFF' || currentUser?.role === 'BASIC';

  const funcoes = detailedEscala?.ministerio?.funcoes || [];
  const anos = Array.from({ length: 4 }, (_, i) => hoje.getFullYear() - 1 + i);

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium border animate-in slide-in-from-bottom-3 ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            {toast.type === 'success'
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            }
          </svg>
          {toast.msg}
        </div>
      )}

      {/* Dialog: Escala com IA — Em breve */}
      {aiToastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Escala Automática com IA</h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  Em breve · Fase 2
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              Em breve você poderá gerar escalas completas automaticamente. A IA vai considerar disponibilidade dos membros, histórico de participação e funções no ministério para montar a grade do mês.
            </p>
            <div className="space-y-2">
              {[
                'Respeita disponibilidade e preferências de cada membro',
                'Evita conflitos de data e funções duplicadas',
                'O líder revisa e aprova antes de publicar',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-gray-600">
                  <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setAiToastOpen(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="Escalas"
        description="Gerencie as escalas mensais por ministério. Defina os cultos e aloque os membros por função."
        action={
          canManage ? (
            <div className="flex items-center gap-2">
              <button
                title="Em breve: geração automática de escalas com IA"
                onClick={() => setAiToastOpen(true)}
                className="px-4 py-2 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-semibold rounded-xl text-sm flex items-center gap-2 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Gerar com IA
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-500 leading-none">
                  Em breve
                </span>
              </button>
              <button
                id="btn-nova-escala"
                onClick={() => setIsCreateOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm text-sm flex items-center gap-2 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nova Escala
              </button>
            </div>
          ) : undefined
        }
      />

      {/* ─── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-xs">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Mês</label>
          <select
            id="filter-mes"
            value={filterMes}
            onChange={(e) => setFilterMes(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
          >
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Ano</label>
          <select
            id="filter-ano"
            value={filterAno}
            onChange={(e) => setFilterAno(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
          >
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Ministério</label>
          <select
            id="filter-ministerio"
            value={filterMinId}
            onChange={(e) => setFilterMinId(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
          >
            <option value="">Todos</option>
            {ministerios.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl flex justify-between items-center">
          {error}
          <button onClick={refetch} className="underline font-semibold hover:text-red-800">Recarregar</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Lista de Escalas ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide px-1">
            {MESES[parseInt(filterMes) - 1]} / {filterAno}
          </h2>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
            </div>
          ) : escalas.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
              <p className="font-medium">Nenhuma escala para este período.</p>
              {canManage && <p className="text-xs mt-1">Crie uma nova escala para começar.</p>}
            </div>
          ) : (
            escalas.map((e) => (
              <button
                key={e.id}
                id={`escala-card-${e.id}`}
                onClick={() => fetchDetail(e)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  selectedEscala?.id === e.id
                    ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                    : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{e.ministerio?.nome || '—'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{MESES[e.mes - 1]} / {e.ano}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[e.status]}`}>
                    {STATUS_LABELS[e.status]}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  {e._count?.dias ?? 0} {e._count?.dias === 1 ? 'dia' : 'dias'} cadastrado{e._count?.dias === 1 ? '' : 's'}
                </div>
              </button>
            ))
          )}
        </div>

        {/* ─── Grade da Escala ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          {!selectedEscala ? (
            <div className="flex items-center justify-center h-full min-h-[300px] bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <div className="text-center text-sm text-gray-400 space-y-1">
                <svg className="w-10 h-10 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="font-medium">Selecione uma escala ao lado</p>
                <p className="text-xs">para visualizar e editar a grade mensal</p>
              </div>
            </div>
          ) : loadingDetail ? (
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-gray-100 rounded-2xl" />
              <div className="h-64 bg-gray-50 rounded-2xl border border-gray-100" />
            </div>
          ) : detailedEscala ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-xs flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-base font-bold text-gray-800">
                    {detailedEscala.ministerio?.nome} — {MESES[detailedEscala.mes - 1]} {detailedEscala.ano}
                  </h2>
                  {detailedEscala.observacoes && (
                    <p className="text-xs text-gray-500 mt-0.5">{detailedEscala.observacoes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_COLORS[detailedEscala.status]}`}>
                    {STATUS_LABELS[detailedEscala.status]}
                  </span>
                  {canManage && (
                    <>
                      {detailedEscala.status === 'RASCUNHO' && (
                        <button
                          id="btn-publicar-escala"
                          onClick={() => handleUpdateStatus('PUBLICADA')}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all"
                        >
                          Publicar
                        </button>
                      )}
                      {detailedEscala.status === 'PUBLICADA' && (
                        <button
                          onClick={() => handleUpdateStatus('ENCERRADA')}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-gray-700 hover:bg-gray-800 rounded-xl transition-all"
                        >
                          Encerrar
                        </button>
                      )}
                      <button
                        onClick={handleDelete}
                        className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-100 hover:bg-red-50 rounded-xl transition-all"
                      >
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Grid */}
              <EscalaGrid
                escala={detailedEscala}
                funcoes={funcoes}
                ministryMembers={ministryMembers}
                canManage={canManage}
                onAddMembro={async (diaId, membroId, funcaoId) => {
                  await addMembroItem(diaId, membroId, funcaoId);
                  await refreshDetail();
                }}
                onRemoveMembro={async (itemId) => {
                  await removeMembroItem(itemId);
                  await refreshDetail();
                }}
                onAddDia={async (data, titulo) => {
                  await addDia(detailedEscala.id, data, titulo);
                  await refreshDetail();
                }}
                onRemoveDia={async (diaId) => {
                  if (!confirm('Remover este dia e todas as alocações?')) return;
                  await removeDia(diaId);
                  await refreshDetail();
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* ─── Modal Criar Escala ───────────────────────────────────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Nova Escala Mensal</h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Mês *</label>
                  <select
                    id="create-mes"
                    value={newMes}
                    onChange={(e) => setNewMes(parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                  >
                    {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Ano *</label>
                  <select
                    id="create-ano"
                    value={newAno}
                    onChange={(e) => setNewAno(parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                  >
                    {anos.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Ministério *</label>
                <select
                  id="create-ministerio"
                  value={newMinId}
                  required
                  onChange={(e) => setNewMinId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                >
                  <option value="">Selecione um ministério</option>
                  {ministerios.filter(m => m.ativo).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Observações</label>
                <textarea
                  value={newObs}
                  onChange={(e) => setNewObs(e.target.value)}
                  rows={2}
                  placeholder="Notas gerais para esta escala..."
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-criar-escala-submit"
                  disabled={creating || !newMinId}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar Escala'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
