'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DashboardStats } from '@/types';

interface IndicadoresApiResponse {
  totalMembrosAtivos: number;
  ministeriosAtivos: number;
  eventosDoMes: number;
  escalasDoMes: number;
  escalasDaSemana?: number;
  escalasNaSemana?: number;
  pendenciasConfirmacao: number;
  aniversariantesMes?: number;
  aniversariantesDoMes?: number;
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
        const data = await api.get<IndicadoresApiResponse>(
          '/api/dashboard/indicadores',
        );

        setStats({
          totalMembrosAtivos: data.totalMembrosAtivos ?? 0,
          escalasNaSemana:
            data.escalasNaSemana ??
            data.escalasDoMes ??
            data.escalasDaSemana ??
            0,
          aniversariantesDoMes:
            data.aniversariantesDoMes ?? data.aniversariantesMes ?? 0,
          eventosDoMes: data.eventosDoMes ?? 0,
          ministeriosAtivos: data.ministeriosAtivos ?? 0,
          pendenciasConfirmacao: data.pendenciasConfirmacao ?? 0,
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
