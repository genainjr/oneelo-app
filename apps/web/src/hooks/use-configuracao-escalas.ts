'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, buildQuery, HttpError } from '@/lib/api';
import {
  SegmentoCulto,
  MinisterioFuncaoConfig,
  CompatibilidadeRegra,
} from '@/types';

export function useConfiguracaoEscalas() {
  const [segmentos, setSegmentos] = useState<SegmentoCulto[]>([]);
  const [funcoes, setFuncoes] = useState<MinisterioFuncaoConfig[]>([]);
  const [compatibilidades, setCompatibilidades] = useState<CompatibilidadeRegra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSegmentos = useCallback(async () => {
    try {
      const data = await api.get<SegmentoCulto[]>('/api/escalas/configuracao/segmentos');
      setSegmentos(Array.isArray(data) ? data : []);
      return data;
    } catch (err) {
      const msg = err instanceof HttpError ? err.message : 'Erro ao carregar segmentos.';
      setError(msg);
      throw err;
    }
  }, []);

  const fetchFuncoes = useCallback(async (ministerioId?: string) => {
    try {
      const query = buildQuery({ ministerioId });
      const data = await api.get<MinisterioFuncaoConfig[]>(`/api/escalas/configuracao/funcoes${query}`);
      setFuncoes(Array.isArray(data) ? data : []);
      return data;
    } catch (err) {
      const msg = err instanceof HttpError ? err.message : 'Erro ao carregar funções.';
      setError(msg);
      throw err;
    }
  }, []);

  const fetchCompatibilidades = useCallback(async () => {
    try {
      const data = await api.get<CompatibilidadeRegra[]>('/api/escalas/configuracao/compatibilidade');
      setCompatibilidades(Array.isArray(data) ? data : []);
      return data;
    } catch (err) {
      const msg = err instanceof HttpError ? err.message : 'Erro ao carregar regras de compatibilidade.';
      setError(msg);
      throw err;
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchSegmentos(),
        fetchFuncoes(),
        fetchCompatibilidades(),
      ]);
    } catch {
      // Error is set in individual fetch calls
    } finally {
      setLoading(false);
    }
  }, [fetchSegmentos, fetchFuncoes, fetchCompatibilidades]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Operações de Segmentos
  const createSegmento = async (nome: string) => {
    setError(null);
    try {
      const novo = await api.post<SegmentoCulto>('/api/escalas/configuracao/segmentos', { nome });
      setSegmentos((prev) => [...prev, novo].sort((a, b) => a.ordem - b.ordem));
      return novo;
    } catch (err) {
      const msg = err instanceof HttpError ? err.message : 'Erro ao criar segmento.';
      setError(msg);
      throw err;
    }
  };

  const updateSegmento = async (id: string, data: { nome?: string; ordem?: number }) => {
    setError(null);
    try {
      const atualizado = await api.patch<SegmentoCulto>(`/api/escalas/configuracao/segmentos/${id}`, data);
      setSegmentos((prev) =>
        prev.map((s) => (s.id === id ? atualizado : s)).sort((a, b) => a.ordem - b.ordem),
      );
      return atualizado;
    } catch (err) {
      const msg = err instanceof HttpError ? err.message : 'Erro ao atualizar segmento.';
      setError(msg);
      throw err;
    }
  };

  const reorderSegmentos = async (segmentoIds: string[]) => {
    setError(null);
    try {
      const response = await api.patch<{ message?: string; segmentos?: SegmentoCulto[] } | SegmentoCulto[]>(
        '/api/escalas/configuracao/segmentos/ordem',
        {
          segmentoIds,
        },
      );
      if (Array.isArray(response)) {
        setSegmentos(response);
        return response;
      } else if (response && Array.isArray(response.segmentos)) {
        setSegmentos(response.segmentos);
        return response.segmentos;
      } else {
        const fetched = await fetchSegmentos();
        return fetched;
      }
    } catch (err) {
      const msg = err instanceof HttpError ? err.message : 'Erro ao reordenar segmentos.';
      setError(msg);
      await fetchSegmentos();
      throw err;
    }
  };

  const deleteSegmento = async (id: string) => {
    setError(null);
    try {
      await api.delete(`/api/escalas/configuracao/segmentos/${id}`);
      setSegmentos((prev) => prev.filter((s) => s.id !== id));
      // Funções podem ter perdido vínculos com o segmento excluído
      await fetchFuncoes();
    } catch (err) {
      const msg = err instanceof HttpError ? err.message : 'Erro ao excluir segmento.';
      setError(msg);
      throw err;
    }
  };

  const carregarTemplatePadrao = async () => {
    setError(null);
    try {
      const defaultSegments = await api.post<SegmentoCulto[]>(
        '/api/escalas/configuracao/segmentos/template-padrao',
      );
      setSegmentos(defaultSegments);
      return defaultSegments;
    } catch (err) {
      const msg = err instanceof HttpError ? err.message : 'Erro ao carregar template padrão.';
      setError(msg);
      throw err;
    }
  };

  // Operações de Funções
  const updateFuncao = async (
    id: string,
    data: { segmentoIds?: string[]; localAtuacao?: string | null },
  ) => {
    setError(null);
    try {
      const atualizada = await api.put<MinisterioFuncaoConfig>(
        `/api/escalas/configuracao/funcoes/${id}`,
        data,
      );
      setFuncoes((prev) => prev.map((f) => (f.id === id ? atualizada : f)));
      return atualizada;
    } catch (err) {
      const msg = err instanceof HttpError ? err.message : 'Erro ao atualizar função.';
      setError(msg);
      throw err;
    }
  };

  // Operações de Compatibilidade
  const upsertCompatibilidade = async (data: {
    funcaoAId: string;
    funcaoBId: string;
    regra: 'PERMITIR' | 'AVISAR';
    observacao?: string;
  }) => {
    setError(null);
    try {
      const regra = await api.put<CompatibilidadeRegra>(
        '/api/escalas/configuracao/compatibilidade',
        data,
      );
      setCompatibilidades((prev) => {
        const exists = prev.some((r) => r.id === regra.id);
        if (exists) {
          return prev.map((r) => (r.id === regra.id ? regra : r));
        }
        return [regra, ...prev];
      });
      return regra;
    } catch (err) {
      const msg = err instanceof HttpError ? err.message : 'Erro ao salvar regra de compatibilidade.';
      setError(msg);
      throw err;
    }
  };

  const deleteCompatibilidade = async (id: string) => {
    setError(null);
    try {
      await api.delete(`/api/escalas/configuracao/compatibilidade/${id}`);
      setCompatibilidades((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      const msg = err instanceof HttpError ? err.message : 'Erro ao remover regra de compatibilidade.';
      setError(msg);
      throw err;
    }
  };

  return {
    segmentos,
    setSegmentos,
    funcoes,
    compatibilidades,
    loading,
    error,
    setError,
    loadAll,
    fetchSegmentos,
    fetchFuncoes,
    fetchCompatibilidades,
    createSegmento,
    updateSegmento,
    reorderSegmentos,
    deleteSegmento,
    carregarTemplatePadrao,
    updateFuncao,
    upsertCompatibilidade,
    deleteCompatibilidade,
  };
}
