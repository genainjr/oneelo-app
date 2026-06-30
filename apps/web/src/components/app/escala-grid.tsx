'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { InputField, SelectField } from '@/components/app/form-field';
import { Escala, MinisterioMembro } from '@/types';
import { getDias, getFuncoes, getItens, isFuncaoOculta } from './escala-shared';
import { STATUS_CONFIRMACAO_COLOR } from '@/lib/utils';

interface EscalaGridProps {
  escala: Escala;
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

function formatDayDate(dateStr: string) {
  const date = new Date(dateStr);
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  return { dayName: days[date.getUTCDay()], day: date.getUTCDate() };
}

export function EscalaGrid({
  escala,
  ministryMembers,
  canManage,
  onAddMembro,
  onRemoveMembro,
  onAddDia,
  onRemoveDia,
  onReorderDias,
  onToggleCelula,
  tGrid,
}: EscalaGridProps) {
  const funcoes = getFuncoes(escala);
  const [addingDia, setAddingDia] = useState(false);
  const [newDiaDate, setNewDiaDate] = useState('');
  const [newDiaTitulo, setNewDiaTitulo] = useState('');
  const [savingDia, setSavingDia] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [orderedDiaIds, setOrderedDiaIds] = useState<string[] | null>(null);
  const baseDias = useMemo(() => getDias(escala), [escala]);
  const dias = useMemo(() => {
    if (!orderedDiaIds) return baseDias;
    const sameSet =
      orderedDiaIds.length === baseDias.length &&
      baseDias.every((dia) => orderedDiaIds.includes(dia.id));

    if (!sameSet) return baseDias;
    return baseDias.slice().sort((a, b) => orderedDiaIds.indexOf(a.id) - orderedDiaIds.indexOf(b.id));
  }, [baseDias, orderedDiaIds]);

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

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28 border-r border-gray-200">
              {tGrid('date')}
            </th>
            {funcoes.map((funcao) => (
              <th key={funcao.id} className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[160px]">
                {funcao.nome}
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
                  onDragOver={canDrag ? (event) => { event.preventDefault(); setDragOverId(dia.id); } : undefined}
                  onDragLeave={canDrag ? () => setDragOverId(null) : undefined}
                  onDrop={canDrag ? async () => {
                    setDragOverId(null);
                    const fromId = dragIdRef.current;
                    dragIdRef.current = null;
                    if (!fromId || fromId === dia.id) return;
                    const newOrder = dias.map((currentDia) => currentDia.id);
                    const fromIdx = newOrder.indexOf(fromId);
                    const toIdx = newOrder.indexOf(dia.id);
                    newOrder.splice(fromIdx, 1);
                    newOrder.splice(toIdx, 0, fromId);
                    setOrderedDiaIds(newOrder);
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
                              <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                              <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                              <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
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
                    const cellItems = getItens(dia, funcao.id);
                    const dayAssignedMemberIds = (dia.itens || []).map((item) => item.membroId);
                    const isOculta = isFuncaoOculta(dia, funcao.id);
                    return (
                      <td key={funcao.id} className="px-3 py-2 align-top">
                        {isOculta ? (
                          <div className="flex items-center gap-1.5 h-8">
                            <span className="text-gray-300 font-bold">-</span>
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
                                <span className={`text-xs font-semibold truncate ${STATUS_CONFIRMACAO_COLOR[item.statusConfirmacao]}`}>
                                  {item.membro?.nome || '-'}
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
            <div className="flex items-start gap-3 flex-wrap">
              <InputField
                label={tGrid('date')}
                hideLabel
                type="date"
                value={newDiaDate}
                onChange={(event) => setNewDiaDate(event.target.value)}
                className="px-3 py-1.5 bg-white border-gray-200 text-sm focus:border-indigo-400"
              />
              <InputField
                label={tGrid('addDayTitlePlaceholder')}
                hideLabel
                type="text"
                value={newDiaTitulo}
                onChange={(event) => setNewDiaTitulo(event.target.value)}
                placeholder={tGrid('addDayTitlePlaceholder')}
                className="px-3 py-1.5 bg-white border-gray-200 text-sm focus:border-indigo-400"
              />
              <button
                onClick={handleSaveDia}
                disabled={!newDiaDate || savingDia}
                className="mt-6 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all"
              >
                {tGrid('addDay')}
              </button>
              <button onClick={() => setAddingDia(false)} className="mt-6 text-sm text-gray-400 hover:text-gray-600">
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
    .filter((ministerioMembro) => {
      if (alreadyAssigned.includes(ministerioMembro.membroId)) return false;
      if (!ministerioMembro.funcoesDisponiveis?.length) return true;
      return ministerioMembro.funcoesDisponiveis.some((funcao) => funcao.funcaoId === funcaoId);
    })
    .sort((a, b) => (a.membro?.nome ?? '').localeCompare(b.membro?.nome ?? '', 'pt-BR'));

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const membroId = event.target.value;
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
    <SelectField
      label={addMemberLabel}
      hideLabel
      value={value}
      onChange={handleChange}
      disabled={saving}
      className="w-full text-xs border-dashed border-gray-200 bg-transparent rounded-lg px-2 py-1 text-gray-400 hover:border-indigo-300 focus:border-indigo-400 cursor-pointer"
    >
      <option value="">{addMemberLabel}</option>
      {options.map((ministerioMembro) => (
        <option key={ministerioMembro.membroId} value={ministerioMembro.membroId}>
          {ministerioMembro.membro?.nome}
        </option>
      ))}
    </SelectField>
  );
}
