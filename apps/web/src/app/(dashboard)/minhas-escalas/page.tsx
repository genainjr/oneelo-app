'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/app/page-header';
import { SkeletonList } from '@/components/app/skeleton';
import { EmptyState } from '@/components/app/empty-state';
import { StatCard } from '@/components/app/stat-card';
import { StatusBadge } from '@/components/app/status-badge';
import {
  AddToCalendarButton,
  CalendarDeepLinkModal,
} from '@/components/app/add-to-calendar-button';
import { useMinhasEscalas } from '@/hooks/use-escalas-visualizacao';
import { useAuthUser } from '@/contexts/auth-user-context';
import { api } from '@/lib/api';
import {
  mapEscalaToCalendarEvent,
  type CalendarEventParams,
} from '@/lib/calendar-url-builder';
import { useRouter } from 'next/navigation';
import { Calendar, AlertTriangle, List, Info, X } from 'lucide-react';
import {
  getCivilDateKey,
  getDatePartsWithWeekday,
  isCivilDateBefore,
  isCivilDateOnOrAfter,
  STATUS_CONFIRMACAO_COLOR,
  STATUS_CONFIRMACAO_LABEL,
  STATUS_ESCALA_COLOR,
  STATUS_ESCALA_LABEL,
} from '@/lib/utils';
import { MinhaEscalaItem } from '@/types';

