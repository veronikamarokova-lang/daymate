import { describe, expect, it } from 'vitest';
import type { AppData, Habit, Medication, PlannerEvent } from '../models/types';
import { occursOn } from '../domain/schedule';
import { agendaFor, doseStatus } from '../domain/agenda';
import { bestStreak, currentStreak } from '../domain/habits';
import { computeStats } from '../domain/stats';
import { decideDeliveries, planReminders } from '../reminders/plan';
import { emptyData, parseAppData } from '../storage/schema';
import { deleteEvent, excludeEventDate, logDose, saveEvent, saveMedication, setEventStatus, setHabitCount } from '../store/mutations';
import { at } from '../lib/date';

const event = (over: Partial<PlannerEvent> = {}): PlannerEvent => ({
  id: 'e1', title: 'Учёба', category: 'study', date: '2026-11-16', time: '10:30',
  recurrence: { freq: 'none', interval: 1 }, exdates: [], reminder: { enabled: true, offsetMin: 10 },
  createdAt: '', updatedAt: '', ...over,
});
const med = (over: Partial<Medication> = {}): Medication => ({
  id: 'm1', name: 'Препарат', dosage: '', form: 'tablet', times: ['09:00', '21:00'], startDate: '2026-11-10',
  recurrence: { freq: 'daily', interval: 1 }, remindersEnabled: true, active: true, createdAt: '', updatedAt: '', ...over,
});
const habit: Habit = { id: 'h1', name: 'Вода', color: 'sky', frequency: { type: 'daily' }, targetPerDay: 2, createdAt: '2026-11-10', archived: false };

describe('расписание', () => {
  it('одноразовое событие — только в свой день', () => {
    expect(occursOn({ freq: 'none', interval: 1 }, '2026-11-16', '2026-11-16')).toBe(true);
    expect(occursOn({ freq: 'none', interval: 1 }, '2026-11-16', '2026-11-17')).toBe(false);
  });
  it('каждые 2 дня, с датой окончания и исключениями', () => {
    const r = { freq: 'daily' as const, interval: 2, until: '2026-11-20' };
    expect(occursOn(r, '2026-11-16', '2026-11-18')).toBe(true);
    expect(occursOn(r, '2026-11-16', '2026-11-17')).toBe(false);
    expect(occursOn(r, '2026-11-16', '2026-11-22')).toBe(false);
    expect(occursOn(r, '2026-11-16', '2026-11-18', ['2026-11-18'])).toBe(false);
  });
  it('по дням недели через неделю', () => {
    const r = { freq: 'weekly' as const, interval: 2, byWeekday: [1, 3] }; // пн, ср; старт — пн 16.11
    expect(occursOn(r, '2026-11-16', '2026-11-18')).toBe(true);
    expect(occursOn(r, '2026-11-16', '2026-11-23')).toBe(false);
    expect(occursOn(r, '2026-11-16', '2026-11-30')).toBe(true);
  });
  it('ежемесячно 31-го — в коротком месяце в последний день', () => {
    const r = { freq: 'monthly' as const, interval: 1 };
    expect(occursOn(r, '2026-01-31', '2026-02-28')).toBe(true);
    expect(occursOn(r, '2026-01-31', '2026-03-31')).toBe(true);
    expect(occursOn(r, '2026-01-31', '2026-03-28')).toBe(false);
  });
  it('переход на летнее/зимнее время не сдвигает дни', () => {
    expect(occursOn({ freq: 'daily', interval: 7 }, '2026-03-20', '2026-04-03')).toBe(true);
  });
});

