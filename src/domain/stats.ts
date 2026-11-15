import type { AppData, DateKey } from '../models/types';
import { rangeKeys, todayKey } from '../lib/date';
import { dosesOn, eventsOn } from './agenda';
import { habitMet, habitScheduledOn } from './habits';

export interface DayStat {
  date: DateKey;
  total: number;
  completed: number;
}

export interface PeriodStats {
  events: { total: number; done: number; skipped: number; missed: number };
  doses: { total: number; taken: number; skipped: number; unconfirmed: number };
  habits: { total: number; met: number };
  days: DayStat[];
}

export const percent = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 100));

/**
 * Статистика за период. Будущие дни не учитываются; приёмы лекарств,
 * время которых ещё не наступило, тоже не считаются пропущенными.
 */
export function computeStats(data: AppData, from: DateKey, to: DateKey, now: Date = new Date()): PeriodStats {
  const today = todayKey(now);
  const stats: PeriodStats = {
    events: { total: 0, done: 0, skipped: 0, missed: 0 },
    doses: { total: 0, taken: 0, skipped: 0, unconfirmed: 0 },
    habits: { total: 0, met: 0 },
    days: [],
  };

  for (const date of rangeKeys(from, to)) {
    const day: DayStat = { date, total: 0, completed: 0 };
    if (date <= today) {
      for (const e of eventsOn(data, date)) {
        if (e.status === 'cancelled') continue;
        stats.events.total++;
        day.total++;
        if (e.status === 'done') { stats.events.done++; day.completed++; }
        else if (e.status === 'skipped') stats.events.skipped++;
        else if (date < today) stats.events.missed++;
      }
      for (const d of dosesOn(data, date, now)) {
        if (d.status === 'upcoming') continue;
        stats.doses.total++;
        day.total++;
        if (d.status === 'taken') { stats.doses.taken++; day.completed++; }
        else if (d.status === 'skipped') stats.doses.skipped++;
        else stats.doses.unconfirmed++;
      }
      for (const h of data.habits) {
        if (h.archived || !habitScheduledOn(h, date)) continue;
        stats.habits.total++;
        day.total++;
        if (habitMet(h, data.habitLogs, date)) { stats.habits.met++; day.completed++; }
      }
    }
    stats.days.push(day);
  }
  return stats;
}
