'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, buildQuery, HttpError } from '@/lib/api';
import { Evento, EventoMinisterioInput, EventosEmLoteInput, EventosEmLoteResponse } from '@/types';

export interface FilterEventos {
  dataInicio?: string;
  dataFim?: string;
  status?: string;
  tipo?: string;
  ministerioId?: string;
}

export interface UseEventosOptions {
  scope?: 'PUBLIC' | 'MANAGE';
}

export type EventoInput = Partial<Omit<Evento, 'ministerios'>> & {
  ministerios?: EventoMinisterioInput[];
  ministerioIds?: string[];
};

export function useEventos(initialFilter: FilterEventos = {}, options: UseEventosOptions = {}) {
  const scope = options.scope ?? 'PUBLIC';
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterEventos>(initialFilter);

  const fetchEventos = useCallback(async (f: FilterEventos = filter) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Evento[]>(`/api/eventos${buildQuery({ ...f, scope })}`);
      setEventos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Erro ao carregar eventos.');
    } finally {
      setLoading(false);
    }
  }, [filter, scope]);

  useEffect(() => {
    // The initial request intentionally runs once; subsequent requests use applyFilter.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchEventos(initialFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createEvento(data: EventoInput) {
    const created = await api.post<Evento>('/api/eventos', data);
    setEventos((prev) => [created, ...prev]);
    return created;
  }

  async function createEventosEmLote(data: EventosEmLoteInput) {
    const response = await api.post<EventosEmLoteResponse>('/api/eventos/lote', data);
    setEventos((prev) => [...response.eventos, ...prev].sort(
      (a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime(),
    ));
    return response;
  }

  async function updateEvento(id: string, data: EventoInput) {
    const updated = await api.patch<Evento>(`/api/eventos/${id}`, data);
    setEventos((prev) => prev.map((e) => (e.id === id ? updated : e)));
    return updated;
  }

  async function deleteEvento(id: string) {
    await api.delete(`/api/eventos/${id}`);
    setEventos((prev) => prev.filter((e) => e.id !== id));
  }

  function applyFilter(newFilter: FilterEventos) {
    const merged = { ...filter, ...newFilter };
    setFilter(merged);
    fetchEventos(merged);
  }

  return {
    eventos,
    loading,
    error,
    filter,
    applyFilter,
    refetch: () => fetchEventos(filter),
    createEvento,
    createEventosEmLote,
    updateEvento,
    deleteEvento,
  };
}
