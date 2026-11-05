'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  BellOff,
  Check,
  AlertCircle,
  Calendar,
  Gift,
  Clock,
  Smartphone,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  getPushStatus,
  enablePushNotifications,
  disablePushNotifications,
  type PushSupportStatus,
} from '@/lib/push-notifications';
import { Skeleton } from '@/components/app/skeleton';
import type { UserNotificationPreference } from '@/types';

export function ProfileNotificationSettings() {
  const [pushStatus, setPushStatus] = useState<PushSupportStatus>('default');
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [preferences, setPreferences] = useState<UserNotificationPreference | null>(null);
  const [prefLoading, setPrefLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [prefSuccess, setPrefSuccess] = useState(false);

  const checkPush = useCallback(async () => {
    try {
      const status = await getPushStatus();
      setPushStatus(status);
    } catch {
      setPushStatus('unsupported');
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      setPrefLoading(true);
      const data = await api.get<UserNotificationPreference>('/api/notifications/preferences');
      setPreferences(data);
    } catch {
      // Fallback defaults
      setPreferences({
        userId: '',
        tenantId: '',
        notifyBirthdays: true,
        notifyEvents: true,
        notifySchedules: true,
      });
    } finally {
      setPrefLoading(false);
    }
  }, []);

  useEffect(() => {
    checkPush();
    loadPreferences();
  }, [checkPush, loadPreferences]);

  const handleTogglePush = async () => {
    setPushLoading(true);
    setPushMessage(null);

    try {
      if (pushStatus === 'enabled') {
        await disablePushNotifications();
        await checkPush();
        setPushMessage({ type: 'success', text: 'Notificações desativadas neste aparelho.' });
      } else {
        await enablePushNotifications();
        await checkPush();
        setPushMessage({ type: 'success', text: 'Notificações ativadas com sucesso neste aparelho!' });
      }
    } catch (err: any) {
      setPushMessage({
        type: 'error',
        text: err?.message || 'Não foi possível alterar a inscrição de notificações.',
      });
      await checkPush();
    } finally {
      setPushLoading(false);
    }
  };

  const handleTogglePreference = async (key: 'notifyBirthdays' | 'notifyEvents' | 'notifySchedules') => {
    if (!preferences) return;

    const newValue = !preferences[key];
    setSavingKey(key);
    setPrefSuccess(false);

    // Optimistic update
    setPreferences((prev) => (prev ? { ...prev, [key]: newValue } : null));

    try {
      await api.patch('/api/notifications/preferences', {
        [key]: newValue,
      });
      setPrefSuccess(true);
      setTimeout(() => setPrefSuccess(false), 2500);
    } catch {
      // Revert on error
      setPreferences((prev) => (prev ? { ...prev, [key]: !newValue } : null));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">Notificações e Alertas</h2>
          <p className="text-sm text-gray-500">
            Gerencie o recebimento de notificações no seu dispositivo e escolha suas preferências.
          </p>
        </div>
        {prefSuccess && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            Preferências salvas
          </span>
        )}
      </div>

      {/* 1. Status do Dispositivo Atual */}
      <div className="p-4 sm:p-5 rounded-2xl border border-gray-100 bg-gray-50/70 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
              pushStatus === 'enabled'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                : pushStatus === 'denied'
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : 'bg-white border-gray-200 text-gray-500'
            }`}>
              {pushStatus === 'enabled' ? (
                <Bell className="w-5 h-5" />
              ) : (
                <BellOff className="w-5 h-5" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">Notificações no aparelho atual</h3>
                {pushStatus === 'enabled' ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                    Ativadas
                  </span>
                ) : pushStatus === 'denied' ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800">
                    Bloqueadas no navegador
                  </span>
                ) : pushStatus === 'unsupported' ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-200 text-gray-700">
                    Não suportado
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">
                    Desativadas
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                {pushStatus === 'enabled'
                  ? 'Este dispositivo está configurado e pronto para receber avisos em tempo real.'
                  : pushStatus === 'denied'
                  ? 'Você bloqueou as permissões de notificação deste site. Para reativar, ajuste as permissões do seu navegador no ícone de cadeado na barra de endereços.'
                  : pushStatus === 'unsupported'
                  ? 'Seu navegador atual não suporta Web Push. No iPhone/iPad (iOS 16.4+), instale o One Elo na Tela de Início (PWA) para habilitar.'
                  : 'Ative para receber avisos de escalas, lembretes de eventos e mensagens importantes na tela do seu aparelho.'}
              </p>
            </div>
          </div>

          {pushStatus !== 'denied' && pushStatus !== 'unsupported' && (
            <button
              type="button"
              onClick={handleTogglePush}
              disabled={pushLoading}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition shadow-xs shrink-0 max-sm:w-full max-sm:justify-center ${
                pushStatus === 'enabled'
                  ? 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 hover:border-gray-300'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800'
              } disabled:opacity-50`}
            >
              {pushLoading ? (
                <div className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" />
              ) : pushStatus === 'enabled' ? (
                <>
                  <BellOff className="w-4 h-4" />
                  <span>Desativar neste aparelho</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span>Ativar notificações</span>
                </>
              )}
            </button>
          )}
        </div>

        {pushMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
              pushMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {pushMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{pushMessage.text}</span>
          </div>
        )}
      </div>

      {/* 2. Preferências por Categoria */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Preferências de recebimento
        </h3>

        {prefLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : preferences ? (
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl bg-white overflow-hidden">
            {/* Escalas de Serviço */}
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">Escalas e convocações ministeriais</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      Importante
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Avisos de quando você for escalado, confirmações pendentes e lembretes no dia do culto.
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={preferences.notifySchedules}
                disabled={savingKey === 'notifySchedules'}
                onClick={() => handleTogglePreference('notifySchedules')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  preferences.notifySchedules ? 'bg-indigo-600' : 'bg-gray-200'
                } disabled:opacity-50`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    preferences.notifySchedules ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Lembretes de Eventos */}
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0 mt-0.5">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-gray-900">Lembretes de eventos e cultos</p>
                  <p className="text-xs text-gray-500">
                    Avisos prévios sobre cultos, conferências e eventos da igreja.
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={preferences.notifyEvents}
                disabled={savingKey === 'notifyEvents'}
                onClick={() => handleTogglePreference('notifyEvents')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  preferences.notifyEvents ? 'bg-indigo-600' : 'bg-gray-200'
                } disabled:opacity-50`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    preferences.notifyEvents ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Aniversariantes da Comunidade */}
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-pink-50 text-pink-600 shrink-0 mt-0.5">
                  <Gift className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-gray-900">Aniversariantes da igreja</p>
                  <p className="text-xs text-gray-500">
                    Comunicado diário celebrando os irmãos aniversariantes para que você possa parabenizá-los.
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={preferences.notifyBirthdays}
                disabled={savingKey === 'notifyBirthdays'}
                onClick={() => handleTogglePreference('notifyBirthdays')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  preferences.notifyBirthdays ? 'bg-indigo-600' : 'bg-gray-200'
                } disabled:opacity-50`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    preferences.notifyBirthdays ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
