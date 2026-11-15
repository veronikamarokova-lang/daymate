import type { DateKey, Habit, HabitLogs } from '../models/types';
import { addDays, weekdayOf } from '../lib/date';

export function habitScheduledOn(habit: Habit, date: DateKey): boolean {
  if (date < habit.createdAt) return false;
  return habit.frequency.type === 'daily' || habit.frequency.days.includes(weekdayOf(date));
}

export function habitCount(logs: HabitLogs, habitId: string, date: DateKey): number {
  return logs[habitId]?.[date] ?? 0;
}

export function habitMet(habit: Habit, logs: HabitLogs, date: DateKey): boolean {
  return habitCount(logs, habit.id, date) >= habit.targetPerDay;
}

/**
 * Серия — число подряд выполненных запланированных дней.
 * Сегодняшний день серию не обрывает, пока он ещё не закончился.
 */
export function currentStreak(habit: Habit, logs: HabitLogs, today: DateKey): number {
  let streak = 0;
  for (let d = today; d >= habit.createdAt; d = addDays(d, -1)) {
    if (!habitScheduledOn(habit, d)) continue;
    if (habitMet(habit, logs, d)) streak++;
    else if (d !== today) break;
  }
  return streak;
}

export function bestStreak(habit: Habit, logs: HabitLogs, today: DateKey): number {
  let best = 0;
  let run = 0;
  for (let d = habit.createdAt; d <= today; d = addDays(d, 1)) {
    if (!habitScheduledOn(habit, d)) continue;
    if (habitMet(habit, logs, d)) best = Math.max(best, ++run);
    else if (d !== today) run = 0;
  }
  return best;
}

export function describeFrequency(habit: Habit): string {
  if (habit.frequency.type === 'daily') return 'Каждый день';
  const names = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  return [...habit.frequency.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => names[d]).join(', ');
}
