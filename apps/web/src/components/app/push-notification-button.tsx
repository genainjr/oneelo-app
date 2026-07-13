'use client';

import { useEffect, useState } from 'react';
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushStatus,
  type PushSupportStatus,
} from '@/lib/push-notifications';

const STATUS_LABEL: Record<PushSupportStatus, string> = {
  unsupported: 'Notificacoes indisponiveis',
  insecure: 'HTTPS necessario',
  'missing-key': 'Notificacoes indisponiveis',
  denied: 'Notificacoes bloqueadas',
  default: 'Ativar notificacoes',
  disabled: 'Ativar notificacoes',
  enabled: 'Notificacoes ativas',
};

const STATUS_MESSAGE: Record<PushSupportStatus, string> = {
  unsupported: 'Este navegador ainda nao suporta notificacoes push neste contexto.',
  insecure: 'No iPhone, notificacoes push so funcionam com o app instalado a partir de um endereco HTTPS. Em acesso local por IP/http, o navegador bloqueia esse recurso.',
  'missing-key': 'As chaves VAPID ainda nao foram configuradas no backend.',
  denied: 'As notificacoes foram bloqueadas no navegador. Altere a permissao nas configuracoes do site.',
  default: '',
  disabled: '',
  enabled: '',
};

const AUTO_DISMISS_MS = 6000;

function BellIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      {enabled ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.944 23.944 0 01-5.714 0M15 18.25a3 3 0 11-6 0m11.25-5.25a8.25 8.25 0 10-16.5 0c0 4.5-1.5 6-1.5 6h19.5s-1.5-1.5-1.5-6z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 9.879a3 3 0 104.242 4.242M6.343 6.343A8.216 8.216 0 003.75 12c0 4.5-1.5 6-1.5 6h15.407M18.364 15.536c.034-.894-.114-1.824-.114-3.536a8.25 8.25 0 00-8.25-8.25c-.65 0-1.28.075-1.886.216M3 3l18 18" />
      )}
    </svg>
  );
}

export function PushNotificationButton() {
  const [status, setStatus] = useState<PushSupportStatus>('unsupported');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showPermissionIntro, setShowPermissionIntro] = useState(false);

  useEffect(() => {
    if (!message) return;

    const timeout = window.setTimeout(() => {
      setMessage('');
    }, AUTO_DISMISS_MS);

    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    getPushStatus()
      .then(setStatus)
      .catch(() => setStatus('unsupported'))
      .finally(() => setLoading(false));
  }, []);

  async function handleClick() {
    if (loading) return;

    if (status === 'unsupported' || status === 'insecure' || status === 'denied' || status === 'missing-key') {
      setMessage(STATUS_MESSAGE[status]);
      return;
    }

    if (status !== 'enabled') {
      setMessage('');
      setShowPermissionIntro(true);
      return;
    }

    await handleDisable();
  }

  async function handleDisable() {
    setLoading(true);
    setMessage('');

    try {
      await disablePushNotifications();
      setStatus('disabled');
      setMessage('Notificacoes desativadas neste dispositivo.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Nao foi possivel alterar as notificacoes.');
      getPushStatus().then(setStatus).catch(() => undefined);
    } finally {
      setLoading(false);
    }
  }

  async function handleEnableConfirmed() {
    setShowPermissionIntro(false);
    setLoading(true);
    setMessage('');

    try {
      await enablePushNotifications();
      setStatus('enabled');
      setMessage('Notificacoes ativadas neste dispositivo.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Nao foi possivel alterar as notificacoes.');
      getPushStatus().then(setStatus).catch(() => undefined);
    } finally {
      setLoading(false);
    }
  }

  const enabled = status === 'enabled';
  const disabled = loading;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={message || STATUS_LABEL[status]}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
          enabled
            ? 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : status === 'insecure' || status === 'unsupported' || status === 'denied' || status === 'missing-key'
              ? 'border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white'
        }`}
      >
        <BellIcon enabled={enabled} />
        <span className="hidden sm:inline">{loading ? 'Verificando...' : STATUS_LABEL[status]}</span>
      </button>
      {message && (
        <div className="absolute right-0 top-full z-20 mt-2 flex w-72 gap-3 rounded-xl border border-gray-100 bg-white p-3 text-xs leading-relaxed text-gray-600 shadow-lg">
          <span className="flex-1">{message}</span>
          <button
            type="button"
            onClick={() => setMessage('')}
            aria-label="Fechar mensagem de notificacoes"
            className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            ×
          </button>
        </div>
      )}
      {showPermissionIntro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <BellIcon enabled />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-gray-900">Ativar notificações?</h2>
                <p className="text-sm leading-relaxed text-gray-600">
                  O One Elo pode te avisar sobre escalas, eventos, lembretes importantes e comunicados da igreja.
                </p>
              </div>
            </div>

            <p className="mb-5 text-xs leading-relaxed text-gray-500">
              Você pode permitir agora e, se quiser, desativar depois nas configurações do navegador ou do dispositivo.
            </p>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowPermissionIntro(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={handleEnableConfirmed}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Permitir notificações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
