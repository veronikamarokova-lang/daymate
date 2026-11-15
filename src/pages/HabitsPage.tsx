import { useState } from 'react';
import { Check, Flame, Minus, Pencil, Plus, Sparkles, Trash2, Trophy } from 'lucide-react';
import type { Habit } from '../models/types';
import { useStore } from '../store/AppStore';
import { useReminders } from '../reminders/ReminderProvider';
import { deleteHabit, setHabitCount } from '../store/mutations';
import { bestStreak, currentStreak, describeFrequency, habitCount, habitMet, habitScheduledOn } from '../domain/habits';
import { percent } from '../domain/stats';
import { addDays, formatShortDate, fromDateKey, rangeKeys, todayKey, WEEKDAY_SHORT, weekdayOf } from '../lib/date';
import { HABIT_COLORS } from '../lib/categories';
import { HabitForm } from '../components/habits/HabitForm';
import { Button, IconButton } from '../components/ui/Button';
import { Card, EmptyState, PageHeader } from '../components/ui/misc';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

const STRIP_DAYS = 14;

export function HabitsPage() {
  const { data, update } = useStore();
  const { now } = useReminders();
  const toast = useToast();
  const [form, setForm] = useState<{ habit?: Habit } | null>(null);
  const [removing, setRemoving] = useState<Habit | null>(null);
  const today = todayKey(now);
  const strip = rangeKeys(addDays(today, -(STRIP_DAYS - 1)), today);
  const month = rangeKeys(addDays(today, -29), today);

  return (
    <>
      <PageHeader
        title="Привычки"
        subtitle="Отмечайте каждый день — серия растёт"
        action={<Button variant="primary" onClick={() => setForm({})}><Plus size={17} />Добавить</Button>}
      />

      {data.habits.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Привычек пока нет"
          text="Начните с одной простой: например, стакан воды утром или десять минут чтения."
          action={<Button variant="primary" onClick={() => setForm({})}><Plus size={17} />Создать привычку</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {data.habits.map((h) => {
            const c = HABIT_COLORS[h.color];
            const count = habitCount(data.habitLogs, h.id, today);
            const scheduledToday = habitScheduledOn(h, today);
            const scheduled = month.filter((d) => habitScheduledOn(h, d));
            const met = scheduled.filter((d) => habitMet(h, data.habitLogs, d)).length;
            return (
              <li key={h.id}>
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${c.soft} ${c.text}`}><Sparkles size={19} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium break-words">{h.name}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {describeFrequency(h)}{h.targetPerDay > 1 && ` · ${h.targetPerDay} раз в день`}
                      </div>
                    </div>
                    <div className="flex shrink-0">
                      <IconButton label="Изменить" onClick={() => setForm({ habit: h })}><Pencil size={16} /></IconButton>
                      <IconButton label="Удалить" className="hover:text-rose-600 dark:hover:text-rose-400" onClick={() => setRemoving(h)}><Trash2 size={16} /></IconButton>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {scheduledToday ? (
                      h.targetPerDay === 1 ? (
                        <Button variant={count >= 1 ? 'secondary' : 'primary'} size="sm" onClick={() => update((d) => setHabitCount(d, h.id, today, count >= 1 ? 0 : 1))}>
                          <Check size={15} strokeWidth={3} />{count >= 1 ? 'Выполнено сегодня' : 'Отметить сегодня'}
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
                          <IconButton label="Убрать одну отметку" disabled={count === 0} onClick={() => update((d) => setHabitCount(d, h.id, today, count - 1))}><Minus size={16} /></IconButton>
                          <span className="min-w-14 text-center text-sm font-semibold">{count} / {h.targetPerDay}</span>
                          <IconButton label="Добавить отметку" disabled={count >= 99} onClick={() => update((d) => setHabitCount(d, h.id, today, count + 1))}><Plus size={16} /></IconButton>
                        </div>
                      )
                    ) : (
                      <span className="text-sm text-slate-500 dark:text-slate-400">Сегодня не запланировано</span>
                    )}
                    <div className="ml-auto flex items-center gap-3 text-sm">
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400" title="Текущая серия">
                        <Flame size={16} />{currentStreak(h, data.habitLogs, today)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400" title="Лучшая серия">
                        <Trophy size={15} />{bestStreak(h, data.habitLogs, today)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>История за {STRIP_DAYS} дней — нажмите на день, чтобы исправить</span>
                      <span>{percent(met, scheduled.length)}% за 30 дней</span>
                    </div>
                    <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1">
                      {strip.map((d) => {
                        const planned = habitScheduledOn(h, d);
                        const done = habitMet(h, data.habitLogs, d);
                        const partial = !done && habitCount(data.habitLogs, h.id, d) > 0;
                        return (
                          <button
                            key={d}
                            type="button"
                            disabled={!planned}
                            aria-label={`${formatShortDate(d)}: ${done ? 'выполнено' : planned ? 'не выполнено' : 'не запланировано'}`}
                            aria-pressed={done}
                            onClick={() => update((x) => setHabitCount(x, h.id, d, done ? 0 : h.targetPerDay))}
                            className="flex flex-col items-center gap-1 rounded-lg py-0.5 disabled:cursor-default"
                          >
                            <span className="text-[10px] text-slate-400">{WEEKDAY_SHORT[weekdayOf(d)]}</span>
                            <span
                              className={`grid aspect-square w-full max-w-8 place-items-center rounded-lg text-[11px] font-medium transition-colors ${
                                done
                                  ? `${c.fill} text-white`
                                  : partial
                                    ? `${c.soft} ${c.text}`
                                    : planned
                                      ? 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                                      : 'text-slate-300 dark:text-slate-700'
                              } ${d === today ? 'ring-1 ring-slate-400 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''}`}
                            >
                              {fromDateKey(d).getDate()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {form && <HabitForm habit={form.habit} onClose={() => setForm(null)} />}
      {removing && (
        <ConfirmDialog
          title="Удалить привычку?"
          message={<>«{removing.name}» будет удалена вместе со всей историей и серией.</>}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const snapshot = data;
            update((d) => deleteHabit(d, removing.id));
            toast('Привычка удалена', { undo: () => update(() => snapshot) });
            setRemoving(null);
          }}
        />
      )}
    </>
  );
}
