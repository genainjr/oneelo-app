'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, buildQuery, HttpError } from '@/lib/api';
import { Escala } from '@/types';

export interface FilterEscalas {
  ministerioId?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
  pendentesApenas?: string;
  membroId?: string;
}

export function useEscalas(initialFilter: FilterEscalas = {}) {
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterEscalas>(initialFilter);

  const fetchEscalas = useCallback(async (f: FilterEscalas = filter) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Escala[]>(`/api/escalas${buildQuery(f as any)}`);
      setEscalas(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Erro ao carregar escalas.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchEscalas(initialFilter);
  }, []);

  async function createEscala(data: Partial<Escala>) {
    const created = await api.post<Escala>('/api/escalas', data);
    setEscalas((prev) => [created, ...prev]);
    return created;
  }

  async function updateEscala(id: string, data: Partial<Escala>) {
    const updated = await api.patch<Escala>(`/api/escalas/${id}`, data);
    setEscalas((prev) => prev.map((e) => (e.id === id ? updated : e)));
    return updated;
  }

  async function deleteEscala(id: string) {
    await api.delete(`/api/escalas/${id}`);
    setEscalas((prev) => prev.filter((e) => e.id !== id));
  }

  async function confirmarPresenca(escalaId: string, statusConfirmacao: 'CONFIRMADO' | 'RECUSADO', observacoes?: string) {
    const res = await api.patch<any>(`/api/escalas/${escalaId}/confirmar`, { statusConfirmacao, observacoes });
    await fetchEscalas(filter);
    return res;
  }

  // Manage items inside scale
  async function addMembroItem(escalaId: string, membroId: string, funcao: string, observacoes?: string) {
    await api.post(`/api/escalas/${escalaId}/itens`, { membroId, funcao, observacoes });
    await fetchEscalas(filter);
  }

  async function removeMembroItem(escalaId: string, membroId: string) {
    await api.delete(`/api/escalas/${escalaId}/itens/${membroId}`);
    await fetchEscalas(filter);
  }

  async function updateMembroItemStatus(escalaId: string, membroId: string, statusConfirmacao: 'PENDENTE' | 'CONFIRMADO' | 'RECUSADO', observacoes?: string) {
    await api.patch(`/api/escalas/${escalaId}/itens/${membroId}/status`, { statusConfirmacao, observacoes });
    await fetchEscalas(filter);
  }

  function applyFilter(newFilter: FilterEscalas) {
    const merged = { ...filter, ...newFilter };
    setFilter(merged);
    fetchEscalas(merged);
  }

  return {
    escalas,
    loading,
    error,
    filter,
    applyFilter,
    refetch: () => fetchEscalas(filter),
    createEscala,
    updateEscala,
    deleteEscala,
    confirmarPresenca,
    addMembroItem,
    removeMembroItem,
    updateMembroItemStatus,
  };
}
