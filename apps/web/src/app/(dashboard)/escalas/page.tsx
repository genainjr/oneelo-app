'use client';

import React, { useState, useEffect } from 'react';
import { useEscalas } from '@/hooks/use-escalas';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/page-header';
import { api } from '@/lib/api';
import { Escala, EscalaDia, EscalaItem, Ministerio, MinisterioFuncao, MinisterioMembro, AuthUser } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'bg-gray-100 text-gray-600 border-gray-200',
  PUBLICADA: 'bg-green-50 text-green-700 border-green-200',
  ENCERRADA: 'bg-red-50 text-red-700 border-red-200',
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
  ministryMembers: MinisterioMembro[];
  canManage: boolean;
  onAddMembro: (diaId: string, membroId: string, funcaoId: string) => Promise<void>;
  onRemoveMembro: (itemId: string) => Promise<void>;
  onAddDia: (data: string, titulo?: string) => Promise<void>;
  onRemoveDia: (diaId: string) => Promise<void>;
  onReorderDias: (diaIds: string[]) => Promise<void>;
  onToggleCelula: (diaId: string, funcaoId: string, ocultar: boolean) => void;
  tGrid: ReturnType<typeof useTranslations>;
}

function EscalaGrid({ escala, funcoes, ministryMembers, canManage, onAddMembro, onRemoveMembro, onAddDia, onRemoveDia, onReorderDias, onToggleCelula, tGrid }: EscalaGridProps) {
  const [addingDia, setAddingDia] = useState(false);
  const [newDiaDate, setNewDiaDate] = useState('');
  const [newDiaTitulo, setNewDiaTitulo] = useState('');
  const [savingDia, setSavingDia] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragIdRef = React.useRef<string | null>(null);

  const [dias, setDias] = useState<EscalaDia[]>([]);
  React.useEffect(() => {
    setDias((escala.dias || []).slice().sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0)));
  }, [escala.dias]);

  if (funcoes.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        <p className="font-medium">{tGrid('noFunctions')}</p>
        <p className="text-xs mt-1">{tGrid('noFunctionsDesc')}</p>
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
              {tGrid('date')}
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
                {tGrid('noDays')}
              </td>
            </tr>
          ) : (
            dias.map((dia) => {
              const { dayName, day } = formatDayDate(dia.data);
              const isDragOver = dragOverId === dia.id;
              const canDrag = canManage && escala.status === 'RASCUNHO';
              return (
                <tr
                  key={dia.id}
                  draggable={canDrag}
                  onDragStart={canDrag ? () => { dragIdRef.current = dia.id; } : undefined}
                  onDragOver={canDrag ? (e) => { e.preventDefault(); setDragOverId(dia.id); } : undefined}
                  onDragLeave={canDrag ? () => setDragOverId(null) : undefined}
                  onDrop={canDrag ? async () => {
                    setDragOverId(null);
                    const fromId = dragIdRef.current;
                    dragIdRef.current = null;
                    if (!fromId || fromId === dia.id) return;
                    const newOrder = dias.map(d => d.id);
                    const fromIdx = newOrder.indexOf(fromId);
                    const toIdx = newOrder.indexOf(dia.id);
                    newOrder.splice(fromIdx, 1);
                    newOrder.splice(toIdx, 0, fromId);
                    setDias(dias.slice().sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id)));
                    await onReorderDias(newOrder);
                  } : undefined}
                  className={`hover:bg-gray-50/60 transition-colors group ${isDragOver ? 'border-t-2 border-indigo-400' : ''}`}
                >
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50/60 px-4 py-3 border-r border-gray-100">
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-start gap-1.5">
                        {canDrag && (
                          <span className="mt-1 cursor-grab text-gray-300 hover:text-gray-400 shrink-0" title={tGrid('dragHandle')}>
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                              <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                              <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                            </svg>
                          </span>
                        )}
                        <div>
                          <div className="text-xs font-bold text-indigo-600">{dayName}</div>
                          <div className="text-lg font-extrabold text-gray-800 leading-none">{day}</div>
                          {dia.titulo && <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">{dia.titulo}</div>}
                        </div>
                      </div>
                      {canManage && (
                        <button
                          onClick={() => onRemoveDia(dia.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition-all"
                          title={tGrid('removeDay')}
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
                    const dayAssignedMemberIds = (dia.itens || []).map((item) => item.membroId);
                    const isOculta = dia.funcoesOcultas?.some((o) => o.funcaoId === funcao.id) ?? false;
                    return (
                      <td key={funcao.id} className="px-3 py-2 align-top">
                        {isOculta ? (
                          <div className="flex items-center gap-1.5 h-8">
                            <span className="text-gray-300 font-bold">—</span>
                            {canManage && (
                              <button
                                onClick={() => onToggleCelula(dia.id, funcao.id, false)}
                                title={`Mostrar ${funcao.nome} neste dia`}
                                className="text-gray-300 hover:text-indigo-500 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1 min-h-[2rem] relative group/cell">
                            {canManage && escala.status !== 'ENCERRADA' && (
                              <button
                                onClick={() => onToggleCelula(dia.id, funcao.id, true)}
                                title={`Ocultar ${funcao.nome} neste dia`}
                                className="absolute top-0 right-0 opacity-0 group-hover/cell:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition-all"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
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
                                alreadyAssigned={dayAssignedMemberIds}
                                onAdd={onAddMembro}
                                addMemberLabel={tGrid('addMember')}
                              />
                            )}
                          </div>
                        )}
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
                placeholder={tGrid('addDayTitlePlaceholder')}
                className="flex-1 min-w-[180px] px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              />
              <button
                onClick={handleSaveDia}
                disabled={!newDiaDate || savingDia}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all"
              >
                {tGrid('addDay')}
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
              {tGrid('addDay')}
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
  membros: MinisterioMembro[];
  alreadyAssigned: string[];
  onAdd: (diaId: string, membroId: string, funcaoId: string) => Promise<void>;
  addMemberLabel: string;
}

function CellMemberSelect({ diaId, funcaoId, membros, alreadyAssigned, onAdd, addMemberLabel }: CellMemberSelectProps) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const options = membros
    .filter((mm) => {
      if (alreadyAssigned.includes(mm.membroId)) return false;
      if (!mm.funcoesDisponiveis?.length) return true;
      return mm.funcoesDisponiveis.some((fd) => fd.funcaoId === funcaoId);
    })
    .sort((a, b) => (a.membro?.nome ?? '').localeCompare(b.membro?.nome ?? '', 'pt-BR'));

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
      <option value="">{addMemberLabel}</option>
      {options.map((mm) => (
        <option key={mm.membroId} value={mm.membroId}>{mm.membro?.nome}</option>
      ))}
    </select>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function EscalasPage() {
  const t = useTranslations('schedules');
  const tGrid = useTranslations('schedules.grid');

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
    reorderDias,
    addMembroItem,
    removeMembroItem,
    toggleCelula,
  } = useEscalas();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [selectedEscala, setSelectedEscala] = useState<Escala | null>(null);
  const [detailedEscala, setDetailedEscala] = useState<Escala | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [ministryMembers, setMinistryMembers] = useState<MinisterioMembro[]>([]);

  const hoje = new Date();
  const [filterMes, setFilterMes] = useState(String(hoje.getMonth() + 1));
  const [filterAno, setFilterAno] = useState(String(hoje.getFullYear()));
  const [filterMinId, setFilterMinId] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newMes, setNewMes] = useState(hoje.getMonth() + 1);
  const [newAno, setNewAno] = useState(hoje.getFullYear());
  const [newMinId, setNewMinId] = useState('');
  const [newObs, setNewObs] = useState('');
  const [newDiasSemana, setNewDiasSemana] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [aiToastOpen, setAiToastOpen] = useState(false);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

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
      if (data.ministerioId) {
        const min = await api.get<any>(`/api/ministerios/${data.ministerioId}`);
        setMinistryMembers(min.membros || []);
      }
    } catch {
      showToast(t('errorLoadDetail'), 'error');
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
      const created = await createEscala({
        mes: newMes,
        ano: newAno,
        ministerioId: newMinId,
        observacoes: newObs || undefined,
        diasSemana: newDiasSemana.length ? newDiasSemana : undefined,
      });
      setIsCreateOpen(false);
      setNewMinId('');
      setNewObs('');
      setNewDiasSemana([]);
      showToast('Escala mensal criada com sucesso!');
      fetchDetail(created);
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
    const mesNome = t(`months.${selectedEscala.mes}` as any);
    if (!confirm(t('deleteConfirm', { month: mesNome, year: selectedEscala.ano }))) return;
    try {
      await deleteEscala(selectedEscala.id);
      setSelectedEscala(null);
      setDetailedEscala(null);
      showToast('Escala removida.');
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover escala.', 'error');
    }
  }

  async function handleToggleCelula(diaId: string, funcaoId: string, ocultar: boolean) {
    // Atualização otimista
    setDetailedEscala((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dias: prev.dias?.map((dia) => {
          if (dia.id !== diaId) return dia;
          const atuais = dia.funcoesOcultas ?? [];
          const novas = ocultar
            ? [...atuais, { funcaoId }]
            : atuais.filter((o) => o.funcaoId !== funcaoId);
          return { ...dia, funcoesOcultas: novas };
        }),
      };
    });

    try {
      await toggleCelula(diaId, funcaoId, ocultar);
    } catch {
      showToast('Erro ao atualizar célula.', 'error');
      await refreshDetail();
    }
  }

  function appendEscalaItem(diaId: string, item: EscalaItem) {
    setDetailedEscala((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        dias: prev.dias?.map((dia) => {
          if (dia.id !== diaId) return dia;

          const itens = dia.itens ?? [];
          const nextItens = itens.some((current) => current.id === item.id)
            ? itens.map((current) => (current.id === item.id ? item : current))
            : [...itens, item];

          return { ...dia, itens: nextItens };
        }),
      };
    });
  }

  function removeEscalaItem(itemId: string) {
    setDetailedEscala((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        dias: prev.dias?.map((dia) => ({
          ...dia,
          itens: dia.itens?.filter((item) => item.id !== itemId) ?? [],
        })),
      };
    });
  }

  const canManageTenant = currentUser?.role === 'ADMIN' || currentUser?.role === 'STAFF';
  const ledMinisterioIds = new Set(ministerios.map((m) => m.id));
  const canCreateEscala =
    canManageTenant ||
    (currentUser?.role === 'BASIC' && ledMinisterioIds.size > 0);
  const canManageSelectedEscala =
    canManageTenant ||
    (currentUser?.role === 'BASIC' &&
      !!detailedEscala?.ministerioId &&
      ledMinisterioIds.has(detailedEscala.ministerioId));
  const funcoes = detailedEscala?.ministerio?.funcoes || [];
  const anos = Array.from({ length: 4 }, (_, i) => hoje.getFullYear() - 1 + i);

  const MESES_KEYS = [1,2,3,4,5,6,7,8,9,10,11,12] as const;
  const DIAS_SEMANA = [
    { key: '0', value: 0 },
    { key: '1', value: 1 },
    { key: '2', value: 2 },
    { key: '3', value: 3 },
    { key: '4', value: 4 },
    { key: '5', value: 5 },
    { key: '6', value: 6 },
  ];

  const STATUS_LABELS: Record<string, string> = {
    RASCUNHO: t('status.RASCUNHO'),
    PUBLICADA: t('status.PUBLICADA'),
    ENCERRADA: t('status.ENCERRADA'),
  };

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
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
                <h3 className="font-bold text-gray-800">{t('ai.title')}</h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  {t('ai.badge')}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">{t('ai.description')}</p>
            <div className="space-y-2">
              {[t('ai.feature1'), t('ai.feature2'), t('ai.feature3')].map((item) => (
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
                {t('ai.understood')}
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          canCreateEscala ? (
            <div className="flex items-center gap-2">
              <button
                title={t('aiComingSoon')}
                onClick={() => setAiToastOpen(true)}
                className="px-4 py-2 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-semibold rounded-xl text-sm flex items-center gap-2 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t('generateAI')}
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-500 leading-none">
                  {t('aiComingSoon')}
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
                {t('new')}
              </button>
            </div>
          ) : undefined
        }
      />

      {/* ─── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-xs">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase">{t('filter.month')}</label>
          <select
            id="filter-mes"
            value={filterMes}
            onChange={(e) => setFilterMes(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
          >
            {MESES_KEYS.map((m) => <option key={m} value={m}>{t(`months.${m}`)}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase">{t('filter.year')}</label>
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
          <label className="text-xs font-bold text-gray-500 uppercase">{t('filter.ministry')}</label>
          <select
            id="filter-ministerio"
            value={filterMinId}
            onChange={(e) => setFilterMinId(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
          >
            <option value="">{t('filter.all')}</option>
            {ministerios.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl flex justify-between items-center">
          {t('errorLoading')}
          <button onClick={refetch} className="underline font-semibold hover:text-red-800">Recarregar</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Lista de Escalas ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide px-1">
            {t(`months.${parseInt(filterMes)}` as any)} / {filterAno}
          </h2>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
            </div>
          ) : escalas.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
              <p className="font-medium">{t('noSchedules')}</p>
              {canCreateEscala && <p className="text-xs mt-1">{t('noSchedulesDesc')}</p>}
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
                    <p className="text-xs text-gray-500 mt-0.5">{t(`months.${e.mes}` as any)} / {e.ano}</p>
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
                <p className="font-medium">{t('selectSchedule')}</p>
                <p className="text-xs">{t('selectScheduleDesc')}</p>
              </div>
            </div>
          ) : loadingDetail ? (
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-gray-100 rounded-2xl" />
              <div className="h-64 bg-gray-50 rounded-2xl border border-gray-100" />
            </div>
          ) : detailedEscala ? (
            <div className="space-y-4">
              <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-xs flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-base font-bold text-gray-800">
                    {detailedEscala.ministerio?.nome} — {t(`months.${detailedEscala.mes}` as any)} {detailedEscala.ano}
                  </h2>
                  {detailedEscala.observacoes && (
                    <p className="text-xs text-gray-500 mt-0.5">{detailedEscala.observacoes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_COLORS[detailedEscala.status]}`}>
                    {STATUS_LABELS[detailedEscala.status]}
                  </span>
                  {canManageSelectedEscala && (
                    <>
                      {detailedEscala.status === 'RASCUNHO' && (
                        <button
                          id="btn-publicar-escala"
                          onClick={() => handleUpdateStatus('PUBLICADA')}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all"
                        >
                          {t('status.PUBLICADA')}
                        </button>
                      )}
                      {detailedEscala.status === 'PUBLICADA' && (
                        <button
                          onClick={() => handleUpdateStatus('ENCERRADA')}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-gray-700 hover:bg-gray-800 rounded-xl transition-all"
                        >
                          {t('status.ENCERRADA')}
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

              <EscalaGrid
                escala={detailedEscala}
                funcoes={funcoes}
                ministryMembers={ministryMembers}
                canManage={canManageSelectedEscala}
                tGrid={tGrid}
                onToggleCelula={handleToggleCelula}
                onAddMembro={async (diaId, membroId, funcaoId) => {
                  try {
                    const item = await addMembroItem(diaId, membroId, funcaoId);
                    appendEscalaItem(diaId, item);
                  } catch (err: any) {
                    showToast(err.message || 'Erro ao adicionar membro na escala.', 'error');
                    throw err;
                  }
                }}
                onRemoveMembro={async (itemId) => {
                  try {
                    await removeMembroItem(itemId);
                    removeEscalaItem(itemId);
                  } catch (err: any) {
                    showToast(err.message || 'Erro ao remover membro da escala.', 'error');
                    throw err;
                  }
                }}
                onAddDia={async (data, titulo) => {
                  await addDia(detailedEscala.id, data, titulo);
                  await refreshDetail();
                }}
                onRemoveDia={async (diaId) => {
                  if (!confirm(tGrid('removeDayConfirm'))) return;
                  await removeDia(diaId);
                  await refreshDetail();
                }}
                onReorderDias={async (diaIds) => {
                  await reorderDias(detailedEscala.id, diaIds);
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
              <h2 className="text-base font-bold text-gray-800">{t('modal.title')}</h2>
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
                  <label className="text-xs font-bold text-gray-500 uppercase">{t('modal.month')} *</label>
                  <select
                    id="create-mes"
                    value={newMes}
                    onChange={(e) => setNewMes(parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                  >
                    {MESES_KEYS.map((m) => <option key={m} value={m}>{t(`months.${m}`)}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">{t('modal.year')} *</label>
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
                <label className="text-xs font-bold text-gray-500 uppercase">{t('modal.ministry')} *</label>
                <select
                  id="create-ministerio"
                  value={newMinId}
                  required
                  onChange={(e) => setNewMinId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                >
                  <option value="">{t('modal.ministryPlaceholder')}</option>
                  {ministerios.filter(m => m.ativo).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">{t('modal.weekdays')}</label>
                <p className="text-xs text-gray-400">{t('modal.weekdaysDesc')}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {DIAS_SEMANA.map(({ key, value }) => {
                    const selected = newDiasSemana.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setNewDiasSemana(prev =>
                          selected ? prev.filter(d => d !== value) : [...prev, value]
                        )}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all select-none ${
                          selected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                      >
                        {t(`modal.days.${key}` as any)}
                      </button>
                    );
                  })}
                </div>
                {newDiasSemana.length > 0 && (() => {
                  const totalDias = new Date(newAno, newMes, 0).getDate();
                  let count = 0;
                  for (let d = 1; d <= totalDias; d++) {
                    if (newDiasSemana.includes(new Date(newAno, newMes - 1, d).getDay())) count++;
                  }
                  return (
                    <p className="text-xs text-indigo-600 font-semibold">
                      {count === 1 ? t('modal.dayGenerated', { count }) : t('modal.daysGenerated', { count })}
                    </p>
                  );
                })()}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">{t('modal.notes')}</label>
                <textarea
                  value={newObs}
                  onChange={(e) => setNewObs(e.target.value)}
                  rows={2}
                  placeholder={t('modal.notesPlaceholder')}
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
                  {creating ? t('modal.creating') : t('modal.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
