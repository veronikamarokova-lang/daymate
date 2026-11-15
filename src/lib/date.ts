import type { DateKey, TimeOfDay } from '../models/types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

/** Локальная полночь выбранного дня. */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDateKey(key: unknown): key is DateKey {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return toDateKey(fromDateKey(key)) === key;
}

export function isValidTime(t: unknown): t is TimeOfDay {
  return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export function addDays(key: DateKey, n: number): DateKey {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

export function addMonths(key: DateKey, n: number): DateKey {
  const d = fromDateKey(key);
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

/** Разница в календарных днях (не зависит от перехода на летнее время). */
export function diffDays(a: DateKey, b: DateKey): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function weekdayOf(key: DateKey): number {
  return fromDateKey(key).getDay();
}

export function startOfWeek(key: DateKey, weekStartsOn: 0 | 1): DateKey {
  const shift = (weekdayOf(key) - weekStartsOn + 7) % 7;
  return addDays(key, -shift);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Момент времени для «дата + время на часах» в текущем часовом поясе устройства. */
export function at(date: DateKey, time: TimeOfDay): Date {
  const [h, m] = time.split(':').map(Number);
  const d = fromDateKey(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export function rangeKeys(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

export function formatTime(time: TimeOfDay, format: '24h' | '12h'): string {
  if (format === '24h') return time;
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${suffix}`;
}

export function formatClock(d: Date, format: '24h' | '12h'): string {
  return formatTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`, format);
}

export function formatLongDate(key: DateKey): string {
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    fromDateKey(key),
  );
}

export function formatShortDate(key: DateKey): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(fromDateKey(key));
}

export function formatMonth(key: DateKey): string {
  const s = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(fromDateKey(key));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function orderedWeekdays(weekStartsOn: 0 | 1): number[] {
  return Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