export default function MinhasEscalasPage() {
  const router = useRouter();
  const { user, loadingUser } = useAuthUser();
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [declineCalendarNotice, setDeclineCalendarNotice] = useState(false);
  const [deepLinkCalendarEvent, setDeepLinkCalendarEvent] = useState<{
    event: CalendarEventParams;
    subtitle?: string;
  } | null>(null);
  const [proximasMinimizadas, setProximasMinimizadas] = useState(false);
  const [historicoMinimizado, setHistoricoMinimizado] = useState(true);
  const { items, loading, error, refetch } = useMinhasEscalas();

  useEffect(() => {
    if (loadingUser || loading || !user) return;
    if (user.role === 'BASIC' && items.length === 0) {
      router.replace('/personal-panel');
    }
  }, [items.length, loading, loadingUser, router, user]);

  // Tratamento do deep-link ?addCalendar=<escalaItemId>
  useEffect(() => {
    if (loading || items.length === 0 || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const addCalendarId = params.get('addCalendar');
    if (!addCalendarId) return;

    const targetItem = items.find((i) => i.id === addCalendarId);
    if (targetItem) {
      const { weekday, date } = getDatePartsWithWeekday(targetItem.data, 'dd/MM/yyyy');
      setDeepLinkCalendarEvent({
        event: mapEscalaToCalendarEvent(targetItem),
        subtitle: `${weekday}, ${date}`,
      });
    }

    params.delete('addCalendar');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
  }, [items, loading]);

  const todayDateKey = getCivilDateKey(new Date()) ?? '';

  const pendentes = useMemo(
    () =>
      items.filter(
        (item) =>
          item.escala.status === 'PUBLICADA' &&
          item.statusConfirmacao === 'PENDENTE' &&
          isCivilDateOnOrAfter(item.data, todayDateKey),
      ),
    [items, todayDateKey],
  );
  const futuras = useMemo(
    () => items.filter((item) => isCivilDateOnOrAfter(item.data, todayDateKey)),
    [items, todayDateKey],
  );
  const passadas = useMemo(
    () => items.filter((item) => isCivilDateBefore(item.data, todayDateKey)).slice().reverse(),
    [items, todayDateKey],
  );

  async function updateConfirmacao(itemId: string, statusConfirmacao: 'CONFIRMADO' | 'RECUSADO') {
    setUpdatingItemId(itemId);
    setActionError('');
    try {
      await api.patch(`/api/escalas/itens/${itemId}/confirmar`, { statusConfirmacao });
      if (statusConfirmacao === 'RECUSADO') {
        setDeclineCalendarNotice(true);
      }
      await refetch();
    } catch {
      setActionError('Nao foi possivel atualizar sua confirmacao.');
    } finally {
      setUpdatingItemId(null);
    }
  }

  function renderItem(item: MinhaEscalaItem, showActions = false, showAddToCalendar = false) {
    const canConfirm = item.escala.status === 'PUBLICADA';
    const canAddToCalendar = showAddToCalendar && item.statusConfirmacao !== 'RECUSADO';
    const { weekday, date } = getDatePartsWithWeekday(item.data, 'dd/MM/yyyy');

    return (
      <div key={item.id} className="rounded-lg border border-gray-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-indigo-600">{item.escala.ministerio?.nome || 'Ministerio'}</p>
            <p className="mt-1 text-xs font-bold uppercase text-indigo-600">{weekday}</p>
            <h3 className="text-base font-bold text-gray-900">{date}</h3>
            {item.titulo && <p className="mt-0.5 text-sm text-gray-500">{item.titulo}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={STATUS_ESCALA_LABEL[item.escala.status]}
              className={`px-2.5 py-1 font-bold ${STATUS_ESCALA_COLOR[item.escala.status]}`}
            />
            <StatusBadge
              label={STATUS_CONFIRMACAO_LABEL[item.statusConfirmacao]}
              className={`px-2.5 py-1 font-bold ${STATUS_CONFIRMACAO_COLOR[item.statusConfirmacao]}`}
            />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
          <p className="text-xs font-bold uppercase text-gray-400">Funcao</p>
          <p className="mt-1 text-sm font-bold text-gray-800">{item.funcao?.nome || 'Funcao'}</p>
          {item.observacoes && <p className="mt-1 text-xs text-gray-500">{item.observacoes}</p>}
        </div>

        {canConfirm && showActions && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => updateConfirmacao(item.id, 'CONFIRMADO')}
              disabled={updatingItemId === item.id}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Confirmar
            </button>
            <button
              onClick={() => updateConfirmacao(item.id, 'RECUSADO')}
              disabled={updatingItemId === item.id}
              className="rounded-lg border border-red-100 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Recusar
            </button>
          </div>
        )}

        {canAddToCalendar && (
          <div className="mt-4 pt-3 border-t border-gray-100/80 flex items-center justify-end">
            <AddToCalendarButton
              event={mapEscalaToCalendarEvent(item)}
              variant="secondary"
            />
          </div>
        )}
      </div>
    );
  }

  const isLoading = loading || loadingUser;
  const canShowContent = !loadingUser && !loading && !!user && (user.role !== 'BASIC' || items.length > 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Minhas Escalas"
        description="Acompanhe suas proximas participacoes e confirme sua presenca."
      />

      <CalendarDeepLinkModal
        event={deepLinkCalendarEvent?.event ?? null}
        subtitle={deepLinkCalendarEvent?.subtitle}
        icsFilename="minha-escala-oneelo.ics"
        onClose={() => setDeepLinkCalendarEvent(null)}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard title="Proximas" value={futuras.length} icon={<Calendar className="w-5 h-5" />} color="indigo" />
        <StatCard title="Pendentes" value={pendentes.length} icon={<AlertTriangle className="w-5 h-5" />} color="amber" />
        <StatCard title="Historico" value={passadas.length} icon={<List className="w-5 h-5" />} color="blue" />
      </div>

      {declineCalendarNotice && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="leading-relaxed">
              <strong className="font-bold">Indisponibilidade registrada.</strong> Caso você já tenha salvo esta escala no seu Google Agenda ou calendário pessoal, lembre-se de removê-la manualmente do seu aparelho.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDeclineCalendarNotice(false)}
            aria-label="Fechar aviso"
            className="rounded-lg p-1 text-amber-700 hover:bg-amber-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {(error || actionError) && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error || actionError}
        </div>
      )}

      {isLoading || !canShowContent ? (
        <SkeletonList count={3} className="h-32" />
      ) : !user?.memberId ? (
        <EmptyState title="Perfil sem membro vinculado" description="Seu usuario ainda nao esta vinculado a um cadastro de membro." />
      ) : items.length === 0 ? (
        <EmptyState title="Nenhuma escala encontrada" description="Voce ainda nao possui participacoes em escalas." />
      ) : (
        <div className="space-y-8">
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Pendentes</h2>
            <div className="space-y-3">
              {pendentes.length > 0 ? pendentes.map((item) => renderItem(item, true, false)) : (
                <EmptyState compact title="Nenhuma confirmacao pendente." />
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Proximas</h2>
                <p className="mt-0.5 text-xs text-gray-400">
                  {futuras.length} {futuras.length === 1 ? 'escala futura' : 'escalas futuras'}
                </p>
              </div>
              {futuras.length > 0 && (
                <button
                  type="button"
                  onClick={() => setProximasMinimizadas((value) => !value)}
                  aria-expanded={!proximasMinimizadas}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 shadow-xs transition hover:bg-gray-50"
                >
                  {proximasMinimizadas ? 'Mostrar proximas' : 'Minimizar proximas'}
                </button>
              )}
            </div>

            {(!proximasMinimizadas || futuras.length === 0) && (
              <div className="space-y-3">
                {futuras.length > 0 ? futuras.map((item) => renderItem(item, false, true)) : (
                  <EmptyState compact title="Nenhuma escala futura." />
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Historico</h2>
                <p className="mt-0.5 text-xs text-gray-400">
                  {passadas.length} {passadas.length === 1 ? 'escala passada' : 'escalas passadas'}
                </p>
              </div>
              {passadas.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHistoricoMinimizado((value) => !value)}
                  aria-expanded={!historicoMinimizado}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 shadow-xs transition hover:bg-gray-50"
                >
                  {historicoMinimizado ? 'Mostrar historico' : 'Minimizar historico'}
                </button>
              )}
            </div>

            {(!historicoMinimizado || passadas.length === 0) && (
              <div className="space-y-3">
                {passadas.length > 0 ? passadas.map((item) => renderItem(item, false, false)) : (
                  <EmptyState compact title="Nenhuma escala passada." />
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
