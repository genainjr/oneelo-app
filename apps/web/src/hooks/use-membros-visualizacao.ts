'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, HttpError } from '@/lib/api';
import { includesNormalizedText } from '@/lib/utils';
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
  const [rawMembros, setRawMembros] = useState<MembroVisualizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMembrosVisualizacao>(initialFilter);

  const fetchMembros = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<MembroVisualizacao[]>('/api/membros/visualizacao');
      setRawMembros(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Erro ao carregar visualizacao de membros.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMembros();
  }, [fetchMembros]);

  const membros = useMemo(() => {
    const tagList = (filter.tags || '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const mes = Number.parseInt(filter.aniversarioMes ?? '', 10);
    const filterByMonth = Number.isInteger(mes) && mes >= 1 && mes <= 12;

    return rawMembros.filter((membro) => {
      if (filter.status && membro.status !== filter.status) {
        return false;
      }
      if (filter.whatsapp && !(membro.whatsapp || '').includes(filter.whatsapp)) {
        return false;
      }
      if (filter.semTelefone === 'true') {
        if (membro.whatsapp && membro.whatsapp.trim() !== '') {
          return false;
        }
      }
      if (filter.nome && !includesNormalizedText(membro.nome, filter.nome)) {
        return false;
      }
      if (filter.ministerioId || filter.ministerioRole) {
        const hasMatch = (membro.ministerios || []).some((m) => {
          const minId = m.ministerioId || m.ministerio?.id;
          if (filter.ministerioId && minId !== filter.ministerioId) {
            return false;
          }
          if (filter.ministerioRole && m.role !== filter.ministerioRole) {
            return false;
          }
          return true;
        });
        if (!hasMatch) return false;
      }
      if (filterByMonth) {
        if (!membro.dataNascimento) return false;
        const birthMonth = new Date(membro.dataNascimento).getUTCMonth() + 1;
        if (birthMonth !== mes) return false;
      }
      if (tagList.length > 0) {
        const memberTagNames = new Set(
          (membro.tags || [])
            .map((t) => (t.tag?.nome || '').trim().toLowerCase())
            .filter(Boolean),
        );
        if (filter.operacao === 'AND') {
          if (!tagList.every((tag) => memberTagNames.has(tag))) return false;
        } else {
          if (!tagList.some((tag) => memberTagNames.has(tag))) return false;
        }
      }
      return true;
    });
  }, [rawMembros, filter]);

  function applyFilter(newFilter: FilterMembrosVisualizacao) {
    setFilter(newFilter);
  }

  return {
    membros,
    loading,
    error,
    filter,
    applyFilter,
    refetch: fetchMembros,
  };
}
