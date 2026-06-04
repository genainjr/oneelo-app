'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, HttpError } from '@/lib/api';
import { Ministerio, MinistryRole } from '@/types';

export interface CreateMinisterioDto {
  nome: string;
  descricao?: string;
  funcoes?: string[];
}

export interface UpdateMinisterioDto {
  nome?: string;
  descricao?: string;
  ativo?: boolean;
  funcoes?: string[];
}

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

  async function createMinisterio(data: CreateMinisterioDto) {
    const created = await api.post<Ministerio>('/api/ministerios', data);
    await fetch();
    return created;
  }

  async function updateMinisterio(id: string, data: UpdateMinisterioDto) {
    const updated = await api.patch<Ministerio>(`/api/ministerios/${id}`, data);
    setMinisterios((prev) => prev.map((m) => (m.id === id ? updated : m)));
    return updated;
  }

  async function deleteMinisterio(id: string) {
    await api.delete(`/api/ministerios/${id}`);
    await fetch();
  }

  async function addMembro(ministerioId: string, membroId: string, role?: MinistryRole) {
    await api.post(`/api/ministerios/${ministerioId}/membros`, { membroId, role });
    await fetch();
  }

  async function removeMembro(ministerioId: string, membroId: string) {
    await api.delete(`/api/ministerios/${ministerioId}/membros/${membroId}`);
    await fetch();
  }

  async function updateMembroRole(ministerioId: string, membroId: string, role: MinistryRole) {
    await api.patch(`/api/ministerios/${ministerioId}/membros/${membroId}`, { role });
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
    updateMembroRole,
  };
}
