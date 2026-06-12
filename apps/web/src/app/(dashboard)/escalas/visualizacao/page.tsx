'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { EscalaReadonlyGrid } from '@/components/app/escala-readonly-grid';
import { useEscalasVisualizacao } from '@/hooks/use-escalas-visualizacao';
import { api } from '@/lib/api';
import { STATUS_ESCALA_COLOR, STATUS_ESCALA_LABEL } from '@/lib/utils';
import { Ministerio } from '@/types';

const MESES = [
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

export default function EscalasVisualizacaoPage() {
  const now = new Date();
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [ministerioId, setMinisterioId] = useState('');
  const [status, setStatus] = useState('');
  const [mes, setMes] = useState(String(now.getMonth() + 1));
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [pendentesApenas, setPendentesApenas] = useState(false);
  const { escalas, loading, error, applyFilter, refetch } = useEscalasVisualizacao({
    mes: String(now.getMonth() + 1),
    ano: String(now.getFullYear()),
  });

  useEffect(() => {
    api.get<Ministerio[]>('/api/ministerios')
      .then((data) => setMinisterios(Array.isArray(data) ? data : []))
      .catch(() => setMinisterios([]));
  }, []);

  const totais = useMemo(() => {
    const dias = escalas.reduce((acc, escala) => acc + (escala.dias?.length || 0), 0);
    const itens = escalas.reduce((acc, escala) => (
      acc + (escala.dias || []).reduce((diaAcc, dia) => diaAcc + (dia.itens?.length || 0), 0)
    ), 0);
    const pendentes = escalas.reduce((acc, escala) => (
      acc + (escala.dias || []).reduce((diaAcc, dia) => (
        diaAcc + (dia.itens || []).filter((item) => item.statusConfirmacao === 'PENDENTE').length
      ), 0)
    ), 0);
    return { dias, itens, pendentes };
  }, [escalas]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    applyFilter({
      ministerioId: ministerioId || undefined,
      status: status || undefined,
      mes: mes || undefined,
      ano: ano || undefined,
      pendentesApenas: pendentesApenas ? 'true' : undefined,
    });
  }

  function clearFilters() {
    const defaultMes = String(now.getMonth() + 1);
    const defaultAno = String(now.getFullYear());
    setMinisterioId('');
    setStatus('');
    setMes(defaultMes);
    setAno(defaultAno);
    setPendentesApenas(false);
    applyFilter({ mes: defaultMes, ano: defaultAno });
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Visualizacao de escalas"
        description="Acompanhe as escalas publicadas ou em rascunho em formato de leitura, sem controles de montagem."
        action={(
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50"
          >
            Imprimir
          </button>
        )}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-100 bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase text-gray-400">Escalas</p>
          <p className="mt-1 text-2xl font-black text-gray-900">{escalas.length}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase text-gray-400">Dias</p>
          <p className="mt-1 text-2xl font-black text-gray-900">{totais.dias}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white px-4 py-3">
          <p className="text-xs font-bold uppercase text-gray-400">Pendencias</p>
          <p className="mt-1 text-2xl font-black text-gray-900">{totais.pendentes}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-5 rounded-lg border border-gray-100 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-5">
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
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          >
            <option value="">Todos os status</option>
            <option value="RASCUNHO">Rascunho</option>
            <option value="PUBLICADA">Publicada</option>
            <option value="ENCERRADA">Encerrada</option>
          </select>
          <select
            value={mes}
            onChange={(event) => setMes(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          >
            {MESES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <input
            type="number"
            min="2020"
            max="2100"
            value={ano}
            onChange={(event) => setAno(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600">
            <input
              type="checkbox"
              checked={pendentesApenas}
              onChange={(event) => setPendentesApenas(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600"
            />
            Pendentes
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
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((item) => <div key={item} className="h-64 rounded-lg bg-gray-100" />)}
        </div>
      ) : escalas.length === 0 ? (
        <EmptyState title="Nenhuma escala encontrada" description="Ajuste os filtros para localizar outras escalas." />
      ) : (
        <div className="space-y-6">
          {escalas.map((escala) => {
            const participacoes = (escala.dias || []).reduce((acc, dia) => acc + (dia.itens?.length || 0), 0);
            return (
              <section key={escala.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-indigo-600">{escala.ministerio?.nome || 'Ministerio'}</p>
                    <h2 className="text-lg font-black text-gray-900">
                      {MESES.find((item) => item.value === String(escala.mes))?.label || escala.mes} de {escala.ano}
                    </h2>
                    {escala.observacoes && <p className="mt-1 text-sm text-gray-500">{escala.observacoes}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_ESCALA_COLOR[escala.status]}`}>
                      {STATUS_ESCALA_LABEL[escala.status]}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                      {participacoes} participacoes
                    </span>
                  </div>
                </div>
                <EscalaReadonlyGrid escala={escala} />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
