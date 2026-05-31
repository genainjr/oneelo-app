'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, HttpError } from '@/lib/api';
import { Ministerio } from '@/types';

export function useMinisterios() {
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Ministerio[]>('/api/ministerios');
      setMinisterios(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Erro ao carregar ministérios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, []);

  async function createMinisterio(data: Partial<Ministerio>) {
    const created = await api.post<Ministerio>('/api/ministerios', data);
    await fetch(); // Refetch para obter lista completa com _count e lideres
    return created;
  }

  async function updateMinisterio(id: string, data: Partial<Ministerio>) {
    const updated = await api.patch<Ministerio>(`/api/ministerios/${id}`, data);
    setMinisterios((prev) => prev.map((m) => (m.id === id ? updated : m)));
    return updated;
  }

  async function deleteMinisterio(id: string) {
    await api.delete(`/api/ministerios/${id}`);
    await fetch(); // Refetch: backend faz soft-delete, lista deve refletir estado do servidor
  }

  // Manage members
  async function addMembro(ministerioId: string, membroId: string) {
    await api.post(`/api/ministerios/${ministerioId}/membros`, { membroId });
    await fetch(); // Refetch to get updated counts and relations
  }

  async function removeMembro(ministerioId: string, membroId: string) {
    await api.delete(`/api/ministerios/${ministerioId}/membros/${membroId}`);
    await fetch();
  }

  // Manage leaders
  async function addLider(ministerioId: string, userId: string) {
    await api.post(`/api/ministerios/${ministerioId}/lideres`, { userId });
    await fetch();
  }

  async function removeLider(ministerioId: string, userId: string) {
    await api.delete(`/api/ministerios/${ministerioId}/lideres/${userId}`);
    await fetch();
  }

  return {
    ministerios,
    loading,
    error,
    refetch: fetch,
    createMinisterio,
    updateMinisterio,
    deleteMinisterio,
    addMembro,
    removeMembro,
    addLider,
    removeLider,
  };
}
