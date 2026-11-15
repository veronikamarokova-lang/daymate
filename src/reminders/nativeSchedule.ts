import type { AppData } from '../models/types';
import { planReminders, STALE_AFTER_MS, type ReminderInstance } from './plan';

/** Имена каналов совпадают с MainActivity.java. */
export const CHANNEL_REMINDER = 'daymate_reminder';
export const CHANNEL_REPEAT_LOUD = 'daymate_repeat_loud';

/** На сколько дней вперёд расписание передаётся системе. Обновляется при каждом открытии приложения. */
export const HORIZON_DAYS = 14;
/** Android допускает не больше 500 будильников на приложение — берём ближайшие с запасом. */
export const MAX_SCHEDULED = 300;

export interface NativeNotification {
  id: number;
  at: number;
  title: string;
  body: string;
  channelId: string;
  actionTypeId: 'DOSE' | 'EVENT';
  /** 0 — первое напоминание, 1+ — повторы. */
  attempt: number;
  extra: Pick<ReminderInstance, 'kind' | 'refId' | 'date' | 'time'>;
}

/** Стабильный положительный 31-битный идентификатор уведомления для Android. */
export function notificationId(key: string, attempt: number): number {
  let h = 2166136261;
  const s = `${key}#${attempt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 1) || 1;
}

/**
 * Что нужно запланировать в системе: для каждого неподтверждённого напоминания —
 * первое уведомление и повторы через repeatMinutes. Повторы идут в громкий канал.
 * Когда пользователь отвечает, напоминание исчезает из плана, и повторы отменяются.
 */
export function buildNativeSchedule(
  data: AppData, now: Date, dismissed: ReadonlySet<string> = new Set(),
): { notifications: NativeNotification[]; liveIds: Set<number> } {
  const { repeatMinutes, maxRepeats, loudRepeat } = data.settings;
  const t = now.getTime();
  const notifications: NativeNotification[] = [];
  const liveIds = new Set<number>();

  for (const r of planReminders(data, now, HORIZON_DAYS)) {
    if (dismissed.has(`${r.key}@${r.fireAt}`)) continue;
    const attempts = r.repeat ? maxRepeats : 0;
    for (let attempt = 0; attempt <= attempts; attempt++) {
      const at = r.fireAt + attempt * repeatMinutes * 60_000;
      if (at - r.fireAt >= STALE_AFTER_MS) break;
      const id = notificationId(r.key, attempt);
      liveIds.add(id);
      if (at <= t + 2000) continue; // уже показано системой либо время прошло
      notifications.push({
        id, at, attempt,
        title: attempt === 0 ? r.title : `Повторно: ${r.title}`,
        body: attempt === 0 ? r.body : `Вы ещё не ответили на напоминание. ${r.body}`,
        channelId: attempt > 0 && loudRepeat ? CHANNEL_REPEAT_LOUD : CHANNEL_REMINDER,
        actionTypeId: r.kind === 'dose' ? 'DOSE' : 'EVENT',
        extra: { kind: r.kind, refId: r.refId, date: r.date, time: r.time },
      });
    }
  }
  notifications.sort((a, b) => a.at - b.at);
  return { notifications: notifications.slice(0, MAX_SCHEDULED), liveIds };
}
