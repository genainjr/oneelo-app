'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { MemberProfileDrawer } from '@/components/app/member-profile-drawer';
import { useMembrosVisualizacao } from '@/hooks/use-membros-visualizacao';
import { api } from '@/lib/api';
import { formatDate, formatPhone, MINISTRY_ROLE_LABEL, STATUS_MEMBRO_COLOR, STATUS_MEMBRO_LABEL } from '@/lib/utils';
import { MembroVisualizacao, Ministerio } from '@/types';

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

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-4 py-3">
      <p className="text-xs font-bold uppercase text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-gray-900">{value}</p>
    </div>
  );
}

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
  const [nome, setNome] = useState('');
  const [status, setStatus] = useState('');
  const [ministerioId, setMinisterioId] = useState('');
  const [aniversarioMes, setAniversarioMes] = useState('');
  const [semTelefone, setSemTelefone] = useState(false);

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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    applyFilter({
      nome: nome || undefined,
      status: status || undefined,
      ministerioId: ministerioId || undefined,
      aniversarioMes: aniversarioMes || undefined,
      semTelefone: semTelefone ? 'true' : undefined,
    });
  }

  function clearFilters() {
    setNome('');
    setStatus('');
    setMinisterioId('');
    setAniversarioMes('');
    setSemTelefone(false);
    applyFilter({
      nome: undefined,
      status: undefined,
      ministerioId: undefined,
      aniversarioMes: undefined,
      semTelefone: undefined,
    });
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Visualizacao de membros"
        description="Consulte membros, contatos, aniversarios e participacao em ministerios sem abrir o modo de edicao."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatBox label="Ativos" value={stats.ativos} />
        <StatBox label="Com ministerio" value={stats.comMinisterio} />
        <StatBox label="Aniversariantes do mes" value={stats.aniversariantes} />
        <StatBox label="Sem telefone" value={stats.semContato} />
      </div>

      <form onSubmit={handleSubmit} className="mb-5 rounded-lg border border-gray-100 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Buscar por nome"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          >
            <option value="">Todos os status</option>
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
            <option value="VISITANTE">Visitante</option>
            <option value="TRANSFERIDO">Transferido</option>
          </select>
          <select
            value={ministerioId}
            onChange={(event) => setMinisterioId(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          >
            <option value="">Todos os ministerios</option>
            {ministerios.map((ministerio) => (
              <option key={ministerio.id} value={ministerio.id}>{ministerio.nome}</option>
            ))}
          </select>
          <select
            value={aniversarioMes}
            onChange={(event) => setAniversarioMes(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          >
            {MESES.map((mes) => <option key={mes.value} value={mes.value}>{mes.label}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600">
            <input
              type="checkbox"
              checked={semTelefone}
              onChange={(event) => setSemTelefone(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600"
            />
            Sem telefone
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
            Filtrar
          </button>
          <button type="button" onClick={clearFilters} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50">
            Limpar
          </button>
          <button type="button" onClick={refetch} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50">
            Recarregar
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-16 rounded-lg bg-gray-100" />)}
        </div>
      ) : membros.length === 0 ? (
        <EmptyState title="Nenhum membro encontrado" description="Ajuste os filtros para localizar outros membros." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Contato</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Ministerios</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Nascimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {membros.map((membro) => (
                  <tr key={membro.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(membro)} className="text-left font-bold text-gray-900 hover:text-indigo-600">
                        {membro.nome}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="space-y-0.5">
                        <p>{formatPhone(membro.whatsapp)}</p>
                        {membro.email && <p className="text-xs text-gray-400">{membro.email}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_MEMBRO_COLOR[membro.status]}`}>
                        {STATUS_MEMBRO_LABEL[membro.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {(membro.ministerios || []).slice(0, 3).map((ministerio) => (
                          <p key={`${ministerio.ministerioId}-${ministerio.membroId}`} className="text-xs font-semibold text-gray-600">
                            {ministerio.ministerio?.nome} <span className="text-gray-400">({MINISTRY_ROLE_LABEL[ministerio.role] || ministerio.role})</span>
                          </p>
                        ))}
                        {(membro.ministerios || []).length === 0 && <span className="text-xs text-gray-300">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(membro.dataNascimento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-gray-100 md:hidden">
            {membros.map((membro) => (
              <button key={membro.id} onClick={() => setSelected(membro)} className="block w-full p-4 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-900">{membro.nome}</p>
                    <p className="mt-1 text-sm text-gray-500">{formatPhone(membro.whatsapp)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_MEMBRO_COLOR[membro.status]}`}>
                    {STATUS_MEMBRO_LABEL[membro.status]}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  {(membro.ministerios || []).map((ministerio) => ministerio.ministerio?.nome).filter(Boolean).join(', ') || 'Sem ministerio'}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      <MemberProfileDrawer membro={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
