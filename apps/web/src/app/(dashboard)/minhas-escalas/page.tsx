'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { api } from '@/lib/api';
import { formatDate, STATUS_CONFIRMACAO_COLOR, STATUS_CONFIRMACAO_LABEL } from '@/lib/utils';
import { AuthUser, Escala, EscalaItem } from '@/types';

type MinhaEscalaDia = {
  escala: Escala;
  diaId: string;
  data: string;
  titulo?: string;
  itens: EscalaItem[];
};

export default function MinhasEscalasPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<MinhaEscalaDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const me = await api.get<AuthUser>('/api/auth/me');
      setUser(me);

      if (!me.memberId) {
        setItems([]);
        return;
      }

      const escalas = await api.get<Escala[]>('/api/escalas');
      const detailed = await Promise.all(
        escalas.map((escala) => api.get<Escala>(`/api/escalas/${escala.id}`).catch(() => null)),
      );

      const ownItems = detailed.flatMap((escala) => {
        if (!escala?.dias) return [];
        return escala.dias.flatMap((dia) => {
          const itens = (dia.itens || []).filter((item) => item.membroId === me.memberId);
          if (itens.length === 0) return [];
          return [{
            escala,
            diaId: dia.id,
            data: dia.data,
            titulo: dia.titulo,
            itens,
          }];
        });
      });

      ownItems.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
      setItems(ownItems);
    } catch {
      setError('Nao foi possivel carregar suas escalas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const futuras = useMemo(
    () => items.filter((item) => new Date(item.data) >= hoje),
    [items],
  );
  const passadas = useMemo(
    () => items.filter((item) => new Date(item.data) < hoje).reverse(),
    [items],
  );

  async function updateConfirmacao(itemId: string, statusConfirmacao: 'CONFIRMADO' | 'RECUSADO') {
    setUpdatingItemId(itemId);
    try {
      await api.patch(`/api/escalas/itens/${itemId}/confirmar`, { statusConfirmacao });
      await load();
    } catch {
      setError('Nao foi possivel atualizar sua confirmacao.');
    } finally {
      setUpdatingItemId(null);
    }
  }

  function renderItem(item: MinhaEscalaDia) {
    const canConfirm = item.escala.status === 'PUBLICADA';

    return (
      <div key={`${item.escala.id}-${item.diaId}`} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-indigo-600 uppercase">{item.escala.ministerio?.nome || 'Ministerio'}</p>
            <h3 className="text-base font-bold text-gray-900 mt-1">{formatDate(item.data, 'dd/MM/yyyy')}</h3>
            {item.titulo && <p className="text-sm text-gray-500 mt-0.5">{item.titulo}</p>}
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-gray-200 text-gray-600">
            {item.escala.status}
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {item.itens.map((escalaItem) => (
            <div key={escalaItem.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-gray-800">{escalaItem.funcao?.nome || 'Funcao'}</p>
                {escalaItem.observacoes && <p className="text-xs text-gray-500">{escalaItem.observacoes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${STATUS_CONFIRMACAO_COLOR[escalaItem.statusConfirmacao]}`}>
                  {STATUS_CONFIRMACAO_LABEL[escalaItem.statusConfirmacao]}
                </span>
                {canConfirm && (
                  <>
                    <button
                      onClick={() => updateConfirmacao(escalaItem.id, 'CONFIRMADO')}
                      disabled={updatingItemId === escalaItem.id}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => updateConfirmacao(escalaItem.id, 'RECUSADO')}
                      disabled={updatingItemId === escalaItem.id}
                      className="px-3 py-1.5 rounded-lg border border-red-100 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
                    >
                      Recusar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Minhas Escalas"
        description="Acompanhe suas proximas participacoes e confirme sua presenca."
      />

      {error && (
        <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((item) => <div key={item} className="h-32 rounded-2xl bg-gray-100" />)}
        </div>
      ) : !user?.memberId ? (
        <EmptyState title="Perfil sem membro vinculado" description="Seu usuario ainda nao esta vinculado a um cadastro de membro." />
      ) : items.length === 0 ? (
        <EmptyState title="Nenhuma escala encontrada" description="Voce ainda nao possui participacoes em escalas." />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Proximas</h2>
            <div className="space-y-3">
              {futuras.length > 0 ? futuras.map(renderItem) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                  Nenhuma escala futura.
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Historico</h2>
            <div className="space-y-3">
              {passadas.length > 0 ? passadas.map(renderItem) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                  Nenhuma escala passada.
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
