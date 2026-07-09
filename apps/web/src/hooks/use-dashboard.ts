'use client';

import { useEffect, useState } from 'react';
import { endOfMonth, getMonth, getYear, startOfMonth } from 'date-fns';
import { api } from '@/lib/api';
import { DashboardStats, Membro, Escala, Ministerio, Evento } from '@/types';

function toDateInputValue(date: Date) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const currentMonth = getMonth(now) + 1;
        const currentYear = getYear(now);
        const monthStart = toDateInputValue(startOfMonth(now));
        const monthEnd = toDateInputValue(endOfMonth(now));

        const [membros, escalasResp, eventosResp, ministeriosResp, pendenciasResp] = await Promise.allSettled([
          api.get<Membro[]>('/api/membros?status=ATIVO'),
          api.get<Escala[]>(`/api/escalas?mes=${currentMonth}&ano=${currentYear}`),
          api.get<Evento[]>(`/api/eventos?dataInicio=${monthStart}&dataFim=${monthEnd}`),
          api.get<Ministerio[]>('/api/ministerios?ativo=true'),
          api.get<number>('/api/escalas/pendencias/count'),
        ]);

        // Calcula aniversariantes do mês a partir da lista de membros ativos
        let aniversariantes = 0;
        if (membros.status === 'fulfilled' && Array.isArray(membros.value)) {
          aniversariantes = membros.value.filter((m) => {
            if (!m.dataNascimento) return false;
            const d = new Date(m.dataNascimento);
            return d.getMonth() + 1 === currentMonth;
          }).length;
        }

        setStats({
          totalMembrosAtivos:
            membros.status === 'fulfilled' && Array.isArray(membros.value)
              ? membros.value.length
              : 0,
          escalasNaSemana:
            escalasResp.status === 'fulfilled' && Array.isArray(escalasResp.value)
              ? escalasResp.value.length
              : 0,
          aniversariantesDoMes: aniversariantes,
          eventosDoMes:
            eventosResp.status === 'fulfilled' && Array.isArray(eventosResp.value)
              ? eventosResp.value.length
              : 0,
          ministeriosAtivos:
            ministeriosResp.status === 'fulfilled' && Array.isArray(ministeriosResp.value)
              ? ministeriosResp.value.length
              : 0,
          pendenciasConfirmacao:
            pendenciasResp.status === 'fulfilled' && typeof pendenciasResp.value === 'number'
              ? pendenciasResp.value
              : 0,
        });
      } catch {
        setError('Não foi possível carregar os dados do dashboard.');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return { stats, loading, error };
}
