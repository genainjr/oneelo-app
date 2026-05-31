'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, buildQuery, HttpError } from '@/lib/api';
import { Evento } from '@/types';

export interface FilterEventos {
  dataInicio?: string;
  dataFim?: string;
  status?: string;
}

export function useEventos(initialFilter: FilterEventos = {}) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterEventos>(initialFilter);

  const fetchEventos = useCallback(async (f: FilterEventos = filter) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Evento[]>(`/api/eventos${buildQuery(f as any)}`);
      setEventos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Erro ao carregar eventos.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchEventos(initialFilter);
  }, []);

  async function createEvento(data: Partial<Evento>) {
    const created = await api.post<Evento>('/api/eventos', data);
    setEventos((prev) => [created, ...prev]);
    return created;
  }

  async function updateEvento(id: string, data: Partial<Evento>) {
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
    updateEvento,
    deleteEvento,
  };
}
