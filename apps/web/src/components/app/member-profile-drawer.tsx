'use client';

import { MembroVisualizacao } from '@/types';
import { formatDate, formatPhone, MINISTRY_ROLE_LABEL, STATUS_MEMBRO_COLOR, STATUS_MEMBRO_LABEL } from '@/lib/utils';

interface MemberProfileDrawerProps {
  membro: MembroVisualizacao | null;
  onClose: () => void;
}

export function MemberProfileDrawer({ membro, onClose }: MemberProfileDrawerProps) {
  if (!membro) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/30" onClick={onClose}>
      <aside
        className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Perfil do membro</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">{membro.nome}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Fechar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <section>
            <h3 className="text-sm font-bold text-gray-900">Dados principais</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <dt className="text-[11px] font-semibold uppercase text-gray-400">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_MEMBRO_COLOR[membro.status]}`}>
                    {STATUS_MEMBRO_LABEL[membro.status]}
                  </span>
                </dd>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <dt className="text-[11px] font-semibold uppercase text-gray-400">Nascimento</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-800">{formatDate(membro.dataNascimento)}</dd>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <dt className="text-[11px] font-semibold uppercase text-gray-400">WhatsApp</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-800">{formatPhone(membro.whatsapp)}</dd>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <dt className="text-[11px] font-semibold uppercase text-gray-400">E-mail</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-gray-800">{membro.email || '-'}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="text-sm font-bold text-gray-900">Ministerios</h3>
            <div className="mt-3 space-y-2">
              {membro.ministerios && membro.ministerios.length > 0 ? (
                membro.ministerios.map((ministerio) => (
                  <div key={`${ministerio.ministerioId}-${ministerio.membroId}`} className="rounded-lg border border-gray-100 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{ministerio.ministerio?.nome || 'Ministerio'}</p>
                        <p className="text-xs font-semibold text-gray-500">{MINISTRY_ROLE_LABEL[ministerio.role] || ministerio.role}</p>
                      </div>
                    </div>
                    {ministerio.funcoesDisponiveis && ministerio.funcoesDisponiveis.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {ministerio.funcoesDisponiveis.map((funcao) => (
                          <span key={funcao.funcaoId} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                            {funcao.funcao?.nome}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                  Nenhum ministerio vinculado.
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-gray-900">Tags</h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {membro.tags && membro.tags.length > 0 ? (
                membro.tags.map((membroTag) => (
                  <span
                    key={membroTag.tag.id}
                    className="rounded-full border px-2 py-0.5 text-xs font-semibold"
                    style={{
                      borderColor: `${membroTag.tag.cor || '#6366f1'}30`,
                      backgroundColor: `${membroTag.tag.cor || '#6366f1'}15`,
                      color: membroTag.tag.cor || '#6366f1',
                    }}
                  >
                    {membroTag.tag.nome}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400">Sem tags.</span>
              )}
            </div>
          </section>

          {membro.observacoes && (
            <section>
              <h3 className="text-sm font-bold text-gray-900">Observacoes</h3>
              <p className="mt-2 whitespace-pre-line rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-600">
                {membro.observacoes}
              </p>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
