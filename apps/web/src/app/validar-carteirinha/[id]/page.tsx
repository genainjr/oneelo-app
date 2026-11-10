'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type ValidacaoResponse = {
  valido: boolean;
  membro: {
    id: string;
    nome: string;
    nomeExibicao?: string | null;
    fotoUrl?: string | null;
    cargo?: string | null;
    matricula?: string | null;
    status: string;
    dataBatismo?: string | null;
    membroDesde: string;
  };
  igreja: {
    nome: string;
    logoUrl?: string | null;
  };
};

export default function ValidarCarteirinhaPage() {
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ValidacaoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let mounted = true;
    setLoading(true);

    api.get<ValidacaoResponse>(`/api/documents/validar/carteirinha/${id}`)
      .then((res) => {
        if (mounted) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err?.message || 'Carteirinha não encontrada ou inativa.');
          setData(null);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-900 py-10 px-4 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <svg className="h-10 w-10 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="mt-4 text-sm font-semibold text-slate-600">Verificando autenticidade do documento...</p>
          </div>
        ) : error || !data ? (
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Documento Não Reconhecido</h2>
              <p className="mt-2 text-sm text-slate-500">
                {error || 'Não foi possível validar este documento ou o registro foi desativado pela igreja.'}
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400">
                Se você acredita que isso é um engano, entre em contato com a secretaria da sua igreja.
              </p>
            </div>
          </div>
        ) : (
          <div>
            {/* Top Church Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 text-center border-b border-indigo-900/50">
              <div className="flex items-center justify-center gap-3">
                {data.igreja.logoUrl ? (
                  <img
                    src={data.igreja.logoUrl}
                    alt={data.igreja.nome}
                    className="h-10 w-10 object-contain rounded-lg bg-white/10 p-1"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-base text-white shadow-inner">
                    {data.igreja.nome.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="text-left">
                  <p className="text-[11px] uppercase tracking-wider text-indigo-300 font-semibold">Igreja Emissora</p>
                  <h1 className="text-base font-bold text-white line-clamp-1">{data.igreja.nome}</h1>
                </div>
              </div>
            </div>

            {/* Validation Banner */}
            <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-3 flex items-center justify-center gap-2 text-emerald-700">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-wider">Documento Autêntico e Válido</span>
            </div>

            {/* Member Details */}
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                {data.membro.fotoUrl ? (
                  <img
                    src={data.membro.fotoUrl}
                    alt={data.membro.nome}
                    className="w-20 h-24 rounded-xl object-cover border-2 border-indigo-100 shadow-sm"
                  />
                ) : (
                  <div className="w-20 h-24 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-[10px] mt-1 font-semibold uppercase">Sem foto</span>
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">
                    {data.membro.nome}
                  </h2>
                  <p className="text-sm font-semibold text-indigo-600">
                    {data.membro.cargo || 'Membro'}
                  </p>
                  <div className="pt-1 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200/60">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {data.membro.status === 'ATIVO' ? 'Comunhão Ativa' : data.membro.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Matrícula
                  </span>
                  <p className="font-mono font-bold text-slate-800">
                    {data.membro.matricula || '—'}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Batismo nas Águas
                  </span>
                  <p className="font-semibold text-slate-800">
                    {data.membro.dataBatismo ? formatDate(data.membro.dataBatismo, 'dd/MM/yyyy') : '—'}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Membro Desde
                  </span>
                  <p className="font-semibold text-slate-800">
                    {data.membro.membroDesde ? formatDate(data.membro.membroDesde, 'dd/MM/yyyy') : '—'}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Verificação
                  </span>
                  <p className="font-semibold text-emerald-700 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Autenticado
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-100 flex flex-col items-center text-center gap-1">
                <p className="text-[11px] text-slate-400">
                  Emitido digitalmente pelo ecossistema <span className="font-semibold text-slate-600">One Elo</span>
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  Validação #{data.membro.id.slice(0, 12)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
