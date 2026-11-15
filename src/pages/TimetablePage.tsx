import { useState } from 'react';
import { ChevronLeft, ChevronRight, GraduationCap, Plus } from 'lucide-react';
import type { DateKey } from '../models/types';
import { useStore } from '../store/AppStore';
import { useReminders } from '../reminders/ReminderProvider';
import { eventsOn, type EventItem } from '../domain/agenda';
import { addDays, formatLongDate, formatShortDate, fromDateKey, startOfWeek, todayKey, WEEKDAY_SHORT, weekdayOf } from '../lib/date';
import { AgendaList } from '../components/events/AgendaList';
import { ClassForm } from '../components/events/ClassForm';
import { Button, IconButton } from '../components/ui/Button';
import { Card, EmptyState, PageHeader, SectionTitle } from '../components/ui/misc';

export function TimetablePage() {
  const { data } = useStore();
  const { now } = useReminders();
  const today = todayKey(now);
  const [selected, setSelected] = useState<DateKey>(today);
  const [adding, setAdding] = useState(false);
  const weekStart = startOfWeek(selected, data.settings.weekStartsOn);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const classesOn = (date: DateKey): EventItem[] =>
    eventsOn(data, date)
      .filter((e) => e.event.kind === 'class')
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

  const hasAnyClass = data.events.some((e) => e.kind === 'class');
  const items = classesOn(selected);
  const active = items.filter((i) => i.status !== 'cancelled').length;

  return (
    <>
      <PageHeader
        title="Расписание"
        subtitle="Занятия в вузе"
        action={<Button variant="primary" onClick={() => setAdding(true)}><Plus size={17} />Занятие</Button>}
      />

      {!hasAnyClass ? (
        <EmptyState
          icon={GraduationCap}
          title="Расписание пока пустое"
          text="Добавьте пары: предмет, время и аудиторию. За 10 минут до начала придёт напоминание, где занятие."
          action={<Button variant="primary" onClick={() => setAdding(true)}><Plus size={17} />Добавить занятие</Button>}
        />
      ) : (
        <>
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <IconButton label="Предыдущая неделя" onClick={() => setSelected(addDays(selected, -7))}><ChevronLeft size={19} /></IconButton>
              <button type="button" onClick={() => setSelected(today)} className="rounded-xl px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">
                {formatShortDate(week[0])} — {formatShortDate(week[6])}
              </button>
              <IconButton label="Следующая неделя" onClick={() => setSelected(addDays(selected, 7))}><ChevronRight size={19} /></IconButton>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {week.map((d) => {
                const count = classesOn(d).filter((i) => i.status !== 'cancelled').length;
                const isSelected = d === selected;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${formatLongDate(d)}, занятий: ${count}`}
                    onClick={() => setSelected(d)}
                    className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors ${
                      isSelected ? 'bg-violet-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className={`text-[11px] ${isSelected ? 'text-violet-100' : d === today ? 'font-semibold text-violet-600 dark:text-violet-300' : 'text-slate-400'}`}>{WEEKDAY_SHORT[weekdayOf(d)]}</span>
                    <span className="text-sm font-semibold">{fromDateKey(d).getDate()}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-violet-100' : 'text-slate-400'}`}>{count > 0 ? `${count} ${count === 1 ? 'пара' : count < 5 ? 'пары' : 'пар'}` : '—'}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <SectionTitle aside={items.length > 0 && <span className="text-xs text-slate-500 dark:text-slate-400">Занятий: {active}</span>}>
            <span className="inline-block first-letter:uppercase">{formatLongDate(selected)}</span>{selected === today && ' · сегодня'}
          </SectionTitle>
          {items.length > 0 ? (
            <AgendaList items={items} />
          ) : (
            <Card className="p-4 text-sm text-slate-500 dark:text-slate-400">В этот день занятий нет.</Card>
          )}
          <p className="mt-4 px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Значок «отменить» убирает только одну пару в выбранный день — напоминание о ней не придёт, остальные занятия останутся.
            Занятия также видны в «Моём дне» и в календаре.
          </p>
        </>
      )}

      {adding && <ClassForm defaultDate={selected} onClose={() => setAdding(false)} />}
    </>
  );
}
