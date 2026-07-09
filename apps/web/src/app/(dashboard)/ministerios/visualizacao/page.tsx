'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Building2, Users, ListChecks, Sparkles } from 'lucide-react';
import { useMinisterios } from '@/hooks/use-ministerios';
import { useFilterState } from '@/hooks/use-filter-state';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { EmptyState } from '@/components/app/empty-state';
import { EntityCard } from '@/components/app/entity-card';
import { FilterShell, FilterActions } from '@/components/app/filter-shell';
import { FilterInput, FilterSelect } from '@/components/app/filter-field';
import { StatusBadge } from '@/components/app/status-badge';
import { getMemberDisplayName } from '@/components/app/escala-shared';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { MinistryRole } from '@/types';

type MinisterioResumo = {
  membros: number;
};

export default function MinisteriosVisualizacaoPage() {
  const t = useTranslations('ministries');
  const { ministerios, loading, error, refetch } = useMinisterios();
  const [appliedFilter, setAppliedFilter] = useState({
    nome: '',
    estrutura: '',
  });
  const [resumo, setResumo] = useState<MinisterioResumo | null>(null);

  const fetchResumo = useCallback(async () => {
    try {
      const data = await api.get<MinisterioResumo>('/api/ministerios/resumo');
      setResumo(data ?? null);
    } catch {
      setResumo(null);
    }
  }, []);

  useEffect(() => {
    fetchResumo();
  }, [fetchResumo]);
  const {
    formState: filterState,
    setField: setFilterField,
    handleClear: handleClearFilters,
    handleSubmit: handleFilterSubmit,
  } = useFilterState({
    initialState: {
      nome: '',
      estrutura: '',
    },
    onApply: (filters) => {
      setAppliedFilter({
        nome: filters.nome,
        estrutura: filters.estrutura,
      });
    },
  });

  const stats = useMemo(() => {
    const total = ministerios.length;
    const membrosBrutos = ministerios.reduce((acc, ministerio) => acc + (ministerio._count?.membros ?? 0), 0);
    const membros = resumo?.membros ?? membrosBrutos;
    const funcoes = ministerios.reduce((acc, ministerio) => acc + (ministerio.funcoes?.length ?? 0), 0);
    const lideres = new Set(
      ministerios.flatMap((ministerio) =>
        (ministerio.membros || [])
          .filter((item) => item.role === 'LEADER' || item.role === 'ASSISTANT_LEADER')
          .map((item) => item.membroId),
      ),
    ).size;
    return { total, membros, funcoes, lideres };
  }, [ministerios]);

  const ministriesSorted = useMemo(() => {
    return [...ministerios].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [ministerios]);

  const filteredMinistries = useMemo(() => {
    const nameQuery = appliedFilter.nome.trim().toLowerCase();

    return ministriesSorted.filter((ministerio) => {
      const matchesName = !nameQuery || ministerio.nome.toLowerCase().includes(nameQuery);
      if (!matchesName) return false;

      const hasLeader = (ministerio.membros || []).some(
        (item) => item.role === 'LEADER' || item.role === 'ASSISTANT_LEADER',
      );
      const hasFunctions = (ministerio.funcoes || []).length > 0;

      if (appliedFilter.estrutura === 'leaders' && !hasLeader) return false;
      if (appliedFilter.estrutura === 'functions' && !hasFunctions) return false;
      if (appliedFilter.estrutura === 'empty' && (hasLeader || hasFunctions)) return false;

      return true;
    });
  }, [ministriesSorted, appliedFilter.nome, appliedFilter.estrutura]);

  const handleReload = useCallback(async () => {
    await Promise.all([refetch(), fetchResumo()]);
  }, [fetchResumo, refetch]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t('view.pageTitle')}
        description={t('view.pageDescription')}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={t('view.stats.total')} value={stats.total} icon={<Building2 className="w-5 h-5" />} color="indigo" />
        <StatCard title={t('view.stats.members')} value={stats.membros} icon={<Users className="w-5 h-5" />} color="blue" />
        <StatCard title={t('view.stats.functions')} value={stats.funcoes} icon={<ListChecks className="w-5 h-5" />} color="emerald" />
        <StatCard title={t('view.stats.leaders')} value={stats.lideres} icon={<Sparkles className="w-5 h-5" />} color="amber" />
      </div>

      <FilterShell
        onSubmit={handleFilterSubmit}
        actions={
          <FilterActions
            submitLabel={t('view.filter.apply')}
            clearLabel={t('view.filter.clear')}
            reloadLabel={t('reload')}
            onClear={() => {
              handleClearFilters({
                nome: '',
                estrutura: '',
              });
            }}
            onReload={handleReload}
          />
        }
      >
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 items-end">
          <FilterInput
            label={t('view.filter.nameLabel')}
            value={filterState.nome}
            onChange={(event) => setFilterField('nome', event.target.value)}
            placeholder={t('view.filter.namePlaceholder')}
          />
          <FilterSelect
            label={t('view.filter.structureLabel')}
            value={filterState.estrutura}
            onChange={(event) => setFilterField('estrutura', event.target.value)}
          >
            <option value="">{t('view.filter.structureAll')}</option>
            <option value="leaders">{t('view.filter.structureLeaders')}</option>
            <option value="functions">{t('view.filter.structureFunctions')}</option>
            <option value="empty">{t('view.filter.structureEmpty')}</option>
          </FilterSelect>
        </div>
      </FilterShell>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button type="button" onClick={handleReload} className="font-semibold underline underline-offset-2">
            {t('reload')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <EntityCard key={index} loading />
          ))}
        </div>
      ) : filteredMinistries.length === 0 ? (
        <EmptyState
          title={t('view.emptyTitle')}
          description={t('view.emptyDescription')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredMinistries.map((ministerio) => {
              const leaders = (ministerio.membros || [])
              .filter((item) => item.role === 'LEADER' || item.role === 'ASSISTANT_LEADER')
              .sort((a, b) => {
                const roleOrder: Record<MinistryRole, number> = {
                  LEADER: 0,
                  ASSISTANT_LEADER: 1,
                  MEMBER: 2,
                };
                const roleDiff = roleOrder[a.role] - roleOrder[b.role];
                if (roleDiff !== 0) return roleDiff;
                return getMemberDisplayName(a.membro).localeCompare(getMemberDisplayName(b.membro), 'pt-BR');
              });

            return (
              <EntityCard
                key={ministerio.id}
                className={`flex flex-col p-5 justify-between relative overflow-hidden ${!ministerio.ativo && 'opacity-65'}`}
              >
                <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${ministerio.ativo ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {ministerio.ativo ? t('status.active') : t('status.archived')}
                  </span>
                  <span className="inline-flex items-center rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-600">
                    {ministerio._count?.membros ?? 0} {ministerio._count?.membros === 1 ? t('view.membersSingular') : t('view.membersPlural')}
                  </span>
                </div>

                <div className="space-y-2 pr-28">
                  <h3 className="text-base font-bold text-gray-800 tracking-tight">{ministerio.nome}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 h-10">
                    {ministerio.descricao || t('view.noDescription')}
                  </p>
                </div>

                <div className="border-t border-gray-100 my-4 pt-3 text-xs text-gray-500 font-medium">
                  <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-100 bg-white p-3">
                    <p className="mb-1.5 text-xs font-semibold text-gray-600">{t('view.sections.leaders')}</p>
                    <div className="mt-2 space-y-1">
                      {leaders.length > 0 ? (
                        leaders.map((item) => (
                          <div key={`${ministerio.id}-${item.membroId}-${item.role}`} className="flex items-start justify-between gap-2">
                            <span className="min-w-0 flex-1 whitespace-normal break-words text-sm font-semibold leading-snug text-gray-800">
                              {getMemberDisplayName(item.membro)}
                            </span>
                            <span className="shrink-0 pt-0.5 text-[11px] font-semibold text-indigo-600">
                              {t(`members.roles.${item.role}` as any)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-400">{t('card.noLeader')}</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3">
                    <p className="mb-1.5 text-xs font-semibold text-gray-600">{t('view.sections.functions')}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(ministerio.funcoes || []).length > 0 ? (
                        ministerio.funcoes!.map((funcao) => (
                          <span
                            key={funcao.id}
                            className="inline-flex items-center rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700"
                          >
                            {funcao.nome}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-400">{t('view.noFunctions')}</p>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              </EntityCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
