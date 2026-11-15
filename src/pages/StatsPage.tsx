import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useReminders } from '../reminders/ReminderProvider';
import { computeStats, percent } from '../domain/stats';
import { addDays, formatShortDate, fromDateKey, todayKey, WEEKDAY_SHORT, weekdayOf } from '../lib/date';
import { Card, EmptyState, PageHeader, ProgressRing, SectionTitle } from '../components/ui/misc';
import { Segmented } from '../components/ui/fields';

type Period = 'week' | 'month';

export function StatsPage() {
  const { data } = useStore();
  const { now } = useReminders();
  const [period, setPeriod] = useState<Period>('week');
  const today = todayKey(now);
  const days = period === 'week' ? 7 : 30;
  const stats = computeStats(data, addDays(today, -(days - 1)), today, now);
  const hasAny = stats.events.total + stats.doses.total + stats.habits.total > 0;

  const rings = [
    { label: 'Задачи', value: percent(stats.events.done, stats.events.total), sub: `${stats.events.done} из ${stats.events.total}`, bar: 'stroke-violet-500' },
    { label: 'Привычки', value: percent(stats.habits.met, stats.habits.total), sub: `${stats.habits.met} из ${stats.habits.total}`, bar: 'stroke-emerald-500' },
    { label: 'Лекарства', value: percent(stats.doses.taken, stats.doses.total), sub: `${stats.doses.taken} из ${stats.doses.total}`, bar: 'stroke-rose-400' },
  ];

  const rows: [string, number, string][] = [
    ['Выполненные задачи', stats.events.done, 'bg-violet-500'],
    ['Пропущенные задачи (отмечено)', stats.events.skipped, 'bg-slate-400'],
    ['Задачи без отметки', stats.events.missed, 'bg-amber-400'],
    ['Подтверждённые приёмы лекарств', stats.doses.taken, 'bg-emerald-500'],
    ['Пропущенные приёмы (отмечено)', stats.doses.skipped, 'bg-slate-400'],
    ['Приёмы без отметки', stats.doses.unconfirmed, 'bg-rose-400'],
    ['Дни с выполненной привычкой', stats.habits.met, 'bg-emerald-500'],
  ];

  return (
    <>
      <PageHeader title="Статистика" subtitle={`${formatShortDate(addDays(today, -(days - 1)))} — ${formatShortDate(today)}`} />
      <Segmented label="Период" value={period} onChange={setPeriod} options={[{ value: 'week', label: 'Неделя' }, { value: 'month', label: 'Месяц' }]} />

      {!hasAny ? (
        <div className="mt-4">
          <EmptyState icon={BarChart3} title="Пока нечего считать" text="Статистика появится, когда в выбранном периоде будут события, привычки или приёмы лекарств." />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {rings.map((r) => (
              <Card key={r.label} className="flex flex-col items-center px-2 py-4 text-center">
                <ProgressRing value={r.value} size={72} stroke={8} barClass={r.bar}>
                  <span className="text-sm font-semibold">{r.value}%</span>
                </ProgressRing>
                <div className="mt-2 text-sm font-medium">{r.label}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{r.sub}</div>
              </Card>
            ))}
          </div>

          <SectionTitle>Выполнение по дням</SectionTitle>
          <Card className="p-4">
            <div className="flex h-36 items-end gap-1" role="img" aria-label="Доля выполненного по дням">
              {stats.days.map((d) => {
                const p = percent(d.completed, d.total);
                return (
                  <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${formatShortDate(d.date)}: ${d.completed} из ${d.total}`}>
                    <div className="relative h-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                      <div className="absolute inset-x-0 bottom-0 rounded-md bg-violet-500 transition-[height] duration-500 ease-out" style={{ height: `${p}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-1 text-center text-[10px] text-slate-400">
              {stats.days.map((d, i) => (
                <div key={d.date} className="flex-1 truncate">
                  {period === 'week' ? WEEKDAY_SHORT[weekdayOf(d.date)] : i % 5 === 4 || i === 0 ? fromDateKey(d.date).getDate() : ''}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Высота столбца — доля выполненных задач, привычек и подтверждённых приёмов за день.</p>
          </Card>

          <SectionTitle>Подробно</SectionTitle>
          <Card className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map(([label, value, dot]) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className={`size-2 shrink-0 rounded-full ${dot}`} />
                <span className="flex-1 text-slate-600 dark:text-slate-300">{label}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </Card>
          <p className="mt-4 px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Регулярность приёма считается только по вашим отметкам «Принял». Это личная статистика, а не медицинская оценка.
          </p>
        </>
      )}
    </>
  );
}
