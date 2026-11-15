import type {
  AppData, Category, DoseLog, EventLog, Habit, HabitLogs, Medication, PlannerEvent, Recurrence, Settings,
} from '../models/types';
import { deviceTimeZone, isValidDateKey, isValidTime, todayKey } from '../lib/date';

export const SCHEMA_VERSION = 1;

export function defaultSettings(): Settings {
  return {
    userName: '',
    theme: 'system',
    notificationsEnabled: false,
    snoozeMinutes: 10,
    repeatMinutes: 10,
    maxRepeats: 3,
    loudRepeat: true,
    timeFormat: '24h',
    weekStartsOn: 1,
    lastTimeZone: deviceTimeZone(),
  };
}

export function emptyData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: defaultSettings(),
    events: [],
    eventLogs: [],
    medications: [],
    doseLogs: [],
    habits: [],
    habitLogs: {},
  };
}

export class DataFormatError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const weekdays = (v: unknown) => [...new Set(list(v).filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))];

const CATEGORIES: Category[] = ['medication', 'study', 'work', 'personal', 'health', 'other'];

function parseRecurrence(v: unknown): Recurrence {
  if (!isObj(v)) return { freq: 'none', interval: 1 };
  const rule: Recurrence = {
    freq: oneOf(v.freq, ['none', 'daily', 'weekly', 'monthly'] as const, 'none'),
    interval: num(v.interval, 1, 1, 365),
  };
  const days = weekdays(v.byWeekday);
  if (days.length) rule.byWeekday = days;
  if (isValidDateKey(v.until)) rule.until = v.until;
  return rule;
}

function parseEvent(v: unknown): PlannerEvent | null {
  if (!isObj(v) || !str(v.id) || !str(v.title).trim() || !isValidDateKey(v.date)) return null;
  const reminder = isObj(v.reminder) ? v.reminder : {};
  const now = new Date().toISOString();
  return {
    id: str(v.id),
    title: str(v.title).trim().slice(0, 200),
    category: oneOf(v.category, CATEGORIES, 'other'),
    date: v.date,
    time: isValidTime(v.time) ? v.time : undefined,
    notes: str(v.notes).slice(0, 2000) || undefined,
    kind: v.kind === 'class' ? 'class' : undefined,
    endTime: isValidTime(v.endTime) ? v.endTime : undefined,
    location: str(v.location).trim().slice(0, 200) || undefined,
    teacher: str(v.teacher).trim().slice(0, 200) || undefined,
    classType: str(v.classType).trim().slice(0, 60) || undefined,
    recurrence: parseRecurrence(v.recurrence),
    exdates: list(v.exdates).filter(isValidDateKey),
    reminder: { enabled: reminder.enabled === true, offsetMin: num(reminder.offsetMin, 0, 0, 24 * 60) },
    createdAt: str(v.createdAt, now),
    updatedAt: str(v.updatedAt, now),
  };
}

function parseMedication(v: unknown): Medication | null {
  if (!isObj(v) || !str(v.id) || !str(v.name).trim() || !isValidDateKey(v.startDate)) return null;
  const times = [...new Set(list(v.times).filter(isValidTime))].sort();
  if (!times.length) return null;
  const now = new Date().toISOString();
  return {
    id: str(v.id),
    name: str(v.name).trim().slice(0, 200),
    dosage: str(v.dosage).slice(0, 200),
    form: oneOf(v.form, ['tablet', 'capsule', 'liquid', 'drops', 'injection', 'spray', 'ointment', 'other'] as const, 'other'),
    times,
    startDate: v.startDate,
    endDate: isValidDateKey(v.endDate) ? v.endDate : undefined,
    recurrence: parseRecurrence(v.recurrence),
    notes: str(v.notes).slice(0, 2000) || undefined,
    remindersEnabled: v.remindersEnabled !== false,
    active: v.active !== false,
    createdAt: str(v.createdAt, now),
    updatedAt: str(v.updatedAt, now),
  };
}

