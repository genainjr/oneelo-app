'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, buildQuery, HttpError } from '@/lib/api';
import { Escala, EscalaItem } from '@/types';

export interface FilterEscalas {
  ministerioId?: string;
  status?: string;
  mes?: string;
  ano?: string;
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

  async function createEscala(data: { mes: number; ano: number; ministerioId: string; observacoes?: string; diasSemana?: number[] }) {
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

  async function addDia(escalaId: string, data: string, titulo?: string) {
    const res = await api.post<any>(`/api/escalas/${escalaId}/dias`, { data, titulo });
    await fetchEscalas(filter);
    return res;
  }

  async function removeDia(diaId: string) {
    await api.delete(`/api/escalas/dias/${diaId}`);
    await fetchEscalas(filter);
  }

  async function reorderDias(escalaId: string, diaIds: string[]) {
    await api.patch(`/api/escalas/${escalaId}/dias/order`, { diaIds });
  }

  async function addMembroItem(diaId: string, membroId: string, ministerioFuncaoId: string, observacoes?: string) {
    return api.post<EscalaItem>(`/api/escalas/dias/${diaId}/itens`, { escalaDiaId: diaId, membroId, ministerioFuncaoId, observacoes });
  }

  async function removeMembroItem(itemId: string) {
    await api.delete(`/api/escalas/itens/${itemId}`);
  }

  async function confirmarPresenca(itemId: string, statusConfirmacao: 'CONFIRMADO' | 'RECUSADO', observacoes?: string) {
    const res = await api.patch<any>(`/api/escalas/itens/${itemId}/confirmar`, { statusConfirmacao, observacoes });
    await fetchEscalas(filter);
    return res;
  }

  async function updateMembroItemStatus(itemId: string, statusConfirmacao: 'PENDENTE' | 'CONFIRMADO' | 'RECUSADO', observacoes?: string) {
    await api.patch(`/api/escalas/itens/${itemId}/status`, { statusConfirmacao, observacoes });
    await fetchEscalas(filter);
  }

  async function toggleCelula(diaId: string, funcaoId: string, ocultar: boolean) {
    return api.patch(`/api/escalas/dias/${diaId}/funcoes-ocultas`, { funcaoId, ocultar });
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
    addDia,
    removeDia,
    reorderDias,
    confirmarPresenca,
    addMembroItem,
    removeMembroItem,
    updateMembroItemStatus,
    toggleCelula,
  };
}
