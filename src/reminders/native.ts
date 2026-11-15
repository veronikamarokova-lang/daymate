import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { AppData } from '../models/types';
import { buildNativeSchedule, CHANNEL_REMINDER, CHANNEL_REPEAT_LOUD } from './nativeSchedule';

/** true — приложение запущено как установленное Android-приложение, а не во вкладке браузера. */
export const isNative = Capacitor.isNativePlatform();

export async function nativePermission(): Promise<'granted' | 'denied' | 'default'> {
  const { display } = await LocalNotifications.checkPermissions();
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default';
}

export async function requestNativePermission(): Promise<'granted' | 'denied' | 'default'> {
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default';
}

/** Разрешены ли точные будильники. Без них Android может задержать напоминание на несколько минут. */
export async function exactAlarmsAllowed(): Promise<boolean> {
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    return true;
  }
}

export async function openExactAlarmSettings(): Promise<boolean> {
  try {
    return (await LocalNotifications.changeExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    return false;
  }
}

export async function registerNativeActions(): Promise<void> {
  await LocalNotifications.registerActionTypes({
    types: [
      { id: 'DOSE', actions: [{ id: 'taken', title: 'Принял' }, { id: 'snooze', title: 'Отложить' }, { id: 'skip', title: 'Пропустить' }] },
      { id: 'EVENT', actions: [{ id: 'done', title: 'Готово' }] },
    ],
  });
}

let queue: Promise<void> = Promise.resolve();
let lastSignature = '';

/**
 * Передаёт системе актуальное расписание: Android сам покажет уведомления,
 * даже если приложение закрыто или телефон перезагружался.
 */
export function syncNativeSchedule(data: AppData, dismissed: ReadonlySet<string>): Promise<void> {
  queue = queue.then(() => doSync(data, dismissed)).catch(() => { lastSignature = ''; });
  return queue;
}

async function doSync(data: AppData, dismissed: ReadonlySet<string>): Promise<void> {
  const allowed = data.settings.notificationsEnabled && (await nativePermission()) === 'granted';
  const { notifications, liveIds } = allowed
    ? buildNativeSchedule(data, new Date(), dismissed)
    : { notifications: [], liveIds: new Set<number>() };

  // Убираем из шторки уведомления, на которые уже ответили в приложении.
  const delivered = await LocalNotifications.getDeliveredNotifications();
  const stale = delivered.notifications.filter((n) => !liveIds.has(n.id));
  if (stale.length) await LocalNotifications.removeDeliveredNotifications({ notifications: stale });

  const signature = JSON.stringify(notifications.map((n) => [n.id, n.at, n.channelId, n.title, n.body]));
  if (signature === lastSignature) return;

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
  if (notifications.length) {
    await LocalNotifications.schedule({
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        channelId: n.channelId,
        actionTypeId: n.actionTypeId,
        extra: n.extra,
        schedule: { at: new Date(n.at), allowWhileIdle: true },
      })),
    });
  }
  lastSignature = signature;
}

/** Проверка звука: обычное уведомление через 5 секунд и громкое повторное через 15. */
export async function scheduleNativeTest(): Promise<boolean> {
  try {
    const base = Date.now();
    await LocalNotifications.schedule({
      notifications: [
        { id: 2_000_000_001, title: 'DayMate: проверка', body: 'Так звучит обычное напоминание.', channelId: CHANNEL_REMINDER, schedule: { at: new Date(base + 5000), allowWhileIdle: true } },
        { id: 2_000_000_002, title: 'DayMate: проверка повтора', body: 'Так звучит повторное напоминание, если вы не ответили.', channelId: CHANNEL_REPEAT_LOUD, schedule: { at: new Date(base + 15000), allowWhileIdle: true } },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

export interface NativeAction {
  actionId: string;
  extra: unknown;
}

export function onNativeAction(handler: (a: NativeAction) => void): () => void {
  const handle = LocalNotifications.addListener('localNotificationActionPerformed', (e) =>
    handler({ actionId: e.actionId, extra: e.notification.extra }),
  );
  return () => { void handle.then((h) => h.remove()); };
}
