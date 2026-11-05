'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Sparkles,
  Users,
  Megaphone,
  Smartphone,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  getPushStatus,
  enablePushNotifications,
  disablePushNotifications,
  type PushSupportStatus,
} from '@/lib/push-notifications';
import { detectInstallPlatform, isStandaloneMode } from '@/lib/pwa-install';
import type { UserInboxItem, UserInboxResponse, NotificationOrigin } from '@/types';

const AUTO_PROMPT_DISMISSED_KEY = 'oneelo:push-permission-intro-dismissed';

const ORIGIN_ICONS: Record<NotificationOrigin, React.ReactNode> = {
  COMMUNICATION_GENERAL: <Megaphone className="w-4 h-4 text-indigo-500 shrink-0" />,
  COMMUNICATION_MINISTRY: <Users className="w-4 h-4 text-emerald-500 shrink-0" />,
  SYSTEM_AUTOMATION: <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />,
};

function formatTimeAgo(dateString: string): string {
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds <= 60) return 'Agora';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `há ${diffInMinutes}m`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `há ${diffInHours}h`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Ontem';
    if (diffInDays < 7) return `há ${diffInDays}d`;
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
  } catch {
    return '';
  }
}

export function NotificationBellInbox() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<UserInboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Push status
  const [pushStatus, setPushStatus] = useState<PushSupportStatus>('unsupported');
  const [pushLoading, setPushLoading] = useState(false);
  const [showPermissionIntro, setShowPermissionIntro] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const loadInbox = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get<UserInboxResponse>('/api/notifications/inbox?limit=25');
      setItems(res.data);
      setUnreadCount(res.unreadCount);
    } catch {
      // Ignora silenciosamente para não quebrar a navegação se offline
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const checkPush = useCallback(async () => {
    try {
      const currentStatus = await getPushStatus();
      setPushStatus(currentStatus);

      const autoPromptDismissed = localStorage.getItem(AUTO_PROMPT_DISMISSED_KEY) === 'true';
      const isIOS = detectInstallPlatform() === 'ios';
      const canAutoPrompt =
        !autoPromptDismissed &&
        (currentStatus === 'default' || currentStatus === 'disabled') &&
        (!isIOS || isStandaloneMode());

      if (canAutoPrompt) {
        setShowPermissionIntro(true);
      }
    } catch {
      setPushStatus('unsupported');
    }
  }, []);

  useEffect(() => {
    loadInbox();
    checkPush();

    // Polling suave a cada 60s
    const interval = setInterval(() => {
      loadInbox(true);
    }, 60000);

    return () => clearInterval(interval);
  }, [loadInbox, checkPush]);

  // Fecha popover com clique fora ou tecla ESC
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggleOpen = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      loadInbox(true);
      checkPush();
    }
  };

  const handleItemClick = async (item: UserInboxItem) => {
    // Optimistic update
    if (!item.isRead) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isRead: true, lidoEm: new Date().toISOString() } : i)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await api.patch(`/api/notifications/inbox/${item.id}/read`);
      } catch {
        // Ignora silenciosamente
      }
    }

    setIsOpen(false);

    if (item.urlDestino) {
      router.push(item.urlDestino);
    }
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unreadCount === 0 || markingAll) return;

    try {
      setMarkingAll(true);
      setItems((prev) => prev.map((i) => ({ ...i, isRead: true, lidoEm: new Date().toISOString() })));
      setUnreadCount(0);
      await api.post('/api/notifications/inbox/read-all');
    } catch {
      loadInbox(true);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleEnablePush = async () => {
    setShowPermissionIntro(true);
  };

  const handleEnableConfirmed = async () => {
    localStorage.setItem(AUTO_PROMPT_DISMISSED_KEY, 'true');
    setShowPermissionIntro(false);
    setPushLoading(true);

    try {
      await enablePushNotifications();
      await checkPush();
    } catch {
      await checkPush();
    } finally {
      setPushLoading(false);
    }
  };

  const handleDisablePush = async () => {
    setPushLoading(true);
    try {
      await disablePushNotifications();
      await checkPush();
    } catch {
      await checkPush();
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Botão do Sino */}
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-label="Notificações"
        aria-expanded={isOpen}
        title={
          unreadCount > 0
            ? `${unreadCount} notificação(ões) não lida(s) • Push no aparelho: ${
                pushStatus === 'enabled' ? 'Ativo' : 'Desativado'
              }`
            : `Notificações • Push no aparelho: ${
                pushStatus === 'enabled' ? 'Ativo' : 'Desativado'
              }`
        }
        className={`relative inline-flex items-center justify-center p-2 rounded-xl border transition-all ${
          isOpen
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs'
            : unreadCount > 0
            ? 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50/50 shadow-2xs'
            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
      >
        <div className="relative">
          <Bell className="w-4 h-4 shrink-0" />
          {/* Ponto indicador de status do Push (Verde = Ativo, Cinza = Inativo) */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white transition-colors ${
              pushStatus === 'enabled'
                ? 'bg-emerald-500 shadow-2xs'
                : 'bg-gray-300'
            }`}
          />
        </div>

        {/* Badge vermelho no canto do botão para notificações não lidas */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-75">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown / Popover da Caixa de Entrada */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm rounded-2xl border border-gray-200/90 bg-white shadow-xl z-50 flex flex-col max-h-[85vh] sm:max-h-[540px] animate-in fade-in zoom-in-95 duration-150">
          {/* Header do Popover */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/60 rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">Notificações</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-700">
                  {unreadCount} nova{unreadCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Marcar todas como lidas</span>
              </button>
            )}
          </div>

          {/* Lista de Notificações */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100/80 overscroll-contain">
            {loading && items.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 space-y-2">
                <div className="w-5 h-5 border-2 border-indigo-600/40 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                <p>Carregando notificações...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
                  <CheckCheck className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-gray-800">Você está em dia!</h4>
                <p className="text-xs text-gray-500 max-w-[220px] mx-auto">
                  Nenhuma notificação recebida por enquanto.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors hover:bg-gray-50/80 ${
                    !item.isRead ? 'bg-indigo-50/40' : 'bg-white'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-gray-100/80 shrink-0 mt-0.5">
                    {ORIGIN_ICONS[item.origem] || <Bell className="w-4 h-4 text-gray-500" />}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-1">
                      <p
                        className={`text-xs leading-tight line-clamp-1 ${
                          !item.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'
                        }`}
                      >
                        {item.titulo}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 line-clamp-2 leading-snug">
                      {item.mensagem}
                    </p>

                    {item.urlDestino && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600">
                        <span>Ver detalhes</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  {!item.isRead && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Rodapé Integrado: Status do Push no Aparelho */}
          <div className="p-3 bg-gray-50 border-t border-gray-100 rounded-b-2xl shrink-0">
            {pushStatus === 'enabled' ? (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Notificações no celular ativas</span>
                </div>
                <button
                  type="button"
                  onClick={handleDisablePush}
                  disabled={pushLoading}
                  className="text-[11px] text-gray-500 hover:text-gray-700 underline"
                >
                  {pushLoading ? 'Alterando...' : 'Desativar'}
                </button>
              </div>
            ) : pushStatus === 'default' || pushStatus === 'disabled' ? (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={pushLoading}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition"
              >
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span>{pushLoading ? 'Ativando...' : 'Ativar notificações neste aparelho'}</span>
              </button>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>Notificações push bloqueadas no navegador</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de confirmação de permissão Push */}
      {showPermissionIntro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Bell className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-gray-900">Ativar notificações no celular?</h2>
                <p className="text-sm leading-relaxed text-gray-600">
                  O One Elo pode te avisar sobre escalas, lembretes de eventos e comunicados importantes mesmo quando o app estiver fechado.
                </p>
              </div>
            </div>

            <p className="mb-5 text-xs leading-relaxed text-gray-500">
              Você pode permitir agora e desativar quando quiser nas configurações ou no perfil.
            </p>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(AUTO_PROMPT_DISMISSED_KEY, 'true');
                  setShowPermissionIntro(false);
                }}
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