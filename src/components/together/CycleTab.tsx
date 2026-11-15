import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DateKey } from '../../models/types';
import { useStore } from '../../store/AppStore';
import { toggleCycleDay } from '../../store/mutations';
import { useShared } from '../../shared/SharedProvider';
import { cycleSummary } from '../../shared/cycle';
import { addDays, addMonths, formatLongDate, formatMonth, formatShortDate, fromDateKey, orderedWeekdays, startOfWeek, todayKey, WEEKDAY_SHORT } from '../../lib/date';
import { IconButton } from '../ui/Button';
import { Card } from '../ui/misc';
import { Toggle } from '../ui/fields';

/** Календарь цикла: свои дни отмечаются нажатием, дни партнёра видны, если партнёр ими делится. */
export function CycleTab() {
  const { data, update } = useStore();
  const { state, partner, setShareCycle } = useShared();
  const today = todayKey();
  const [month, setMonth] = useState<DateKey>(() => addMonths(today, 0));
  const { weekStartsOn } = data.settings;

  const mine = useMemo(() => new Set(data.cycleDays), [data.cycleDays]);
  const partnerDoc = partner ? state.items[`cycle:${partner.id}`] : undefined;
  const partnerDays = useMemo(() => {
    const days = (partnerDoc?.payload as { days?: unknown } | undefined)?.days;
    return Array.isArray(days) ? days.filter((d): d is DateKey => typeof d === 'string') : [];
  }, [partnerDoc]);
  const theirs = useMemo(() => new Set(partnerDays), [partnerDays]);
  const mySummary = cycleSummary(data.cycleDays);
  const theirSummary = cycleSummary(partnerDays);

  const first = startOfWeek(month, weekStartsOn);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const monthIndex = fromDateKey(month).getMonth();

  const summaryLine = (who: string, s: ReturnType<typeof cycleSummary>) =>
    s.avgCycle && s.nextStart
      ? `${who}: цикл в среднем ${s.avgCycle} дн. (по ${s.basedOn} ${s.basedOn === 1 ? 'циклу' : 'циклам'}), следующее начало ориентировочно ${formatShortDate(s.nextStart)}.`
      : `${who}: отметьте хотя бы два периода, чтобы появилась средняя длина цикла.`;

  return (
    <>
      <Card className="p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between">
          <IconButton label="Предыдущий месяц" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft size={19} /></IconButton>
          <button type="button" onClick={() => setMonth(addMonths(today, 0))} className="rounded-xl px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">{formatMonth(month)}</button>
          <IconButton label="Следующий месяц" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={19} /></IconButton>
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-400">
          {orderedWeekdays(weekStartsOn).map((d) => <div key={d} className="py-1.5">{WEEKDAY_SHORT[d]}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((date) => {
            const inMonth = fromDateKey(date).getMonth() === monthIndex;
            const isMine = mine.has(date);
            const isTheirs = theirs.has(date);
            const expected = date === mySummary.nextStart || date === theirSummary.nextStart;
            return (
              <button
                key={date}
                type="button"
                disabled={date > today}
                aria-pressed={isMine}
                aria-label={`${formatLongDate(date)}${isMine ? ', отмечено у вас' : ''}${isTheirs ? ', отмечено у партнёра' : ''}`}
                onClick={() => update((d) => toggleCycleDay(d, date))}
                className="flex flex-col items-center gap-1 rounded-xl py-1 disabled:cursor-default"
              >
                <span
                  className={`grid size-9 place-items-center rounded-full text-sm transition-colors ${
                    isMine
                      ? 'bg-rose-500 font-semibold text-white'
                      : expected
                        ? 'border border-dashed border-rose-300 text-rose-500 dark:border-rose-500/60'
                        : date === today
                          ? 'font-semibold text-violet-600 ring-1 ring-violet-300 dark:text-violet-300 dark:ring-violet-500/50'
                          : inMonth ? (date > today ? 'text-slate-400 dark:text-slate-500' : 'hover:bg-slate-100 dark:hover:bg-slate-800') : 'text-slate-300 dark:text-slate-600'
                  }`}
                >
                  {fromDateKey(date).getDate()}
                </span>
                <span className={`size-1.5 rounded-full ${isTheirs ? 'bg-sky-500' : ''}`} aria-hidden />
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-100 px-1 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-rose-500" />ваши дни</span>
          {partner && <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-500" />{partner.name}</span>}
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-dashed border-rose-400" />ожидается</span>
        </div>
      </Card>

      <Card className="mt-3 space-y-2 p-4 text-sm text-slate-600 dark:text-slate-300">
        <p>Нажмите на день, чтобы отметить или снять отметку.</p>
        <p>{summaryLine('Вы', mySummary)}</p>
        {partner && (partnerDoc ? <p>{summaryLine(partner.name, theirSummary)}</p> : <p>{partner.name} не делится своим календарём.</p>)}
      </Card>

      <Card className="mt-3 p-4">
        <Toggle
          checked={state.shareCycle}
          onChange={setShareCycle}
          label="Делиться моим календарём с партнёром"
          description={partner
            ? state.shareCycle ? `${partner.name} видит ваши отмеченные дни. Выключите — и они сотрутся с сервера.` : 'Сейчас ваши отметки хранятся только на этом телефоне.'
            : 'Начнёт работать, когда вы соединитесь с партнёром. До этого отметки хранятся только на этом телефоне.'}
        />
      </Card>
      <p className="mt-3 px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Дата «ожидается» — простое среднее по вашим отметкам. Это ориентир, а не медицинский прогноз: не используйте его для контрацепции или планирования беременности.
      </p>
    </>
  );
}
