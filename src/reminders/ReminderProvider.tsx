import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../store/AppStore';
import { logDose, setEventStatus } from '../store/mutations';
import {
  activeReminders, decideDeliveries, nextReminder, planReminders, type Ledger, type ReminderInstance,
} from './plan';
import { closeSystemNotification, onReminderAction, showSystemNotification } from './notifier';
import { isNative, syncNativeSchedule } from './native';

const LEDGER_KEY = 'daymate:reminders:v1';
const TICK_MS = 15_000;

function readLedger(): Ledger {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LEDGER_KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null ? (parsed as Ledger) : {};
  } catch {
    return {};
  }
}

function writeLedger(ledger: Ledger) {
  try { localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger)); } catch { /* не критично */ }
}

interface ReminderValue {
  /** Текущее время; обновляется по тику, чтобы статусы на экране не устаревали. */
  now: Date;
  active: ReminderInstance[];
  next?: ReminderInstance;
  /** Ключи напоминаний, которые сработали с опозданием (приложение было закрыто). */
  lateKeys: ReadonlySet<string>;
  takeDose: (r: Pick<ReminderInstance, 'refId' | 'date' | 'time'>) => void;
  skipDose: (r: Pick<ReminderInstance, 'refId' | 'date' | 'time'>) => void;
  snoozeDose: (r: Pick<ReminderInstance, 'refId' | 'date' | 'time'>) => void;
  completeEvent: (r: Pick<ReminderInstance, 'refId' | 'date'>) => void;
  /** Скрывает напоминание и прекращает его повторы, не меняя статус события. */
  dismiss: (r: ReminderInstance) => void;
}

/** Значение счётчика, означающее «пользователь скрыл напоминание». */
const DISMISSED = 999;

const ReminderContext = createContext<ReminderValue | null>(null);

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { data, update } = useStore();
  const [now, setNow] = useState(() => new Date());
  const [lateKeys, setLateKeys] = useState<ReadonlySet<string>>(new Set());
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(
    () => new Set(Object.entries(readLedger()).filter(([, e]) => e.count >= DISMISSED).map(([key, e]) => `${key}@${e.fireAt}`)),
  );
  const dataRef = useRef(data);
  dataRef.current = data;

  const tick = useCallback(() => {
    const current = new Date();
    setNow(current);
    const { settings } = dataRef.current;
    const plan = planReminders(dataRef.current, current);
    // Журнал читается заново на каждом тике: так две открытые вкладки не дублируют уведомления.
    const { deliveries, ledger } = decideDeliveries(plan, readLedger(), current, settings);
    writeLedger(ledger);
    if (deliveries.length === 0) return;

    const late = deliveries.filter((d) => d.late).map((d) => d.reminder.key);
    if (late.length) setLateKeys((prev) => new Set([...prev, ...late]));

    if (!settings.notificationsEnabled) return;
    for (const d of deliveries) {
      const prefix = d.late ? 'Напоминание пришло с опозданием. ' : d.repeat > 0 ? `Повтор ${d.repeat}. ` : '';
      void showSystemNotification(d.reminder, prefix + d.reminder.body);
    }
  }, []);

  useEffect(() => {
    tick();
    const id = window.setInterval(tick, TICK_MS);
    // Таймеры в фоновых вкладках замедляются, поэтому сверяемся при каждом возвращении.
    const onWake = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('pageshow', onWake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('pageshow', onWake);
    };
  }, [tick]);

  // Данные изменились (новое событие, «отложить») — пересчитываем сразу, не дожидаясь тика.
  useEffect(() => { tick(); }, [data, tick]);

  // Android-приложение: передаём расписание системе при каждом изменении данных и при возвращении в приложение.
  useEffect(() => {
    if (!isNative) return;
    const sync = () => void syncNativeSchedule(dataRef.current, dismissed);
    const timer = window.setTimeout(sync, 300);
    const onWake = () => { if (document.visibilityState === 'visible') sync(); };
    document.addEventListener('visibilitychange', onWake);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [data, dismissed]);

  const value = useMemo<ReminderValue>(() => {
    const plan = planReminders(data, now);
    const done = (key: string) => closeSystemNotification(key);
    return {
      now,
      active: activeReminders(plan, now).filter((r) => !dismissed.has(`${r.key}@${r.fireAt}`)),
      next: nextReminder(plan, now),
      lateKeys,
      takeDose: (r) => { update((d) => logDose(d, r.refId, r.date, r.time, 'taken')); done(`dose:${r.refId}:${r.date}:${r.time}`); },
      skipDose: (r) => { update((d) => logDose(d, r.refId, r.date, r.time, 'skipped')); done(`dose:${r.refId}:${r.date}:${r.time}`); },
      snoozeDose: (r) => {
        update((d) => {
          const until = new Date(Date.now() + d.settings.snoozeMinutes * 60_000).toISOString();
          return logDose(d, r.refId, r.date, r.time, 'snoozed', until);
        });
        done(`dose:${r.refId}:${r.date}:${r.time}`);
      },
      completeEvent: (r) => { update((d) => setEventStatus(d, r.refId, r.date, 'done')); done(`event:${r.refId}:${r.date}`); },
      dismiss: (r) => {
        writeLedger({ ...readLedger(), [r.key]: { fireAt: r.fireAt, count: DISMISSED, lastAt: Date.now() } });
        setDismissed((prev) => new Set([...prev, `${r.key}@${r.fireAt}`]));
        done(r.key);
      },
    };
  }, [data, now, lateKeys, dismissed, update]);

  // Кнопки системного уведомления («Принял», «Отложить») приходят через service worker.
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(
    () =>
      onReminderAction((msg) => {
        const v = valueRef.current;
        if (msg.action === 'taken' && msg.reminder.kind === 'dose') v.takeDose(msg.reminder);
        else if (msg.action === 'snooze' && msg.reminder.kind === 'dose') v.snoozeDose(msg.reminder);
        else if (msg.action === 'skip' && msg.reminder.kind === 'dose') v.skipDose(msg.reminder);
        else if (msg.action === 'done' && msg.reminder.kind === 'event') v.completeEvent(msg.reminder);
        else window.location.hash = '#/';
      }),
    [],
  );

  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}

export function useReminders(): ReminderValue {
  const ctx = useContext(ReminderContext);
  if (!ctx) throw new Error('useReminders должен вызываться внутри ReminderProvider');
  return ctx;
}