function parseHabit(v: unknown): Habit | null {
  if (!isObj(v) || !str(v.id) || !str(v.name).trim()) return null;
  const f = isObj(v.frequency) ? v.frequency : {};
  const days = weekdays(f.days);
  return {
    id: str(v.id),
    name: str(v.name).trim().slice(0, 120),
    color: oneOf(v.color, ['violet', 'sky', 'emerald', 'amber', 'rose'] as const, 'violet'),
    frequency: f.type === 'weekdays' && days.length ? { type: 'weekdays', days } : { type: 'daily' },
    targetPerDay: num(v.targetPerDay, 1, 1, 99),
    createdAt: isValidDateKey(v.createdAt) ? v.createdAt : todayKey(),
    archived: v.archived === true,
  };
}

function parseSettings(v: unknown): Settings {
  const d = defaultSettings();
  if (!isObj(v)) return d;
  return {
    userName: str(v.userName).slice(0, 60),
    theme: oneOf(v.theme, ['light', 'dark', 'system'] as const, d.theme),
    notificationsEnabled: v.notificationsEnabled === true,
    snoozeMinutes: num(v.snoozeMinutes, d.snoozeMinutes, 1, 180),
    repeatMinutes: num(v.repeatMinutes, d.repeatMinutes, 1, 120),
    maxRepeats: num(v.maxRepeats, d.maxRepeats, 0, 10),
    loudRepeat: v.loudRepeat !== false,
    timeFormat: oneOf(v.timeFormat, ['24h', '12h'] as const, d.timeFormat),
    weekStartsOn: v.weekStartsOn === 0 ? 0 : 1,
    lastTimeZone: str(v.lastTimeZone, d.lastTimeZone),
  };
}

const compact = <T>(items: (T | null)[]): T[] => items.filter((x): x is T => x !== null);

/**
 * Проверяет и нормализует данные из хранилища или файла импорта.
 * Повреждённые записи отбрасываются, а не ломают приложение.
 */
export function parseAppData(raw: unknown): AppData {
  if (!isObj(raw)) throw new DataFormatError('Файл не похож на данные DayMate.');
  const version = raw.schemaVersion;
  if (typeof version !== 'number') throw new DataFormatError('В файле нет версии данных DayMate.');
  if (version > SCHEMA_VERSION) {
    throw new DataFormatError('Файл создан в более новой версии DayMate. Обновите приложение.');
  }
  // Здесь будут миграции: if (version < 2) raw = migrateV1toV2(raw) …

  const events = compact(list(raw.events).map(parseEvent));
  const medications = compact(list(raw.medications).map(parseMedication));
  const habits = compact(list(raw.habits).map(parseHabit));
  const eventIds = new Set(events.map((e) => e.id));
  const medIds = new Set(medications.map((m) => m.id));
  const habitIds = new Set(habits.map((h) => h.id));

  const eventLogs: EventLog[] = [];
  for (const l of list(raw.eventLogs)) {
    if (!isObj(l) || !eventIds.has(str(l.eventId)) || !isValidDateKey(l.date)) continue;
    eventLogs.push({ eventId: str(l.eventId), date: l.date, status: oneOf(l.status, ['done', 'skipped', 'cancelled'] as const, 'done'), at: str(l.at) });
  }

  const doseLogs: DoseLog[] = [];
  for (const l of list(raw.doseLogs)) {
    if (!isObj(l) || !medIds.has(str(l.medicationId)) || !isValidDateKey(l.date) || !isValidTime(l.time)) continue;
    const status = oneOf(l.status, ['taken', 'skipped', 'snoozed'] as const, 'snoozed');
    doseLogs.push({
      medicationId: str(l.medicationId), date: l.date, time: l.time, status, at: str(l.at),
      snoozedUntil: status === 'snoozed' ? str(l.snoozedUntil) || undefined : undefined,
    });
  }

  const habitLogs: HabitLogs = {};
  if (isObj(raw.habitLogs)) {
    for (const [id, days] of Object.entries(raw.habitLogs)) {
      if (!habitIds.has(id) || !isObj(days)) continue;
      const clean: Record<string, number> = {};
      for (const [date, count] of Object.entries(days)) {
        if (isValidDateKey(date) && typeof count === 'number' && count > 0) clean[date] = Math.min(99, Math.floor(count));
      }
      habitLogs[id] = clean;
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    settings: parseSettings(raw.settings),
    events, eventLogs, medications, doseLogs, habits, habitLogs,
  };
}
