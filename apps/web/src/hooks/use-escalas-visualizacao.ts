'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, buildQuery, HttpError } from '@/lib/api';
import { Escala, MinhaEscalaItem } from '@/types';

export interface FilterEscalasVisualizacao {
  ministerioId?: string;
  status?: string;
  mes?: string;
  ano?: string;
  pendentesApenas?: string;
}

export interface UseMinhasEscalasOptions {
  enabled?: boolean;
}

export interface UseEscalasVisualizacaoOptions {
  enabled?: boolean;
}

export function useEscalasVisualizacao(
  initialFilter: FilterEscalasVisualizacao = {},
  options: UseEscalasVisualizacaoOptions = {},
) {
  const enabled = options.enabled ?? true;
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterEscalasVisualizacao>(initialFilter);

  const fetchEscalas = useCallback(async (f: FilterEscalasVisualizacao = filter) => {
    if (!enabled) {
      setEscalas([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Escala[]>(`/api/escalas/visualizacao${buildQuery(f)}`);
      setEscalas(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Erro ao carregar visualizacao de escalas.');
    } finally {
      setLoading(false);
    }
  }, [enabled, filter]);

  useEffect(() => {
    if (!enabled) {
      setEscalas([]);
      setLoading(false);
      setError(null);
      return;
    }

    fetchEscalas(initialFilter);
  }, [enabled]);

  function applyFilter(newFilter: FilterEscalasVisualizacao) {
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
  };
}

export function useMinhasEscalas(initialFilter: FilterEscalasVisualizacao = {}, options: UseMinhasEscalasOptions = {}) {
  const enabled = options.enabled ?? true;
  const [items, setItems] = useState<MinhaEscalaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterEscalasVisualizacao>(initialFilter);

  const fetchItems = useCallback(async (f: FilterEscalasVisualizacao = filter) => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.get<MinhaEscalaItem[]>(`/api/escalas/minhas${buildQuery(f)}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Erro ao carregar suas escalas.');
    } finally {
      setLoading(false);
    }
  }, [enabled, filter]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    fetchItems(initialFilter);
  }, [enabled]);

  function applyFilter(newFilter: FilterEscalasVisualizacao) {
    const merged = { ...filter, ...newFilter };
    setFilter(merged);
    fetchItems(merged);
  }

  return {
    items,
    loading,
    error,
    filter,
    applyFilter,
    refetch: () => fetchItems(filter),
  };
}
