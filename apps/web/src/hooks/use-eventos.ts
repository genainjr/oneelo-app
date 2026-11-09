'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [rawEventos, setRawEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterEventos>(initialFilter);
  const fetchedPeriodRef = useRef<{ dataInicio?: string; dataFim?: string }>({
    dataInicio: initialFilter.dataInicio,
    dataFim: initialFilter.dataFim,
  });

  const fetchEventos = useCallback(async (f: FilterEventos = filter) => {
    setLoading(true);
    setError(null);
    fetchedPeriodRef.current = {
      dataInicio: f.dataInicio,
      dataFim: f.dataFim,
    };
    try {
      const data = await api.get<Evento[]>(
        `/api/eventos${buildQuery({
          dataInicio: f.dataInicio,
          dataFim: f.dataFim,
          scope,
        })}`,
      );
      setRawEventos(Array.isArray(data) ? data : []);
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

  const eventos = useMemo(() => {
    return rawEventos.filter((evento) => {
      if (filter.status && evento.status !== filter.status) {
        return false;
      }
      if (filter.tipo && evento.tipo !== filter.tipo) {
        return false;
      }
      if (filter.ministerioId) {
        const hasMinisterio = (evento.ministerios || []).some(
          (item) => item.ministerioId === filter.ministerioId || item.ministerio?.id === filter.ministerioId,
        );
        if (!hasMinisterio) return false;
      }
      return true;
    });
  }, [rawEventos, filter.status, filter.tipo, filter.ministerioId]);

  async function createEvento(data: EventoInput) {
    const created = await api.post<Evento>('/api/eventos', data);
    setRawEventos((prev) => [created, ...prev]);
    return created;
  }

  async function createEventosEmLote(data: EventosEmLoteInput) {
    const response = await api.post<EventosEmLoteResponse>('/api/eventos/lote', data);
    setRawEventos((prev) => [...response.eventos, ...prev].sort(
      (a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime(),
    ));
    return response;
  }

  async function updateEvento(id: string, data: EventoInput) {
    const updated = await api.patch<Evento>(`/api/eventos/${id}`, data);
    setRawEventos((prev) => prev.map((e) => (e.id === id ? updated : e)));
    return updated;
  }

  async function deleteEvento(id: string) {
    await api.delete(`/api/eventos/${id}`);
    setRawEventos((prev) => prev.filter((e) => e.id !== id));
  }

  function applyFilter(newFilter: FilterEventos) {
    const merged = { ...filter, ...newFilter };
    const periodChanged =
      (merged.dataInicio ?? '') !== (fetchedPeriodRef.current.dataInicio ?? '') ||
      (merged.dataFim ?? '') !== (fetchedPeriodRef.current.dataFim ?? '');
    setFilter(merged);
    if (periodChanged) {
      void fetchEventos(merged);
    }
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
