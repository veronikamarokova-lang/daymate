import { useState } from 'react';
import { BellRing, CalendarPlus, Check, ListChecks, Pill, Plus, Sparkles, Sun } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useReminders } from '../reminders/ReminderProvider';
import { agendaFor, isCompleted } from '../domain/agenda';
import { habitCount, habitScheduledOn } from '../domain/habits';
import { percent } from '../domain/stats';
import { saveEvent, saveHabit, setHabitCount } from '../store/mutations';
import { formatClock, formatLongDate, todayKey } from '../lib/date';
import { HABIT_COLORS } from '../lib/categories';
import { newId } from '../lib/id';
import type { AppData, Category, HabitColor } from '../models/types';
import { AgendaList } from '../components/events/AgendaList';
import { EventForm } from '../components/events/EventForm';
import { MedicationForm } from '../components/medications/MedicationForm';
import { Button } from '../components/ui/Button';
import { Card, EmptyState, Fab, ProgressRing, SectionTitle } from '../components/ui/misc';
import { Modal } from '../components/ui/Modal';
import { hrefFor } from '../components/layout/nav';

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

/** Пример дня для первого знакомства. Лекарства в пример не входят: их расписание задаёт только пользователь. */
function withSampleDay(data: AppData, today: string): AppData {
  const now = new Date().toISOString();
  const sample: [string, string, Category][] = [
    ['10:30', 'Занятия в университете', 'study'],
    ['14:00', 'Обед и прогулка', 'health'],
    ['18:00', 'Сделать домашнее задание', 'study'],
    ['22:00', 'Подготовиться ко сну', 'personal'],
  ];
  let next = data;
  for (const [time, title, category] of sample) {
    next = saveEvent(next, {
      id: newId(), title, category, date: today, time, recurrence: { freq: 'none', interval: 1 }, exdates: [],
      reminder: { enabled: true, offsetMin: 0 }, createdAt: now, updatedAt: now,
    });
  }
  const habits: [string, HabitColor, number][] = [['Выпивать воду', 'sky', 8], ['Делать зарядку', 'emerald', 1], ['Читать', 'violet', 1]];
  for (const [name, color, targetPerDay] of habits) {
    next = saveHabit(next, { id: newId(), name, color, targetPerDay, frequency: { type: 'daily' }, createdAt: today, archived: false });
  }
  return next;
}

