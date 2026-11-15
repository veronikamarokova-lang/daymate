import type { DateKey, Recurrence } from '../models/types';
import { diffDays, fromDateKey, startOfWeek, weekdayOf, daysInMonth } from '../lib/date';

export const NO_REPEAT: Recurrence = { freq: 'none', interval: 1 };

/**
 * Чистая функция: попадает ли дата в расписание.
 * Вся логика повторений живёт здесь и используется событиями, лекарствами и напоминаниями.
 */
export function occursOn(
  rule: Recurrence,
  start: DateKey,
  date: DateKey,
  exdates: readonly DateKey[] = [],
): boolean {
  if (date < start) return false;
  if (rule.until && date > rule.until) return false;
  if (exdates.includes(date)) return false;
  const interval = Math.max(1, Math.floor(rule.interval) || 1);

  switch (rule.freq) {
    case 'none':
      return date === start;
    case 'daily':
      return diffDays(start, date) % interval === 0;
    case 'weekly': {
      const days = rule.byWeekday?.length ? rule.byWeekday : [weekdayOf(start)];
      if (!days.includes(weekdayOf(date))) return false;
      const weeks = diffDays(startOfWeek(start, 1), startOfWeek(date, 1)) / 7;
      return weeks % interval === 0;
    }
    case 'monthly': {
      const s = fromDateKey(start);
      const d = fromDateKey(date);
      const months = (d.getFullYear() - s.getFullYear()) * 12 + (d.getMonth() - s.getMonth());
      if (months % interval !== 0) return false;
      // 31-е число в коротком месяце переносится на его последний день.
      const target = Math.min(s.getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
      return d.getDate() === target;
    }
  }
}

export function describeRecurrence(rule: Recurrence): string {
  const n = Math.max(1, rule.interval);
  const names = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  switch (rule.freq) {
    case 'none':
      return 'Не повторяется';
    case 'daily':
      return n === 1 ? 'Каждый день' : `Каждые ${n} дн.`;
    case 'weekly': {
      const days = [...(rule.byWeekday ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      const list = days.map((d) => names[d]).join(', ');
      const base = n === 1 ? 'Каждую неделю' : `Каждые ${n} нед.`;
      return list ? `${base}: ${list}` : base;
    }
    case 'monthly':
      return n === 1 ? 'Каждый месяц' : `Каждые ${n} мес.`;
  }
}
