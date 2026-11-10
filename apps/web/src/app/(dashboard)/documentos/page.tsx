'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useAuthUser } from '@/contexts/auth-user-context';
import { DocumentJob, TipoDocumento, StatusDocumentJob } from '@/types';

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const TIPO_DOCUMENTO_CONFIG: Record<
  TipoDocumento,
  { label: string; icon: (props: { className?: string }) => ReactNode; color: string }
> = {
  CARTEIRINHA_INDIVIDUAL: {
    label: 'Carteirinha Individual',
    color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
      </svg>
    ),
  },
  CARTEIRINHAS_LOTE: {
    label: 'Carteirinhas em Lote (A4)',
    color: 'text-purple-600 bg-purple-50 border-purple-100',
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
    ),
  },
  ESCALA_PDF: {
    label: 'Escala Mensal (PDF)',
    color: 'text-blue-600 bg-blue-50 border-blue-100',
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  ESCALA_PNG: {
    label: 'Escala Semanal (PNG)',
    color: 'text-blue-600 bg-blue-50 border-blue-100',
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  AGENDA_PDF: {
    label: 'Agenda Mensal (PDF)',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  AGENDA_PNG: {
    label: 'Agenda Semanal (PNG)',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  RELATORIO: {
    label: 'Relatório',
    color: 'text-amber-600 bg-amber-50 border-amber-100',
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
};

function StatusBadgeItem({ status }: { status: StatusDocumentJob }) {
  if (status === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/60">
        <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Concluído
      </span>
    );
  }

  if (status === 'PROCESSING') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200/60">
        <svg className="h-3.5 w-3.5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Processando...
      </span>
    );
  }

  if (status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/60">
        <svg className="h-3.5 w-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
        </svg>
        Na fila
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200/60">
      <svg className="h-3.5 w-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
      Falhou
    </span>
  );
}

export default function CentralDocumentosPage() {
  const router = useRouter();
  const { user, loadingUser } = useAuthUser();

  const [jobs, setJobs] = useState<DocumentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTipo, setSelectedTipo] = useState<string>('TODOS');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (loadingUser || !user) return;
    if (user.role === 'BASIC') {
      router.replace('/personal-panel');
    }
  }, [loadingUser, user, router]);

  const fetchJobs = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTipo !== 'TODOS') {
        if (selectedTipo === 'ESCALAS' || selectedTipo === 'AGENDA') {
          params.append('categoria', selectedTipo);
        } else {
          params.append('tipoDocumento', selectedTipo);
        }
      }
      if (selectedStatus !== 'TODOS') params.append('status', selectedStatus);

      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await api.get<{ items: DocumentJob[]; total: number } | DocumentJob[]>(
        `/api/documents/history${query}`,
      );
      if (Array.isArray(data)) {
        setJobs(data);
      } else if (data && Array.isArray((data as any).items)) {
        setJobs((data as any).items);
      } else {
        setJobs([]);
      }
      setError(null);
    } catch (err: any) {
      if (!isPolling) {
        setError(err?.message || 'Falha ao carregar histórico de documentos.');
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [selectedTipo, selectedStatus]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Polling automático enquanto houver itens PENDING ou PROCESSING
  useEffect(() => {
    const hasActiveJobs = jobs.some(
      (job) => job.status === 'PENDING' || job.status === 'PROCESSING',
    );

    if (hasActiveJobs) {
      pollIntervalRef.current = setInterval(() => {
        fetchJobs(true);
      }, 4000);
    } else if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [jobs, fetchJobs]);

  async function handleDownload(job: DocumentJob) {
    try {
      const data = await api.get<{ downloadUrl: string; fileName: string }>(
        `/api/documents/jobs/${job.id}/download`,
      );
      if (data?.downloadUrl) {
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.fileName || job.fileName || 'documento';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      alert(err?.message || 'Não foi possível gerar link de download.');
    }
  }

  async function handleRetry(job: DocumentJob) {
    setRetryingId(job.id);
    try {
      await api.post(`/api/documents/jobs/${job.id}/retry`);
      await fetchJobs();
    } catch (err: any) {
      alert(err?.message || 'Falha ao reprocessar documento.');
    } finally {
      setRetryingId(null);
    }
  }

  // Auto-atualização ao recuperar foco na aba
  useEffect(() => {
    const handleFocus = () => {
      fetchJobs(true);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchJobs]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Central de Documentos"
        description="Acompanhe, baixe e reemita exportações de escalas, agenda e carteirinhas de membros."
      />

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => fetchJobs()} className="font-semibold underline hover:text-rose-900">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-2xs">
        {/* Tabs de tipo */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'TODOS', label: 'Todos' },
            { id: 'CARTEIRINHA_INDIVIDUAL', label: 'Carteirinhas' },
            { id: 'CARTEIRINHAS_LOTE', label: 'Lote (A4)' },
            { id: 'ESCALAS', label: 'Escalas' },
            { id: 'AGENDA', label: 'Agenda' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedTipo(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedTipo === tab.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filtro de status */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-status" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Status:
          </label>
          <select
            id="filter-status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 focus:border-indigo-500 focus:bg-white focus:outline-none"
          >
            <option value="TODOS">Todos os status</option>
            <option value="COMPLETED">Concluídos</option>
            <option value="PROCESSING">Processando</option>
            <option value="PENDING">Na fila</option>
            <option value="FAILED">Com falha</option>
          </select>
        </div>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-8">
          <svg className="h-8 w-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="mt-3 text-sm font-medium text-gray-500">Carregando documentos...</p>
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          title="Nenhum documento encontrado"
          description="Os documentos gerados por escalas, agenda e carteirinhas de membros aparecerão aqui."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Solicitante</th>
                  <th className="py-3 px-4">Data/Hora</th>
                  <th className="py-3 px-4">Formato</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tamanho</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {jobs.map((job) => {
                  const config = TIPO_DOCUMENTO_CONFIG[job.tipoDocumento] || {
                    label: job.tipoDocumento,
                    color: 'text-gray-600 bg-gray-50 border-gray-100',
                    icon: () => null,
                  };
                  const Icon = config.icon;

                  return (
                    <tr key={job.id} className="transition-colors hover:bg-gray-50/60">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {job.detalhes?.fotoUrl ? (
                            <img
                              src={job.detalhes.fotoUrl}
                              alt={job.detalhes.titulo}
                              className="h-9 w-9 shrink-0 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${config.color}`}>
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                          )}
                          <div className="min-w-0 max-w-md">
                            <p className="font-semibold text-gray-900 truncate">
                              {job.detalhes?.titulo || config.label}
                            </p>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <span className="font-medium text-indigo-600 truncate">
                                {config.label}
                              </span>
                              {job.detalhes?.subtitulo && (
                                <>
                                  <span className="text-gray-300">•</span>
                                  <span className="truncate text-gray-600 font-medium">
                                    {job.detalhes.subtitulo}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        {job.requestedByUser?.nome || 'Sistema'}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 text-xs">
                        {formatDate(job.createdAt, 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-bold text-gray-700">
                          {job.formato}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadgeItem status={job.status} />
                        {job.erroMensagem && (
                          <p className="mt-1 text-xs text-rose-500 max-w-xs truncate" title={job.erroMensagem}>
                            {job.erroMensagem}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-gray-500">
                        {formatBytes(job.fileSize)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {job.status === 'COMPLETED' && (
                            <button
                              type="button"
                              onClick={() => handleDownload(job)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-2xs transition-all hover:border-indigo-200 hover:bg-indigo-50"
                              title="Baixar documento"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Baixar
                            </button>
                          )}

                          {job.status === 'FAILED' && (
                            <button
                              type="button"
                              onClick={() => handleRetry(job)}
                              disabled={retryingId === job.id}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-all hover:bg-rose-100 disabled:opacity-50"
                              title="Reprocessar este documento"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              {retryingId === job.id ? 'Reprocessando...' : 'Tentar novamente'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