export function TodayPage() {
  const { data, update } = useStore();
  const { now, next } = useReminders();
  const [adding, setAdding] = useState<'menu' | 'event' | 'medication' | null>(null);
  const today = todayKey(now);
  const items = agendaFor(data, today, now);
  const completed = items.filter(isCompleted).length;
  const progress = percent(completed, items.length);
  const habits = data.habits.filter((h) => !h.archived && habitScheduledOn(h, today));
  const isFresh = data.events.length === 0 && data.medications.length === 0 && data.habits.length === 0;
  const name = data.settings.userName.trim();

  return (
    <>
      <header className="mb-5">
        <p className="text-sm text-slate-500 first-letter:uppercase dark:text-slate-400">{formatLongDate(today)}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{greeting(now)}{name && `, ${name}`}</h1>
      </header>

      <Card className="flex items-center gap-5 p-5">
        <ProgressRing value={progress}>
          <span className="text-lg font-semibold">{progress}%</span>
        </ProgressRing>
        <div className="grid flex-1 grid-cols-2 gap-3">
          <div>
            <div className="text-2xl font-semibold">{items.length}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">запланировано</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-violet-600 dark:text-violet-300">{completed}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">выполнено</div>
          </div>
          <p className="col-span-2 text-xs text-slate-500 dark:text-slate-400">
            {items.length === 0 ? 'На сегодня пока ничего нет.' : completed === items.length ? 'Всё на сегодня сделано.' : `Осталось: ${items.length - completed}`}
          </p>
        </div>
      </Card>

      <Card className="mt-3 flex items-center gap-3 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"><BellRing size={19} /></span>
        <div className="min-w-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">Ближайшее напоминание</div>
          {next ? (
            <div className="truncate text-sm font-medium">
              {todayKey(new Date(next.fireAt)) === today ? 'Сегодня' : 'Завтра'} в {formatClock(new Date(next.fireAt), data.settings.timeFormat)} — {next.title}
            </div>
          ) : (
            <div className="text-sm font-medium">Нет запланированных напоминаний</div>
          )}
        </div>
      </Card>

      <SectionTitle>Сегодня</SectionTitle>
      {items.length > 0 ? (
        <AgendaList items={items} />
      ) : (
        <EmptyState
          icon={Sun}
          title={isFresh ? 'Добро пожаловать в DayMate' : 'Свободный день'}
          text={isFresh ? 'Добавьте первое событие или лекарство — или посмотрите, как выглядит заполненный день.' : 'На сегодня ничего не запланировано. Добавьте событие кнопкой «+».'}
          action={
            <>
              <Button variant="primary" onClick={() => setAdding('event')}><Plus size={17} />Добавить событие</Button>
              {isFresh && <Button onClick={() => update((d) => withSampleDay(d, today))}>Заполнить примером</Button>}
            </>
          }
        />
      )}

      {habits.length > 0 && (
        <>
          <SectionTitle aside={<a href={hrefFor('habits')} className="rounded-lg text-xs font-medium text-violet-600 dark:text-violet-300">Все привычки</a>}>Привычки</SectionTitle>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {habits.map((h) => {
              const count = habitCount(data.habitLogs, h.id, today);
              const met = count >= h.targetPerDay;
              const c = HABIT_COLORS[h.color];
              return (
                <button
                  key={h.id}
                  type="button"
                  aria-label={`${h.name}: ${count} из ${h.targetPerDay}. ${met ? 'Сбросить' : 'Отметить'}`}
                  onClick={() => update((d) => setHabitCount(d, h.id, today, met ? 0 : count + 1))}
                  className="flex items-center gap-3 rounded-3xl border border-slate-100 bg-white p-3.5 text-left transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full ${met ? `${c.fill} text-white` : `${c.soft} ${c.text}`}`}>
                    {met ? <Check size={17} strokeWidth={3} /> : <Sparkles size={16} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{h.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{count}/{h.targetPerDay}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <Fab label="Быстро добавить" onClick={() => setAdding('menu')}><Plus size={26} /></Fab>

      {adding === 'menu' && (
        <Modal title="Что добавить?" onClose={() => setAdding(null)}>
          <div className="grid gap-2.5">
            {([
              ['event', CalendarPlus, 'Событие или задачу', 'Встреча, занятие, дело на день'],
              ['medication', Pill, 'Лекарство', 'Расписание приёма с напоминаниями'],
            ] as const).map(([kind, Icon, title, text]) => (
              <button key={kind} type="button" onClick={() => setAdding(kind)} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-left transition-colors hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700">
                <span className="grid size-10 place-items-center rounded-xl bg-white text-violet-600 shadow-sm dark:bg-slate-900 dark:text-violet-300"><Icon size={19} /></span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{text}</span>
                </span>
              </button>
            ))}
            <a href={hrefFor('habits')} onClick={() => setAdding(null)} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 transition-colors hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700">
              <span className="grid size-10 place-items-center rounded-xl bg-white text-violet-600 shadow-sm dark:bg-slate-900 dark:text-violet-300"><ListChecks size={19} /></span>
              <span>
                <span className="block text-sm font-semibold">Привычку</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Перейти к трекеру привычек</span>
              </span>
            </a>
          </div>
        </Modal>
      )}
      {adding === 'event' && <EventForm defaultDate={today} onClose={() => setAdding(null)} />}
      {adding === 'medication' && <MedicationForm onClose={() => setAdding(null)} />}
    </>
  );
}
