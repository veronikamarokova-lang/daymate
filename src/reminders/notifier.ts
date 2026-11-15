import type { ReminderInstance } from './plan';
import { isNative, nativePermission, onNativeAction, registerNativeActions, requestNativePermission } from './native';

export type NotifyPermission = 'unsupported' | 'default' | 'granted' | 'denied';

/** Разрешение браузера (синхронно). В Android-приложении используйте getNotifyPermission(). */
export function notifyPermission(): NotifyPermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function getNotifyPermission(): Promise<NotifyPermission> {
  if (!isNative) return notifyPermission();
  try {
    return await nativePermission();
  } catch {
    return 'unsupported';
  }
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (isNative) {
    try {
      return await requestNativePermission();
    } catch {
      return 'unsupported';
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return notifyPermission();
  }
}

let registration: ServiceWorkerRegistration | null = null;

/** Service worker нужен, чтобы у уведомлений были кнопки и клик возвращал в приложение. */
export async function registerNotificationWorker(): Promise<void> {
  if (isNative) {
    // В Android-приложении уведомления показывает система, service worker не нужен.
    await registerNativeActions().catch(() => {});
    return;
  }
  if (!('serviceWorker' in navigator)) return;
  try {
    registration = await navigator.serviceWorker.register('/sw.js');
  } catch {
    registration = null; // без воркера работаем через обычный Notification
  }
}

export interface ReminderActionMessage {
  type: 'reminder-action';
  action: 'open' | 'taken' | 'snooze' | 'skip' | 'done';
  reminder: Pick<ReminderInstance, 'kind' | 'refId' | 'date' | 'time'>;
}

/** Показывает системное уведомление. Возвращает false, если это невозможно. */
export async function showSystemNotification(r: ReminderInstance, body: string): Promise<boolean> {
  if (isNative) return false; // расписание уже передано системе, см. native.ts
  if (notifyPermission() !== 'granted') return false;
  const data = { kind: r.kind, refId: r.refId, date: r.date, time: r.time };
  const base = { body, tag: r.key, icon: '/icon.svg', badge: '/icon.svg', data };
  try {
    if (registration?.active) {
      const actions = r.kind === 'dose'
        ? [{ action: 'taken', title: 'Принял' }, { action: 'snooze', title: 'Отложить' }]
        : [{ action: 'done', title: 'Готово' }];
      // renotify/actions есть не во всех типах lib.dom, но поддерживаются браузерами с service worker.
      const options = { ...base, actions, renotify: true, requireInteraction: true } as NotificationOptions;
      await registration.showNotification(r.title, options);
    } else {
      new Notification(r.title, base);
    }
    return true;
  } catch {
    return false;
  }
}

export function closeSystemNotification(key: string): void {
  registration?.getNotifications({ tag: key }).then((list) => list.forEach((n) => n.close())).catch(() => {});
}

const ACTIONS: ReminderActionMessage['action'][] = ['taken', 'snooze', 'skip', 'done'];

export function onReminderAction(handler: (msg: ReminderActionMessage) => void): () => void {
  if (isNative) {
    return onNativeAction(({ actionId, extra }) => {
      const r = extra as Partial<ReminderActionMessage['reminder']> | null;
      if (!r || (r.kind !== 'dose' && r.kind !== 'event') || !r.refId || !r.date || !r.time) return;
      const action = ACTIONS.find((a) => a === actionId) ?? 'open';
      handler({ type: 'reminder-action', action, reminder: { kind: r.kind, refId: r.refId, date: r.date, time: r.time } });
    });
  }
  if (!('serviceWorker' in navigator)) return () => {};
  const listener = (e: MessageEvent) => {
    if (e.data?.type === 'reminder-action') handler(e.data as ReminderActionMessage);
  };
  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
}
