'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { InputField, SelectField } from '@/components/app/form-field';
import { Escala, MinisterioMembro } from '@/types';
import { getDias, getFuncoes, getItens, isFuncaoOculta, MemberChip } from './escala-shared';
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

  async function moveDia(diaId: string, direction: -1 | 1) {
    const currentIndex = dias.findIndex((dia) => dia.id === diaId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= dias.length) return;

    const nextOrder = dias.map((dia) => dia.id);
    const [movedId] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(nextIndex, 0, movedId);
    setOrderedDiaIds(nextOrder);
    await onReorderDias(nextOrder);
  }

  return (
    <>
    <div className="space-y-3 md:hidden">
      {dias.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">
          {tGrid('noDays')}
        </div>
      ) : (
        dias.map((dia, diaIndex) => {
          const { dayName, day } = formatDayDate(dia.data);
          const canDrag = canManage && escala.status === 'RASCUNHO';
          return (
            <section key={dia.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-indigo-600">{dayName}</p>
                  <p className="text-lg font-extrabold leading-none text-gray-900">{day}</p>
                  {dia.titulo && <p className="mt-1 text-xs text-gray-500">{dia.titulo}</p>}
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    {canDrag && (
                      <>
                        <button
                          type="button"
                          onClick={() => moveDia(dia.id, -1)}
                          disabled={diaIndex === 0}
                          title={tGrid('dragHandle')}
                          className="rounded-lg border border-gray-100 p-1.5 text-gray-300 transition-colors hover:text-indigo-500 disabled:opacity-30"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDia(dia.id, 1)}
                          disabled={diaIndex === dias.length - 1}
                          title={tGrid('dragHandle')}
                          className="rounded-lg border border-gray-100 p-1.5 text-gray-300 transition-colors hover:text-indigo-500 disabled:opacity-30"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveDia(dia.id)}
                      className="rounded-lg border border-red-100 p-1.5 text-red-400 transition-colors hover:bg-red-50"
                      title={tGrid('removeDay')}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {funcoes.map((funcao) => {
                  const cellItems = getItens(dia, funcao.id);
                  const dayAssignedMemberIds = (dia.itens || []).map((item) => item.membroId);
                  const isOculta = isFuncaoOculta(dia, funcao.id);
                  return (
                    <div key={funcao.id} className="border-t border-gray-100 pt-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase text-gray-500">{funcao.nome}</p>
                        {canManage && escala.status !== 'ENCERRADA' && (
                          <button
                            type="button"
                            onClick={() => onToggleCelula(dia.id, funcao.id, !isOculta)}
                            title={isOculta ? `Mostrar ${funcao.nome} neste dia` : `Ocultar ${funcao.nome} neste dia`}
                            className="rounded-lg border border-gray-100 p-1.5 text-gray-300 transition-colors hover:text-indigo-500"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              {isOculta ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              )}
                            </svg>
                          </button>
                        )}
                      </div>

                      {isOculta ? (
                        <span className="text-xs font-semibold text-gray-300">Indisponivel</span>
                      ) : (
                        <div className="space-y-2">
                          {cellItems.length > 0 ? (
                            <div className="space-y-1.5">
                              {cellItems.map((item) => (
                                <div key={item.id} className="flex items-start gap-2">
                                  <div className="min-w-0 flex-1">
                                    <MemberChip item={item} />
                                  </div>
                                  {canManage && (
                                    <button
                                      type="button"
                                      onClick={() => onRemoveMembro(item.id)}
                                      className="rounded-lg border border-red-100 p-1.5 text-red-400 transition-colors hover:bg-red-50"
                                    >
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">Sem membro escalado</span>
                          )}
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
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {canManage && escala.status !== 'ENCERRADA' && (
        <div className="rounded-lg border border-gray-200 bg-gray-50/40 px-4 py-3">
          <AddDayControls
            addingDia={addingDia}
            setAddingDia={setAddingDia}
            newDiaDate={newDiaDate}
            setNewDiaDate={setNewDiaDate}
            newDiaTitulo={newDiaTitulo}
            setNewDiaTitulo={setNewDiaTitulo}
            savingDia={savingDia}
            handleSaveDia={handleSaveDia}
            tGrid={tGrid}
          />
        </div>
      )}
    </div>

    <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 shadow-sm md:block">
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
                          type="button"
                          onClick={() => onRemoveDia(dia.id)}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-100 bg-white text-red-400 opacity-70 transition-all hover:bg-red-50 hover:text-red-600 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                          title={tGrid('removeDay')}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                                type="button"
                                onClick={() => onToggleCelula(dia.id, funcao.id, false)}
                                title={`Mostrar ${funcao.nome} neste dia`}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-indigo-100 bg-white text-indigo-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="relative min-h-[2rem] space-y-1 pr-8 group/cell">
                            {canManage && escala.status !== 'ENCERRADA' && (
                              <button
                                type="button"
                                onClick={() => onToggleCelula(dia.id, funcao.id, true)}
                                title={`Ocultar ${funcao.nome} neste dia`}
                                className="absolute right-0 top-0 z-10 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-100 bg-white text-red-300 opacity-0 shadow-sm transition-all hover:bg-red-50 hover:text-red-600 group-hover/cell:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
                                    type="button"
                                    onClick={() => onRemoveMembro(item.id)}
                                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-red-100 bg-white text-red-300 opacity-70 transition-all hover:bg-red-50 hover:text-red-600 hover:opacity-100 group-hover/item:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                                  >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
          <AddDayControls
            addingDia={addingDia}
            setAddingDia={setAddingDia}
            newDiaDate={newDiaDate}
            setNewDiaDate={setNewDiaDate}
            newDiaTitulo={newDiaTitulo}
            setNewDiaTitulo={setNewDiaTitulo}
            savingDia={savingDia}
            handleSaveDia={handleSaveDia}
            tGrid={tGrid}
          />
        </div>
      )}
    </div>
    </>
  );
}

interface AddDayControlsProps {
  addingDia: boolean;
  setAddingDia: (value: boolean) => void;
  newDiaDate: string;
  setNewDiaDate: (value: string) => void;
  newDiaTitulo: string;
  setNewDiaTitulo: (value: string) => void;
  savingDia: boolean;
  handleSaveDia: () => void;
  tGrid: ReturnType<typeof useTranslations>;
}

function AddDayControls({
  addingDia,
  setAddingDia,
  newDiaDate,
  setNewDiaDate,
  newDiaTitulo,
  setNewDiaTitulo,
  savingDia,
  handleSaveDia,
  tGrid,
}: AddDayControlsProps) {
  if (!addingDia) {
    return (
      <button
        onClick={() => setAddingDia(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        {tGrid('addDay')}
      </button>
    );
  }

  return (
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
