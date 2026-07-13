import { api } from './api';

type PublicKeyResponse = {
  publicKey: string;
  configured: boolean;
};

export type PushSupportStatus =
  | 'unsupported'
  | 'insecure'
  | 'missing-key'
  | 'denied'
  | 'default'
  | 'enabled'
  | 'disabled';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getRegisteredPushSubscription() {
  if (!isPushSupported()) return null;

  const registration = await navigator.serviceWorker.register('/sw.js');
  return registration.pushManager.getSubscription();
}

export async function getPushStatus(): Promise<PushSupportStatus> {
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'insecure';
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';

  const subscription = await getRegisteredPushSubscription();
  if (subscription) return 'enabled';

  return Notification.permission === 'default' ? 'default' : 'disabled';
}

export async function enablePushNotifications() {
  if (!isPushSupported()) {
    throw new Error('Notificacoes nao sao suportadas neste navegador.');
  }

  const { publicKey, configured } = await api.get<PublicKeyResponse>('/api/notifications/public-key');
  if (!configured || !publicKey) {
    throw new Error('As notificacoes ainda nao foram configuradas no servidor.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissao de notificacao nao concedida.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = subscription.toJSON();

  await api.post('/api/notifications/subscriptions', {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
    userAgent: navigator.userAgent,
  });

  return subscription;
}

export async function disablePushNotifications() {
  const subscription = await getRegisteredPushSubscription();
  if (!subscription) return;

  await api.delete('/api/notifications/subscriptions', {
    body: {
      endpoint: subscription.endpoint,
    },
  });

  await subscription.unsubscribe();
}
