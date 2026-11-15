import type {
  AppData, DateKey, DoseAction, EventStatus, Habit, Medication, PlannerEvent, Settings, TimeOfDay,
} from '../models/types';

/** Чистые функции изменения данных: (данные, аргументы) → новые данные. */

export function updateSettings(data: AppData, patch: Partial<Settings>): AppData {
  return { ...data, settings: { ...data.settings, ...patch } };
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((x) => x.id === item.id) ? items.map((x) => (x.id === item.id ? item : x)) : [...items, item];
}

export function saveEvent(data: AppData, event: PlannerEvent): AppData {
  return { ...data, events: upsert(data.events, event) };
}

export function deleteEvent(data: AppData, id: string): AppData {
  return {
    ...data,
    events: data.events.filter((e) => e.id !== id),
    eventLogs: data.eventLogs.filter((l) => l.eventId !== id),
  };
}

/** Убирает один экземпляр из серии (удаление или перенос «только этого события»). */
export function excludeEventDate(data: AppData, id: string, date: DateKey): AppData {
  return {
    ...data,
    events: data.events.map((e) =>
      e.id === id ? { ...e, exdates: [...new Set([...e.exdates, date])], updatedAt: new Date().toISOString() } : e,
    ),
    eventLogs: data.eventLogs.filter((l) => !(l.eventId === id && l.date === date)),
  };
}

export function setEventStatus(data: AppData, id: string, date: DateKey, status: EventStatus | null): AppData {
  const rest = data.eventLogs.filter((l) => !(l.eventId === id && l.date === date));
  return {
    ...data,
    eventLogs: status ? [...rest, { eventId: id, date, status, at: new Date().toISOString() }] : rest,
  };
}

export function saveMedication(data: AppData, med: Medication): AppData {
  return { ...data, medications: upsert(data.medications, med) };
}

export function deleteMedication(data: AppData, id: string): AppData {
  return {
    ...data,
    medications: data.medications.filter((m) => m.id !== id),
    doseLogs: data.doseLogs.filter((l) => l.medicationId !== id),
  };
}

export function logDose(
  data: AppData, medicationId: string, date: DateKey, time: TimeOfDay,
  status: DoseAction | null, snoozedUntil?: string,
): AppData {
  const rest = data.doseLogs.filter((l) => !(l.medicationId === medicationId && l.date === date && l.time === time));
  return {
    ...data,
    doseLogs: status
      ? [...rest, { medicationId, date, time, status, at: new Date().toISOString(), snoozedUntil }]
      : rest,
  };
}

export function saveHabit(data: AppData, habit: Habit): AppData {
  return { ...data, habits: upsert(data.habits, habit) };
}

export function deleteHabit(data: AppData, id: string): AppData {
  const { [id]: _removed, ...habitLogs } = data.habitLogs;
  return { ...data, habits: data.habits.filter((h) => h.id !== id), habitLogs };
}

export function setHabitCount(data: AppData, id: string, date: DateKey, count: number): AppData {
  const days = { ...(data.habitLogs[id] ?? {}) };
  if (count <= 0) delete days[date];
  else days[date] = Math.floor(count);
  return { ...data, habitLogs: { ...data.habitLogs, [id]: days } };
}

export function toggleCycleDay(data: AppData, date: DateKey): AppData {
  const has = data.cycleDays.includes(date);
  return { ...data, cycleDays: has ? data.cycleDays.filter((d) => d !== date) : [...data.cycleDays, date].sort() };
}
