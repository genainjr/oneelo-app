'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { DataTable, Column, SortState } from '@/components/app/data-table';
import { StatusBadge } from '@/components/app/status-badge';
import { EntityCard } from '@/components/app/entity-card';
import { MemberProfileDrawer } from '@/components/app/member-profile-drawer';
import { FilterShell, FilterActions } from '@/components/app/filter-shell';
import { StatCard } from '@/components/app/stat-card';
import { useFilterState } from '@/hooks/use-filter-state';
import { useMembrosVisualizacao } from '@/hooks/use-membros-visualizacao';
import { api } from '@/lib/api';
import { formatDate, formatPhone, MINISTRY_ROLE_LABEL, STATUS_MEMBRO_COLOR, STATUS_MEMBRO_LABEL } from '@/lib/utils';
import { MembroVisualizacao, Ministerio } from '@/types';
import { Briefcase, Calendar, PhoneOff, Users } from 'lucide-react';

const MESES = [
  { value: '', label: 'Todos os meses' },
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Marco' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export default function MembrosVisualizacaoPage() {
  const {
    membros,
    loading,
    error,
    applyFilter,
    refetch,
  } = useMembrosVisualizacao();
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [selected, setSelected] = useState<MembroVisualizacao | null>(null);
  const [sort, setSort] = useState<SortState>({ key: 'nome', direction: 'asc' });
  const {
    formState: filterState,
    setField: setFilterField,
    handleClear: handleClearFilters,
    handleSubmit: handleFilterSubmit,
  } = useFilterState({
    initialState: {
      nome: '',
      status: '',
      ministerioId: '',
      aniversarioMes: '',
      semTelefone: false,
    },
    onApply: (filters) => {
      applyFilter({
        nome: filters.nome || undefined,
        status: filters.status || undefined,
        ministerioId: filters.ministerioId || undefined,
        aniversarioMes: filters.aniversarioMes || undefined,
        semTelefone: filters.semTelefone ? 'true' : undefined,
      });
    },
  });

  useEffect(() => {
    api.get<Ministerio[]>('/api/ministerios')
      .then((data) => setMinisterios(Array.isArray(data) ? data : []))
      .catch(() => setMinisterios([]));
  }, []);

  const stats = useMemo(() => {
    const ativos = membros.filter((membro) => membro.status === 'ATIVO').length;
    const semContato = membros.filter((membro) => !membro.whatsapp).length;
    const comMinisterio = membros.filter((membro) => (membro.ministerios || []).length > 0).length;
    const mesAtual = new Date().getMonth() + 1;
    const aniversariantes = membros.filter((membro) => {
      if (!membro.dataNascimento) return false;
      return new Date(membro.dataNascimento).getUTCMonth() + 1 === mesAtual;
    }).length;
    return { ativos, semContato, comMinisterio, aniversariantes };
  }, [membros]);

  const sortedMembros = useMemo(() => {
    const arr = [...membros];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sort.key === 'dataNascimento') {
        const av = a.dataNascimento ? new Date(a.dataNascimento).getTime() : 0;
        const bv = b.dataNascimento ? new Date(b.dataNascimento).getTime() : 0;
        cmp = av - bv;
      } else {
        cmp = a.nome.localeCompare(b.nome, 'pt-BR');
      }
      return sort.direction === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [membros, sort]);

  const columns: Column<MembroVisualizacao>[] = [
    {
      key: 'nome',
      header: 'Nome',
      sortable: true,
      render: (membro) => (
        <button onClick={() => setSelected(membro)} className="text-left font-bold text-gray-900 hover:text-indigo-600">
          {membro.nome}
        </button>
      ),
    },
    {
      key: 'contato',
      header: 'Contato',
      render: (membro) => (
        <div className="space-y-0.5">
          <p>{formatPhone(membro.whatsapp)}</p>
          {membro.email && <p className="text-xs text-gray-400">{membro.email}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (membro) => (
        <StatusBadge label={STATUS_MEMBRO_LABEL[membro.status]} className={STATUS_MEMBRO_COLOR[membro.status]} />
      ),
    },
    {
      key: 'ministerios',
      header: 'Ministerios',
      render: (membro) => (
        <div className="space-y-1">
          {(membro.ministerios || []).slice(0, 3).map((ministerio) => (
            <p key={`${ministerio.ministerioId}-${ministerio.membroId}`} className="text-xs font-semibold text-gray-600">
              {ministerio.ministerio?.nome} <span className="text-gray-400">({MINISTRY_ROLE_LABEL[ministerio.role] || ministerio.role})</span>
            </p>
          ))}
          {(membro.ministerios || []).length === 0 && <span className="text-xs text-gray-300">-</span>}
        </div>
      ),
    },
    {
      key: 'dataNascimento',
      header: 'Nascimento',
      sortable: true,
      render: (membro) => <span className="text-gray-600">{formatDate(membro.dataNascimento)}</span>,
    },
  ];

  const renderMobileCard = (membro: MembroVisualizacao) => (
    <EntityCard
      onClick={() => setSelected(membro)}
      className="rounded-none border-0 border-b border-gray-100 shadow-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-gray-900">{membro.nome}</p>
          <p className="mt-1 text-sm text-gray-500">{formatPhone(membro.whatsapp)}</p>
        </div>
        <StatusBadge label={STATUS_MEMBRO_LABEL[membro.status]} className={STATUS_MEMBRO_COLOR[membro.status]} />
      </div>
      <p className="mt-2 text-xs text-gray-400">
        {(membro.ministerios || []).map((ministerio) => ministerio.ministerio?.nome).filter(Boolean).join(', ') || 'Sem ministerio'}
      </p>
    </EntityCard>
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Visualizacao de membros"
        description="Consulte membros, contatos, aniversarios e participacao em ministerios sem abrir o modo de edicao."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Ativos" value={stats.ativos} icon={<Users className="w-5 h-5" />} color="emerald" />
        <StatCard title="Com ministerio" value={stats.comMinisterio} icon={<Briefcase className="w-5 h-5" />} color="indigo" />
        <StatCard title="Aniversariantes do mes" value={stats.aniversariantes} icon={<Calendar className="w-5 h-5" />} color="amber" />
        <StatCard title="Sem telefone" value={stats.semContato} icon={<PhoneOff className="w-5 h-5" />} color="rose" />
      </div>

      <FilterShell
        onSubmit={handleFilterSubmit}
        actions={
          <FilterActions
            submitLabel="Filtrar"
            clearLabel="Limpar"
            reloadLabel="Recarregar"
            onClear={() => handleClearFilters()}
            onReload={refetch}
          />
        }
      >
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-5 items-center">
          <input
            value={filterState.nome}
            onChange={(event) => setFilterField('nome', event.target.value)}
            placeholder="Buscar por nome"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-gray-50 focus:bg-white transition-all w-full"
          />
          <select
            value={filterState.status}
            onChange={(event) => setFilterField('status', event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-gray-50 focus:bg-white transition-all w-full"
          >
            <option value="">Todos os status</option>
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
            <option value="VISITANTE">Visitante</option>
            <option value="TRANSFERIDO">Transferido</option>
          </select>
          <select
            value={filterState.ministerioId}
            onChange={(event) => setFilterField('ministerioId', event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-gray-50 focus:bg-white transition-all w-full"
          >
            <option value="">Todos os ministerios</option>
            {ministerios.map((ministerio) => (
              <option key={ministerio.id} value={ministerio.id}>{ministerio.nome}</option>
            ))}
          </select>
          <select
            value={filterState.aniversarioMes}
            onChange={(event) => setFilterField('aniversarioMes', event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-gray-50 focus:bg-white transition-all w-full"
          >
            {MESES.map((mes) => <option key={mes.value} value={mes.value}>{mes.label}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors w-full cursor-pointer">
            <input
              type="checkbox"
              checked={filterState.semTelefone}
              onChange={(event) => setFilterField('semTelefone', event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
            />
            Sem telefone
          </label>
        </div>
      </FilterShell>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={sortedMembros}
        loading={loading}
        sort={sort}
        onSortChange={setSort}
        renderMobileCard={renderMobileCard}
        emptyTitle="Nenhum membro encontrado"
        emptyDescription="Ajuste os filtros para localizar outros membros."
      />

      <MemberProfileDrawer membro={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
