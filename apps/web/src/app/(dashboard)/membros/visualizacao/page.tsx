'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { MemberProfileDrawer } from '@/components/app/member-profile-drawer';
import { DataTable, Column } from '@/components/app/data-table';
import { EntityCard } from '@/components/app/entity-card';
import { ContactCell } from '@/components/app/contact-cell';
import { InitialsAvatar } from '@/components/app/initials-avatar';
import { FilterShell, FilterActions } from '@/components/app/filter-shell';
import { FilterInput, FilterSelect } from '@/components/app/filter-field';
import { StatCard } from '@/components/app/stat-card';
import { StatusBadge } from '@/components/app/status-badge';
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
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
      setCurrentPage(1);
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

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return membros.slice(start, start + itemsPerPage);
  }, [membros, currentPage]);

  const memberColumns: Column<MembroVisualizacao>[] = [
    {
      key: 'nome',
      header: 'Nome',
      render: (membro) => (
        <div className="flex items-center gap-3">
          <InitialsAvatar name={membro.nome} />
          <button onClick={() => setSelected(membro)} className="text-left font-bold text-gray-900 hover:text-indigo-600">
            {membro.nome}
          </button>
        </div>
      ),
    },
    {
      key: 'contato',
      header: 'Contato',
      render: (membro) => <ContactCell whatsapp={membro.whatsapp} email={membro.email} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (membro) => (
        <StatusBadge
          label={STATUS_MEMBRO_LABEL[membro.status]}
          className={`font-bold ${STATUS_MEMBRO_COLOR[membro.status]}`}
        />
      ),
    },
    {
      key: 'nascimento',
      header: 'Nascimento',
      render: (membro) => <span className="text-gray-600">{formatDate(membro.dataNascimento)}</span>,
    },
    {
      key: 'ministerios',
      header: 'Ministérios',
      render: (membro) => (
        <div className="space-y-1">
          {(membro.ministerios || []).slice(0, 3).map((ministerio) => (
            <p key={`${ministerio.ministerioId}-${ministerio.membroId}`} className="text-xs font-semibold text-gray-600">
              {ministerio.ministerio?.nome}{' '}
              <span className="text-gray-400">({MINISTRY_ROLE_LABEL[ministerio.role] || ministerio.role})</span>
            </p>
          ))}
          {(membro.ministerios || []).length === 0 && <span className="text-xs text-gray-300">-</span>}
        </div>
      ),
    },
  ];

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
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-5 items-end">
          <FilterInput
            label="Nome"
            value={filterState.nome}
            onChange={(event) => setFilterField('nome', event.target.value)}
            placeholder="Buscar por nome"
          />
          <FilterSelect
            label="Status"
            value={filterState.status}
            onChange={(event) => setFilterField('status', event.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
            <option value="VISITANTE">Visitante</option>
            <option value="TRANSFERIDO">Transferido</option>
          </FilterSelect>
          <FilterSelect
            label="Ministério"
            value={filterState.ministerioId}
            onChange={(event) => setFilterField('ministerioId', event.target.value)}
          >
            <option value="">Todos os ministerios</option>
            {ministerios.map((ministerio) => (
              <option key={ministerio.id} value={ministerio.id}>{ministerio.nome}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Aniversário"
            value={filterState.aniversarioMes}
            onChange={(event) => setFilterField('aniversarioMes', event.target.value)}
          >
            {MESES.map((mes) => <option key={mes.value} value={mes.value}>{mes.label}</option>)}
          </FilterSelect>
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
        columns={memberColumns}
        data={paginatedData}
        loading={loading}
        currentPage={currentPage}
        totalItems={membros.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        emptyTitle="Nenhum membro encontrado"
        emptyDescription="Ajuste os filtros para localizar outros membros."
        renderMobileCard={(membro) => (
          <EntityCard
            title={membro.nome}
            subtitle={formatPhone(membro.whatsapp)}
            badge={
              <StatusBadge
                label={STATUS_MEMBRO_LABEL[membro.status]}
                className={`font-bold ${STATUS_MEMBRO_COLOR[membro.status]}`}
              />
            }
            meta={
              (membro.ministerios || []).map((m) => m.ministerio?.nome).filter(Boolean).join(', ') || 'Sem ministério'
            }
            onClick={() => setSelected(membro)}
          />
        )}
      />

      <MemberProfileDrawer membro={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