describe('приёмы лекарств', () => {
  it('наступившее время не означает «принято»', () => {
    const now = at('2026-11-16', '09:30');
    expect(doseStatus(undefined, '2026-11-16', '09:00', now)).toBe('due');
    expect(doseStatus(undefined, '2026-11-16', '21:00', now)).toBe('upcoming');
    expect(doseStatus(undefined, '2026-11-15', '09:00', now)).toBe('missed');
  });
  it('отложенный приём снова «пора принять» после срока', () => {
    const log = { medicationId: 'm1', date: '2026-11-16', time: '09:00', status: 'snoozed' as const, at: '', snoozedUntil: at('2026-11-16', '09:20').toISOString() };
    expect(doseStatus(log, '2026-11-16', '09:00', at('2026-11-16', '09:10'))).toBe('snoozed');
    expect(doseStatus(log, '2026-11-16', '09:00', at('2026-11-16', '09:25'))).toBe('due');
  });
  it('список дня идёт в хронологическом порядке и учитывает отметки', () => {
    let d: AppData = saveMedication(saveEvent(emptyData(), event()), med());
    d = logDose(d, 'm1', '2026-11-16', '09:00', 'taken');
    const items = agendaFor(d, '2026-11-16', at('2026-11-16', '12:00'));
    expect(items.map((i) => i.time)).toEqual(['09:00', '10:30', '21:00']);
    expect(items[0].status).toBe('taken');
  });
  it('приостановленный препарат не попадает в расписание', () => {
    const d = saveMedication(emptyData(), med({ active: false }));
    expect(agendaFor(d, '2026-11-16')).toHaveLength(0);
  });
});

describe('события', () => {
  it('исключение одной даты из серии и удаление с историей', () => {
    let d = saveEvent(emptyData(), event({ recurrence: { freq: 'daily', interval: 1 } }));
    d = setEventStatus(d, 'e1', '2026-11-17', 'done');
    d = excludeEventDate(d, 'e1', '2026-11-17');
    expect(agendaFor(d, '2026-11-17')).toHaveLength(0);
    expect(agendaFor(d, '2026-11-18')).toHaveLength(1);
    expect(d.eventLogs).toHaveLength(0);
    expect(deleteEvent(d, 'e1').events).toHaveLength(0);
  });
});

