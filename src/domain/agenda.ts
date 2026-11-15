import type {
  AppData, DateKey, DoseLog, DoseStatus, EventStatus, Medication, PlannerEvent, TimeOfDay,
} from '../models/types';
import { at, todayKey } from '../lib/date';
import { occursOn } from './schedule';

export interface EventItem {
  kind: 'event';
  key: string;
  date: DateKey;
  time?: TimeOfDay;
  event: PlannerEvent;
  status: EventStatus | 'pending';
}

export interface DoseItem {
  kind: 'dose';
  key: string;
  date: DateKey;
  time: TimeOfDay;
  medication: Medication;
  status: DoseStatus;
  log?: DoseLog;
}

export type AgendaItem = EventItem | DoseItem;

export const eventKey = (id: string, date: DateKey) => `event:${id}:${date}`;
export const doseKey = (id: string, date: DateKey, time: TimeOfDay) => `dose:${id}:${date}:${time}`;

export function medicationOccursOn(med: Medication, date: DateKey): boolean {
  if (!med.active) return false;
  if (med.endDate && date > med.endDate) return false;
  return occursOn(med.recurrence, med.startDate, date);
}

/**
 * Статус приёма. «Принято» и «Пропущено» появляются только после действия пользователя;
 * наступление времени даёт лишь «пора принять», а прошедший день без отметки — «нет отметки».
 */
export function doseStatus(log: DoseLog | undefined, date: DateKey, time: TimeOfDay, now: Date): DoseStatus {
  if (log?.status === 'taken') return 'taken';
  if (log?.status === 'skipped') return 'skipped';
  if (date < todayKey(now)) return 'missed';
  if (log?.status === 'snoozed' && log.snoozedUntil && new Date(log.snoozedUntil) > now) return 'snoozed';
  return at(date, time) <= now ? 'due' : 'upcoming';
}

export function findDoseLog(logs: readonly DoseLog[], medId: string, date: DateKey, time: TimeOfDay) {
  return logs.find((l) => l.medicationId === medId && l.date === date && l.time === time);
}

export function eventsOn(data: AppData, date: DateKey): EventItem[] {
  return data.events
    .filter((e) => occursOn(e.recurrence, e.date, date, e.exdates))
    .map((event) => {
      const log = data.eventLogs.find((l) => l.eventId === event.id && l.date === date);
      return { kind: 'event' as const, key: eventKey(event.id, date), date, time: event.time, event, status: log?.status ?? 'pending' };
    });
}

export function dosesOn(data: AppData, date: DateKey, now: Date): DoseItem[] {
  const out: DoseItem[] = [];
  for (const medication of data.medications) {
    if (!medicationOccursOn(medication, date)) continue;
    for (const time of medication.times) {
      const log = findDoseLog(data.doseLogs, medication.id, date, time);
      out.push({ kind: 'dose', key: doseKey(medication.id, date, time), date, time, medication, log, status: doseStatus(log, date, time, now) });
    }
  }
  return out;
}

/** Все дела дня в хронологическом порядке; события без времени идут первыми. */
export function agendaFor(data: AppData, date: DateKey, now: Date = new Date()): AgendaItem[] {
  const items: AgendaItem[] = [...eventsOn(data, date), ...dosesOn(data, date, now)];
  return items.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.key.localeCompare(b.key));
}

export function isResolved(item: AgendaItem): boolean {
  return item.kind === 'event' ? item.status !== 'pending' : item.status === 'taken' || item.status === 'skipped';
}

/** Отменённое занятие или событие: остаётся в списке, но не считается запланированным. */
export function isCancelled(item: AgendaItem): boolean {
  return item.kind === 'event' && item.status === 'cancelled';
}

export function isCompleted(item: AgendaItem): boolean {
  return item.kind === 'event' ? item.status === 'done' : item.status === 'taken';
}

export function itemTitle(item: AgendaItem): string {
  return item.kind === 'event' ? item.event.title : item.medication.name;
}
