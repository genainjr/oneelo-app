'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, buildQuery, HttpError } from '@/lib/api';
import { Membro } from '@/types';

export interface FilterMembros {
  nome?: string;
  status?: string;
  whatsapp?: string;
  tags?: string;
  operacao?: 'AND' | 'OR';
}

export function useMembros(initialFilter: FilterMembros = {}) {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMembros>(initialFilter);

  const fetchMembros = useCallback(async (f: FilterMembros = filter) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Membro[]>(`/api/membros${buildQuery(f)}`);
      setMembros(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Erro ao carregar membros.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchMembros(initialFilter);
  }, []);

  async function createMembro(data: Partial<Membro>) {
    const created = await api.post<Membro>('/api/membros', data);
    setMembros((prev) => [created, ...prev]);
    return created;
  }

  async function updateMembro(id: string, data: Partial<Membro>) {
    const updated = await api.patch<Membro>(`/api/membros/${id}`, data);
    setMembros((prev) => prev.map((m) => (m.id === id ? updated : m)));
    return updated;
  }

  async function deleteMembro(id: string) {
    await api.delete(`/api/membros/${id}`);
    setMembros((prev) => prev.filter((m) => m.id !== id));
  }

  async function bulkTag(membrosIds: string[], tagsIds: string[], acao: 'ADD' | 'REMOVE') {
    await api.post('/api/membros/bulk-tag', { membrosIds, tagsIds, acao });
    // Refetch to get updated tags for members
    await fetchMembros(filter);
  }

  function applyFilter(newFilter: FilterMembros) {
    const merged = { ...filter, ...newFilter };
    setFilter(merged);
    fetchMembros(merged);
  }

  return {
    membros,
    loading,
    error,
    filter,
    applyFilter,
    refetch: () => fetchMembros(filter),
    createMembro,
    updateMembro,
    deleteMembro,
    bulkTag,
  };
}