describe('привычки', () => {
  it('серия считает подряд идущие дни и не рвётся из-за незавершённого сегодня', () => {
    let d = saveEvent(emptyData(), event());
    d = { ...d, habits: [habit] };
    for (const day of ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']) d = setHabitCount(d, 'h1', day, 2);
    d = setHabitCount(d, 'h1', '2026-11-10', 2);
    d = setHabitCount(d, 'h1', '2026-11-16', 1); // цель 2 — сегодня ещё не выполнено
    expect(currentStreak(habit, d.habitLogs, '2026-11-16')).toBe(4);
    expect(bestStreak(habit, d.habitLogs, '2026-11-16')).toBe(4);
    d = setHabitCount(d, 'h1', '2026-11-16', 2);
    expect(currentStreak(habit, d.habitLogs, '2026-11-16')).toBe(5);
  });
});

describe('статистика', () => {
  it('будущие приёмы не считаются пропущенными', () => {
    let d = saveMedication(emptyData(), med({ startDate: '2026-11-16' }));
    d = logDose(d, 'm1', '2026-11-16', '09:00', 'taken');
    const s = computeStats(d, '2026-11-10', '2026-11-16', at('2026-11-16', '12:00'));
    expect(s.doses).toEqual({ total: 1, taken: 1, skipped: 0, unconfirmed: 0 });
  });
});

describe('напоминания', () => {
  const settings = { repeatMinutes: 5, maxRepeats: 2 };
  const d = saveMedication(saveEvent(emptyData(), event()), med({ times: ['09:00'] }));

  it('событие напоминает заранее, лекарство — в срок', () => {
    const plan = planReminders(d, at('2026-11-16', '08:00'));
    const e = plan.find((r) => r.key === 'event:e1:2026-11-16')!;
    expect(e.fireAt).toBe(at('2026-11-16', '10:20').getTime());
    expect(plan.some((r) => r.key === 'dose:m1:2026-11-16:09:00')).toBe(true);
  });
  it('срабатывает один раз, повторяет по интервалу и останавливается', () => {
    const run = (time: string, ledger = {}) => decideDeliveries(planReminders(d, at('2026-11-16', time)), ledger, at('2026-11-16', time), settings);
    const key = 'dose:m1:2026-11-16:09:00';
    const only = (r: ReturnType<typeof run>) => r.deliveries.filter((x) => x.reminder.key === key).length;
    const a = run('08:59');
    expect(only(a)).toBe(0);
    const b = run('09:00', a.ledger);
    expect(only(b)).toBe(1);
    const c = run('09:01', b.ledger); // перезагрузка страницы через минуту — без дубля
    expect(only(c)).toBe(0);
    const e = run('09:05', c.ledger);
    expect(only(e)).toBe(1);
    const f = run('09:10', e.ledger);
    expect(only(f)).toBe(1);
    const g = run('09:15', f.ledger); // лимит повторов исчерпан
    expect(only(g)).toBe(0);
  });
  it('после закрытого приложения напоминание помечается как опоздавшее', () => {
    const now = at('2026-11-16', '09:40');
    const { deliveries } = decideDeliveries(planReminders(d, now), {}, now, settings);
    expect(deliveries.find((x) => x.reminder.kind === 'dose')?.late).toBe(true);
  });
  it('подтверждённый приём больше не напоминает', () => {
    const taken = logDose(d, 'm1', '2026-11-16', '09:00', 'taken');
    expect(planReminders(taken, at('2026-11-16', '09:40')).some((r) => r.kind === 'dose' && r.date === '2026-11-16')).toBe(false);
  });
  it('«отложить» переносит срабатывание и запускает его заново', () => {
    const until = at('2026-11-16', '09:15');
    const snoozed = logDose(d, 'm1', '2026-11-16', '09:00', 'snoozed', until.toISOString());
    const ledger = { 'dose:m1:2026-11-16:09:00': { fireAt: at('2026-11-16', '09:00').getTime(), count: 3, lastAt: 0 } };
    expect(decideDeliveries(planReminders(snoozed, at('2026-11-16', '09:10')), ledger, at('2026-11-16', '09:10'), settings).deliveries).toHaveLength(0);
    expect(decideDeliveries(planReminders(snoozed, until), ledger, until, settings).deliveries).toHaveLength(1);
  });
});

describe('импорт данных', () => {
  it('сохраняет корректные данные и отбрасывает мусор', () => {
    const d = logDose(saveMedication(saveEvent(emptyData(), event()), med()), 'm1', '2026-11-16', '09:00', 'taken');
    const round = parseAppData(JSON.parse(JSON.stringify(d)));
    expect(round.events).toHaveLength(1);
    expect(round.doseLogs).toHaveLength(1);
    const dirty = parseAppData({ schemaVersion: 1, events: [{ id: 'x' }, null, 5], doseLogs: [{ medicationId: 'нет' }], habits: 'oops' });
    expect(dirty.events).toHaveLength(0);
    expect(dirty.doseLogs).toHaveLength(0);
  });
  it('отклоняет чужие файлы и более новые версии', () => {
    expect(() => parseAppData([1, 2])).toThrow();
    expect(() => parseAppData({ foo: 1 })).toThrow();
    expect(() => parseAppData({ schemaVersion: 99 })).toThrow();
  });
});

describe('расписание для Android', () => {
  it('без ответа через 10 минут идёт громкий повтор, после ответа повторы исчезают', async () => {
    const { buildNativeSchedule, CHANNEL_REMINDER, CHANNEL_REPEAT_LOUD } = await import('../reminders/nativeSchedule');
    const base = saveMedication(emptyData(), med({ times: ['09:00'], startDate: '2026-11-16', endDate: '2026-11-16' }));
    const now = at('2026-11-16', '08:00');
    const { notifications } = buildNativeSchedule(base, now);
    expect(notifications).toHaveLength(4); // первое + 3 повтора по умолчанию
    expect(notifications[0].channelId).toBe(CHANNEL_REMINDER);
    expect(notifications[1].channelId).toBe(CHANNEL_REPEAT_LOUD);
    expect(notifications[1].at - notifications[0].at).toBe(10 * 60_000);
    expect(new Set(notifications.map((n) => n.id)).size).toBe(4);

    // первое уже показано — в плане остаются только будущие повторы
    expect(buildNativeSchedule(base, at('2026-11-16', '09:05')).notifications.map((n) => n.attempt)).toEqual([1, 2, 3]);

    const taken = logDose(base, 'm1', '2026-11-16', '09:00', 'taken');
    expect(buildNativeSchedule(taken, at('2026-11-16', '09:05')).notifications).toHaveLength(0);

    const quiet = { ...base, settings: { ...base.settings, loudRepeat: false } };
    expect(buildNativeSchedule(quiet, now).notifications.every((n) => n.channelId === CHANNEL_REMINDER)).toBe(true);
  });
});
