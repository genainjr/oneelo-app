'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, HttpError } from '@/lib/api';
import { buildImageFormData } from '@/lib/image-upload';
import { includesNormalizedText } from '@/lib/utils';
import { Membro, MembroSavePayload, MembroUpdateResult } from '@/types';

export interface PromoteVisitanteResponse {
  membro: Membro;
  user: {
    id: string;
    nome: string;
    email: string;
    activationExpiresAt?: string | null;
  } | null;
  activationLink: string | null;
}

export interface FilterMembros {
  nome?: string;
  status?: string;
  whatsapp?: string;
  tags?: string;
  operacao?: 'AND' | 'OR';
}

export function useMembros(initialFilter: FilterMembros = {}) {
  const [rawMembros, setRawMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMembros>(initialFilter);

  const fetchMembros = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Membro[]>('/api/membros');
      setRawMembros(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Erro ao carregar membros.');
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

    return rawMembros.filter((membro) => {
      if (filter.status && membro.status !== filter.status) {
        return false;
      }
      if (filter.whatsapp && !(membro.whatsapp || '').includes(filter.whatsapp)) {
        return false;
      }
      if (filter.nome && !includesNormalizedText(membro.nome, filter.nome)) {
        return false;
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

  async function createMembro(data: Partial<Membro>) {
    const created = await api.post<Membro>('/api/membros', data);
    setRawMembros((prev) => [created, ...prev]);
    return created;
  }

  async function updateMembro(
    id: string,
    data: MembroSavePayload,
  ): Promise<MembroUpdateResult> {
    const res = await api.patch<MembroUpdateResult>(`/api/membros/${id}`, data);
    const { activationLink: _ignoredLink, ...memberOnly } = res;
    setRawMembros((prev) => prev.map((m) => (m.id === id ? (memberOnly as Membro) : m)));
    return res;
  }

  async function deleteMembro(id: string, desativarUsuario = true) {
    await api.delete(
      `/api/membros/${id}?desativarUsuario=${desativarUsuario ? 'true' : 'false'}`,
    );
    setRawMembros((prev) => prev.filter((m) => m.id !== id));
  }

  async function uploadMembroFoto(id: string, file: File) {
    const updated = await api.post<Membro>(`/api/membros/${id}/foto`, buildImageFormData(file));
    setRawMembros((prev) => prev.map((m) => (m.id === id ? updated : m)));
    return updated;
  }

  async function removeMembroFoto(id: string) {
    const updated = await api.delete<Membro>(`/api/membros/${id}/foto`);
    setRawMembros((prev) => prev.map((m) => (m.id === id ? updated : m)));
    return updated;
  }

  async function bulkDeleteMembros(ids: string[], desativarUsuarios = true) {
    await api.post('/api/membros/bulk-delete', { ids, desativarUsuarios });
    await fetchMembros();
  }

  async function bulkTag(membrosIds: string[], tagsIds: string[], acao: 'ADD' | 'REMOVE') {
    await api.post('/api/membros/bulk-tag', { membrosIds, tagsIds, acao });
    await fetchMembros();
  }

  async function promoteVisitante(
    id: string,
    data: { email?: string; whatsapp?: string; criarAcesso: boolean },
  ) {
    const res = await api.post<PromoteVisitanteResponse>(
      `/api/membros/${id}/promover`,
      data,
    );
    setRawMembros((prev) => prev.map((m) => (m.id === id ? res.membro : m)));
    return res;
  }

  async function generateActivationLink(id: string) {
    const res = await api.post<PromoteVisitanteResponse>(
      `/api/membros/${id}/activation-link`,
      {},
    );
    setRawMembros((prev) => prev.map((m) => (m.id === id ? res.membro : m)));
    return res;
  }

  function applyFilter(newFilter: FilterMembros) {
    setFilter((prev) => ({ ...prev, ...newFilter }));
  }

  return {
    membros,
    loading,
    error,
    filter,
    applyFilter,
    refetch: fetchMembros,
    createMembro,
    updateMembro,
    deleteMembro,
    uploadMembroFoto,
    removeMembroFoto,
    bulkTag,
    bulkDeleteMembros,
    promoteVisitante,
    generateActivationLink,
  };
}
