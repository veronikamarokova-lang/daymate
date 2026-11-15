/** Дата без времени в локальном календаре пользователя: "YYYY-MM-DD". */
export type DateKey = string;
/** Время на часах ("wall clock"): "HH:MM", всегда 24-часовой формат при хранении. */
export type TimeOfDay = string;

export type Category = 'medication' | 'study' | 'work' | 'personal' | 'health' | 'other';

export type RecurrenceFreq = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Recurrence {
  freq: RecurrenceFreq;
  /** Каждые N дней / недель / месяцев. */
  interval: number;
  /** Для weekly: дни недели 0 (вс) … 6 (сб). */
  byWeekday?: number[];
  /** Последний день серии включительно. */
  until?: DateKey;
}

export interface ReminderConfig {
  enabled: boolean;
  /** За сколько минут до события напомнить. */
  offsetMin: number;
}

export interface PlannerEvent {
  id: string;
  title: string;
  category: Category;
  /** Дата события или первый день серии. */
  date: DateKey;
  /** Пусто — событие «на весь день». */
  time?: TimeOfDay;
  notes?: string;
  /** 'class' — занятие из расписания вуза. */
  kind?: 'class';
  /** Время окончания (для занятий). */
  endTime?: TimeOfDay;
  /** Где проходит: аудитория, корпус. */
  location?: string;
  teacher?: string;
  /** Лекция, практика и т. п. */
  classType?: string;
  recurrence: Recurrence;
  /** Даты, исключённые из серии (удалённые или перенесённые экземпляры). */
  exdates: DateKey[];
  reminder: ReminderConfig;
  createdAt: string;
  updatedAt: string;
}

/** cancelled — занятие или событие отменено: не напоминаем и не считаем в статистике. */
export type EventStatus = 'done' | 'skipped' | 'cancelled';

export interface EventLog {
  eventId: string;
  date: DateKey;
  status: EventStatus;
  at: string;
}

export type MedicationForm =
  | 'tablet' | 'capsule' | 'liquid' | 'drops' | 'injection' | 'spray' | 'ointment' | 'other';

export interface Medication {
  id: string;
  name: string;
  /** Назначенная дозировка — свободный текст, вводится пользователем как в назначении. */
  dosage: string;
  form: MedicationForm;
  /** Время приёмов; количество приёмов в день = times.length. */
  times: TimeOfDay[];
  startDate: DateKey;
  endDate?: DateKey;
  recurrence: Recurrence;
  notes?: string;
  remindersEnabled: boolean;
  /** Приостановленный препарат не попадает в расписание, история сохраняется. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Статус, подтверждённый пользователем. «Принято» никогда не ставится автоматически. */
export type DoseAction = 'taken' | 'skipped' | 'snoozed';

export interface DoseLog {
  medicationId: string;
  date: DateKey;
  time: TimeOfDay;
  status: DoseAction;
  /** Когда пользователь выполнил действие (ISO, UTC). */
  at: string;
  /** Для snoozed: момент повторного напоминания (ISO, UTC). */
  snoozedUntil?: string;
}

/** Вычисляемый статус приёма для отображения. */
export type DoseStatus = 'upcoming' | 'due' | 'snoozed' | 'taken' | 'skipped' | 'missed';

export type HabitFrequency =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] };

export interface Habit {
  id: string;
  name: string;
  color: HabitColor;
  frequency: HabitFrequency;
  /** Сколько раз в день нужно отметить (например, 8 стаканов воды). */
  targetPerDay: number;
  createdAt: DateKey;
  archived: boolean;
}

export type HabitColor = 'violet' | 'sky' | 'emerald' | 'amber' | 'rose';

/** habitId -> дата -> сколько раз отмечено. */
export type HabitLogs = Record<string, Record<DateKey, number>>;

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  userName: string;
  theme: ThemeMode;
  notificationsEnabled: boolean;
  /** На сколько минут откладывается напоминание. */
  snoozeMinutes: number;
  /** Через сколько минут повторять неподтверждённое напоминание. */
  repeatMinutes: number;
  /** Сколько раз повторять. 0 — не повторять. */
  maxRepeats: number;
  /** Повторные напоминания приходят громче (в Android-приложении). */
  loudRepeat: boolean;
  timeFormat: '24h' | '12h';
  weekStartsOn: 0 | 1;
  /** Часовой пояс устройства при последнем запуске — чтобы заметить его смену. */
  lastTimeZone: string;
}

export interface AppData {
  schemaVersion: number;
  settings: Settings;
  events: PlannerEvent[];
  eventLogs: EventLog[];
  medications: Medication[];
  doseLogs: DoseLog[];
  habits: Habit[];
  habitLogs: HabitLogs;
  /** Отмеченные дни цикла. Хранятся на устройстве; партнёру видны только при включённом общем доступе. */
  cycleDays: DateKey[];
}
