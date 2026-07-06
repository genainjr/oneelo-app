'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, buildQuery, HttpError } from '@/lib/api';
import { MembroVisualizacao } from '@/types';

export interface FilterMembrosVisualizacao {
  nome?: string;
  status?: string;
  whatsapp?: string;
  tags?: string;
  operacao?: 'AND' | 'OR';
  ministerioId?: string;
  ministerioRole?: string;
  aniversarioMes?: string;
  semTelefone?: string;
  ordenacao?: 'nome' | 'dataNascimento';
}

export function useMembrosVisualizacao(initialFilter: FilterMembrosVisualizacao = {}) {
  const [membros, setMembros] = useState<MembroVisualizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMembrosVisualizacao>(initialFilter);

  const fetchMembros = useCallback(async (f: FilterMembrosVisualizacao = filter) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<MembroVisualizacao[]>(`/api/membros/visualizacao${buildQuery(f)}`);
      setMembros(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Erro ao carregar visualizacao de membros.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchMembros(initialFilter);
  }, []);

  function applyFilter(newFilter: FilterMembrosVisualizacao) {
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
  };
}
