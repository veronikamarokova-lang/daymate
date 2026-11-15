import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Category, DateKey } from '../models/types';
import { useStore } from '../store/AppStore';
import { useReminders } from '../reminders/ReminderProvider';
import { agendaFor } from '../domain/agenda';
import {
  addDays, addMonths, formatLongDate, formatMonth, fromDateKey, orderedWeekdays, startOfWeek, todayKey, WEEKDAY_SHORT,
} from '../lib/date';
import { CATEGORY_META } from '../lib/categories';
import { AgendaList } from '../components/events/AgendaList';
import { EventForm } from '../components/events/EventForm';
import { Button, IconButton } from '../components/ui/Button';
import { Card, EmptyState, PageHeader, SectionTitle } from '../components/ui/misc';

export function CalendarPage() {
  const { data } = useStore();
  const { now } = useReminders();
  const today = todayKey(now);
  const [selected, setSelected] = useState<DateKey>(today);
  const [month, setMonth] = useState<DateKey>(() => addMonths(today, 0));
  const [adding, setAdding] = useState(false);
  const { weekStartsOn } = data.settings;

  // Шесть недель, начиная с недели, в которую попадает первое число месяца.
  const cells = useMemo(() => {
    const first = startOfWeek(month, weekStartsOn);
    return Array.from({ length: 42 }, (_, i) => {
      const date = addDays(first, i);
      const categories = new Set<Category>();
      for (const item of agendaFor(data, date, now)) categories.add(item.kind === 'dose' ? 'medication' : item.event.category);
      return { date, categories: [...categories] };
    });
  }, [data, month, weekStartsOn, now]);

  const monthIndex = fromDateKey(month).getMonth();
  const items = agendaFor(data, selected, now);

  function go(delta: number) {
    setMonth(addMonths(month, delta));
  }
  function pick(date: DateKey) {
    setSelected(date);
    if (fromDateKey(date).getMonth() !== monthIndex) setMonth(addMonths(date, 0));
  }

  return (
    <>
      <PageHeader
        title="Календарь"
        action={<Button variant="primary" onClick={() => setAdding(true)}><Plus size={17} />Событие</Button>}
      />

      <Card className="p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between">
          <IconButton label="Предыдущий месяц" onClick={() => go(-1)}><ChevronLeft size={19} /></IconButton>
          <button type="button" onClick={() => { setMonth(addMonths(today, 0)); setSelected(today); }} className="rounded-xl px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">
            {formatMonth(month)}
          </button>
          <IconButton label="Следующий месяц" onClick={() => go(1)}><ChevronRight size={19} /></IconButton>
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-400">
          {orderedWeekdays(weekStartsOn).map((d) => <div key={d} className="py-1.5">{WEEKDAY_SHORT[d]}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map(({ date, categories }) => {
            const inMonth = fromDateKey(date).getMonth() === monthIndex;
            const isSelected = date === selected;
            const isToday = date === today;
            return (
              <button
                key={date}
                type="button"
                onClick={() => pick(date)}
                aria-label={`${formatLongDate(date)}${categories.length ? ', есть события' : ''}`}
                aria-pressed={isSelected}
                className="group flex flex-col items-center gap-1 rounded-xl py-1"
              >
                <span
                  className={`grid size-9 place-items-center rounded-full text-sm transition-colors ${
                    isSelected
                      ? 'bg-violet-600 font-semibold text-white'
                      : isToday
                        ? 'font-semibold text-violet-600 ring-1 ring-violet-300 dark:text-violet-300 dark:ring-violet-500/50'
                        : inMonth
                          ? 'group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                          : 'text-slate-300 group-hover:bg-slate-100 dark:text-slate-600 dark:group-hover:bg-slate-800'
                  }`}
                >
                  {fromDateKey(date).getDate()}
                </span>
                <span className="flex h-1.5 gap-0.5" aria-hidden>
                  {categories.slice(0, 4).map((c) => <span key={c} className={`size-1.5 rounded-full ${CATEGORY_META[c].dot} ${inMonth ? '' : 'opacity-40'}`} />)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-slate-100 px-1 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5"><span className={`size-2 rounded-full ${CATEGORY_META[c].dot}`} />{CATEGORY_META[c].label}</span>
          ))}
        </div>
      </Card>

      <SectionTitle><span className="inline-block first-letter:uppercase">{formatLongDate(selected)}</span>{selected === today && ' · сегодня'}</SectionTitle>
      {items.length > 0 ? (
        <AgendaList items={items} />
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="В этот день ничего нет"
          text="Добавьте событие — оно появится в календаре и в списке дня."
          action={<Button variant="primary" onClick={() => setAdding(true)}><Plus size={17} />Добавить событие</Button>}
        />
      )}

      {adding && <EventForm defaultDate={selected} onClose={() => setAdding(false)} />}
    </>
  );
}
