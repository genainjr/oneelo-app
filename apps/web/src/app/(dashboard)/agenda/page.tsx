'use client';

import { useState, useEffect } from 'react';
import { useEventos, FilterEventos } from '@/hooks/use-eventos';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { api } from '@/lib/api';
import { Evento, AuthUser } from '@/types';
import { formatDate } from '@/lib/utils';

export default function AgendaPage() {
  const {
    eventos,
    loading,
    error,
    refetch,
    applyFilter,
    createEvento,
    updateEvento,
    deleteEvento,
  } = useEventos();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [local, setLocal] = useState('');
  const [status, setStatus] = useState<'AGENDADO' | 'REALIZADO' | 'CANCELADO'>('AGENDADO');

  // Filter states
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  useEffect(() => {
    api.get<AuthUser>('/api/auth/me')
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'STAFF';

  // Handle Save
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !dataInicio) return;

    try {
      const payload: any = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        dataInicio: new Date(dataInicio).toISOString(),
        dataFim: dataFim ? new Date(dataFim).toISOString() : undefined,
        local: local.trim() || undefined,
        status,
      };

      if (selectedEvento) {
        await updateEvento(selectedEvento.id, payload);
      } else {
        await createEvento(payload);
      }
      setIsModalOpen(false);
      setSelectedEvento(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar evento.');
    }
  }

  // Handle Delete
  async function handleDelete(ev: Evento) {
    if (confirm(`Tem certeza que deseja deletar o evento "${ev.titulo}"?`)) {
      try {
        await deleteEvento(ev.id);
      } catch (err: any) {
        alert(err.message || 'Erro ao deletar evento.');
      }
    }
  }

  // Helper to format ISO datetime to local string format required by input type="datetime-local" (YYYY-MM-DDThh:mm)
  function toLocalDatetimeString(isoString?: string) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const tzoffset = date.getTimezoneOffset() * 60000; //offset in milliseconds
    const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
  }

  function openEdit(ev: Evento) {
    setSelectedEvento(ev);
    setTitulo(ev.titulo);
    setDescricao(ev.descricao || '');
    // Convert backend datetime fields
    setDataInicio(toLocalDatetimeString(ev.inicio)); // Wait, backend returned 'inicio' according to types
    setDataFim(toLocalDatetimeString(ev.fim)); // and 'fim'
    setLocal(ev.local || '');
    setStatus((ev as any).status || 'AGENDADO');
    setIsModalOpen(true);
  }

  function openCreate() {
    setSelectedEvento(null);
    setTitulo('');
    setDescricao('');
    setDataInicio('');
    setDataFim('');
    setLocal('');
    setStatus('AGENDADO');
    setIsModalOpen(true);
  }

  // Apply filters
  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilter({
      status: filterStatus || undefined,
      dataInicio: filterStart ? new Date(filterStart).toISOString() : undefined,
      dataFim: filterEnd ? new Date(filterEnd).toISOString() : undefined,
    });
  }

  // Clear filters
  function handleClear() {
    setFilterStatus('');
    setFilterStart('');
    setFilterEnd('');
    applyFilter({});
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Agenda da Igreja"
        description="Acompanhe cultos, ensaios, reuniões e eventos oficiais da igreja."
        action={
          canManage ? (
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Novo Evento
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => refetch()} className="underline font-semibold hover:text-red-800">
            Recarregar
          </button>
        </div>
      )}

      {/* Filters Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Status */}
          <div className="space-y-1.5">
            <label htmlFor="filter-status" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Status
            </label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white text-gray-700"
            >
              <option value="">Todos os status</option>
              <option value="AGENDADO">Agendado</option>
              <option value="REALIZADO">Realizado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          {/* Start date */}
          <div className="space-y-1.5">
            <label htmlFor="filter-start" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              A partir de (Data)
            </label>
            <input
              id="filter-start"
              type="date"
              value={filterStart}
              onChange={(e) => setFilterStart(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none"
            />
          </div>

          {/* End date */}
          <div className="space-y-1.5">
            <label htmlFor="filter-end" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Até (Data)
            </label>
            <input
              id="filter-end"
              type="date"
              value={filterEnd}
              onChange={(e) => setFilterEnd(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white font-semibold rounded-xl text-sm transition-all shadow-sm"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl text-sm transition-all"
            >
              Limpar
            </button>
          </div>
        </form>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-28 bg-gray-100 border border-gray-200 rounded-2xl" />
          <div className="h-28 bg-gray-100 border border-gray-200 rounded-2xl" />
        </div>
      ) : eventos.length === 0 ? (
        <EmptyState
          title="Nenhum evento agendado"
          description="Você pode criar novos eventos e cultos oficiais da igreja para alimentar a agenda compartilhada."
        />
      ) : (
        <div className="space-y-4">
          {eventos.map((ev) => {
            const evStatus = (ev as any).status || 'AGENDADO';
            const colors: Record<string, string> = {
              AGENDADO: 'bg-blue-50 text-blue-700 border-blue-150',
              REALIZADO: 'bg-emerald-50 text-emerald-700 border-emerald-150',
              CANCELADO: 'bg-rose-50 text-rose-700 border-rose-150',
            };

            return (
              <div
                key={ev.id}
                className="bg-white rounded-2xl border border-gray-150 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex px-2.5 py-0.5 text-xs font-bold border rounded-lg ${colors[evStatus]}`}>
                      {evStatus}
                    </span>
                    <h3 className="text-base font-bold text-gray-800">{ev.titulo}</h3>
                  </div>

                  {ev.descricao && (
                    <p className="text-sm text-gray-500 max-w-2xl">{ev.descricao}</p>
                  )}

                  {/* Datetime and local info */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400 font-medium">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Início: {formatDate(ev.inicio)}
                    </span>
                    {ev.fim && (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Fim: {formatDate(ev.fim)}
                      </span>
                    )}
                    {ev.local && (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Local: {ev.local}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {canManage && (
                  <div className="flex gap-2 items-center justify-end self-end md:self-auto">
                    <button
                      onClick={() => openEdit(ev)}
                      className="p-2 border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 bg-white transition-all hover:bg-gray-50 flex items-center justify-center"
                      title="Editar evento"
                    >
                      <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(ev)}
                      className="p-2 border border-red-100 hover:bg-red-50 rounded-xl text-red-500 transition-all flex items-center justify-center"
                      title="Excluir evento"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Event Details/Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/20">
              <h2 className="text-lg font-bold text-gray-800">
                {selectedEvento ? 'Editar Evento' : 'Novo Evento da Igreja'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedEvento(null);
                }}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="ev-titulo" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Título do Evento *
                  </label>
                  <input
                    id="ev-titulo"
                    type="text"
                    required
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex: Culto de Jovens, Reunião de Líderes"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="ev-inicio" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Horário Início *
                    </label>
                    <input
                      id="ev-inicio"
                      type="datetime-local"
                      required
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="ev-fim" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Horário Fim
                    </label>
                    <input
                      id="ev-fim"
                      type="datetime-local"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="ev-local" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Local / Templo
                    </label>
                    <input
                      id="ev-local"
                      type="text"
                      value={local}
                      onChange={(e) => setLocal(e.target.value)}
                      placeholder="Ex: Templo Principal, Sala 3"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="ev-status" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status Evento
                    </label>
                    <select
                      id="ev-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white text-gray-700"
                    >
                      <option value="AGENDADO">Agendado</option>
                      <option value="REALIZADO">Realizado</option>
                      <option value="CANCELADO">Cancelado</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="ev-desc" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Descrição / Pautas
                  </label>
                  <textarea
                    id="ev-desc"
                    rows={3}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Informações extras ou cronograma do evento..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedEvento(null);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-150 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
