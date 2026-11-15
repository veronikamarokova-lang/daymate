import type { AppData, DateKey, Settings, TimeOfDay } from '../models/types';
import { addDays, at, todayKey } from '../lib/date';
import { agendaFor, isResolved } from '../domain/agenda';

export interface ReminderInstance {
  /** Стабильный ключ экземпляра: вид + id + дата + время. */
  key: string;
  kind: 'dose' | 'event';
  refId: string;
  date: DateKey;
  time: TimeOfDay;
  title: string;
  body: string;
  /** Когда запланировано само событие. */
  scheduledAt: number;
  /** Когда нужно напомнить (с учётом «напомнить заранее» и «отложить»). */
  fireAt: number;
  /** Повторять ли без ответа. Для занятий — нет: громкий сигнал посреди пары ни к чему. */
  repeat: boolean;
}

/** Напоминания старше этого срока уже не всплывают — они видны в списке дня как неподтверждённые. */
export const STALE_AFTER_MS = 12 * 60 * 60 * 1000;
/** Если напоминание сработало позже этого порога, честно помечаем его как опоздавшее. */
export const LATE_AFTER_MS = 2 * 60 * 1000;

/** Все неподтверждённые напоминания со вчерашнего дня на daysAhead дней вперёд. Чистая функция от данных. */
export function planReminders(data: AppData, now: Date, daysAhead = 1): ReminderInstance[] {
  const today = todayKey(now);
  const out: ReminderInstance[] = [];
  for (let i = -1; i <= daysAhead; i++) {
    const date = addDays(today, i);
    for (const item of agendaFor(data, date, now)) {
      if (isResolved(item) || !item.time) continue;
      const scheduledAt = at(date, item.time).getTime();
      if (item.kind === 'dose') {
        if (!item.medication.remindersEnabled) continue;
        const snoozed = item.log?.status === 'snoozed' && item.log.snoozedUntil ? Date.parse(item.log.snoozedUntil) : NaN;
        out.push({
          key: item.key, kind: 'dose', refId: item.medication.id, date, time: item.time,
          title: `Пора принять: ${item.medication.name}`,
          body: [item.medication.dosage, 'Отметьте приём, когда примете.'].filter(Boolean).join(' · '),
          scheduledAt,
          fireAt: Number.isFinite(snoozed) ? snoozed : scheduledAt,
          repeat: true,
        });
      } else {
        if (!item.event.reminder.enabled) continue;
        out.push({
          key: item.key, kind: 'event', refId: item.event.id, date, time: item.time,
          title: [item.event.title, item.event.classType && `(${item.event.classType.toLowerCase()})`].filter(Boolean).join(' '),
          // Для занятия главное — где оно: аудитория идёт первой.
          body: [item.event.location, `Начало в ${item.time}`, item.event.teacher].filter(Boolean).join(' · '),
          scheduledAt,
          fireAt: scheduledAt - item.event.reminder.offsetMin * 60_000,
          repeat: item.event.kind !== 'class',
        });
      }
    }
  }
  return out.sort((a, b) => a.fireAt - b.fireAt);
}

/** Напоминания, время которых уже наступило и которые ещё ждут ответа пользователя. */
export function activeReminders(plan: ReminderInstance[], now: Date): ReminderInstance[] {
  const t = now.getTime();
  return plan.filter((r) => r.fireAt <= t && t - r.fireAt < STALE_AFTER_MS);
}

export function nextReminder(plan: ReminderInstance[], now: Date): ReminderInstance | undefined {
  return plan.find((r) => r.fireAt > now.getTime());
}

export interface LedgerEntry {
  /** fireAt, для которого велись уведомления; при «отложить» меняется и счётчик обнуляется. */
  fireAt: number;
  count: number;
  lastAt: number;
}
export type Ledger = Record<string, LedgerEntry>;

export interface Delivery {
  reminder: ReminderInstance;
  /** Напоминание показано заметно позже срока (вкладка была закрыта или «спала»). */
  late: boolean;
  repeat: number;
}

/**
 * Решает, какие уведомления показать прямо сейчас, и возвращает обновлённый журнал.
 * Сравнение идёт с текущим временем на часах, а не с таймерами, поэтому перезагрузка,
 * «сон» вкладки и перевод системных часов не приводят к потере или дублям.
 */
export function decideDeliveries(
  plan: ReminderInstance[], ledger: Ledger, now: Date,
  settings: Pick<Settings, 'repeatMinutes' | 'maxRepeats'>,
): { deliveries: Delivery[]; ledger: Ledger } {
  const t = now.getTime();
  const next: Ledger = {};
  const deliveries: Delivery[] = [];
  const liveKeys = new Set(plan.map((r) => r.key));

  for (const [key, entry] of Object.entries(ledger)) {
    // Запись живёт, пока напоминание актуально; иначе журнал рос бы бесконечно.
    if (liveKeys.has(key) && t - entry.fireAt < 3 * 24 * 60 * 60 * 1000) next[key] = entry;
  }

  for (const reminder of activeReminders(plan, now)) {
    const entry = next[reminder.key];
    const sameFire = entry && entry.fireAt === reminder.fireAt;
    if (!sameFire) {
      next[reminder.key] = { fireAt: reminder.fireAt, count: 1, lastAt: t };
      deliveries.push({ reminder, late: t - reminder.fireAt > LATE_AFTER_MS, repeat: 0 });
    } else if (reminder.repeat && entry.count <= settings.maxRepeats && t - entry.lastAt >= settings.repeatMinutes * 60_000) {
      next[reminder.key] = { ...entry, count: entry.count + 1, lastAt: t };
      deliveries.push({ reminder, late: false, repeat: entry.count });
    }
  }
  return { deliveries, ledger: next };
}
