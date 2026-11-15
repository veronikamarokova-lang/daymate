import type { DateKey } from '../models/types';
import { addDays, diffDays } from '../lib/date';

export interface CycleSummary {
  /** Первые дни каждого отмеченного периода, по возрастанию. */
  starts: DateKey[];
  /** Средняя длина цикла по последним циклам, в днях. */
  avgCycle?: number;
  /** Сколько циклов учтено в среднем. */
  basedOn: number;
  /** Ориентировочная дата следующего начала. */
  nextStart?: DateKey;
}

/** Простая арифметика по отмеченным дням. Это ориентир, а не медицинский прогноз. */
export function cycleSummary(days: readonly DateKey[]): CycleSummary {
  const sorted = [...new Set(days)].sort();
  const set = new Set(sorted);
  const starts = sorted.filter((d) => !set.has(addDays(d, -1)));
  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const gap = diffDays(starts[i - 1], starts[i]);
    if (gap >= 15 && gap <= 60) gaps.push(gap); // слишком короткие и длинные промежутки — скорее пропуск отметок
  }
  const recent = gaps.slice(-6);
  if (recent.length === 0) return { starts, basedOn: 0 };
  const avgCycle = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  return { starts, avgCycle, basedOn: recent.length, nextStart: addDays(starts[starts.length - 1], avgCycle) };
}
