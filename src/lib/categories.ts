import type { Category, HabitColor, MedicationForm } from '../models/types';

interface CategoryMeta {
  label: string;
  dot: string;
  chip: string;
  bar: string;
}

/** Классы записаны целиком, чтобы Tailwind включил их в сборку. */
export const CATEGORY_META: Record<Category, CategoryMeta> = {
  medication: { label: 'Лекарства', dot: 'bg-rose-400', bar: 'bg-rose-400', chip: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
  study: { label: 'Учёба', dot: 'bg-sky-400', bar: 'bg-sky-400', chip: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  work: { label: 'Работа', dot: 'bg-amber-400', bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  personal: { label: 'Личное', dot: 'bg-violet-400', bar: 'bg-violet-400', chip: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  health: { label: 'Здоровье', dot: 'bg-emerald-400', bar: 'bg-emerald-400', chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  other: { label: 'Другое', dot: 'bg-slate-400', bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300' },
};

/** Категории, доступные при создании события (лекарства ведутся на своей странице). */
export const EVENT_CATEGORIES: Category[] = ['study', 'work', 'personal', 'health', 'other'];

export const MED_FORM_LABEL: Record<MedicationForm, string> = {
  tablet: 'Таблетки',
  capsule: 'Капсулы',
  liquid: 'Сироп / раствор',
  drops: 'Капли',
  injection: 'Инъекция',
  spray: 'Спрей',
  ointment: 'Мазь / крем',
  other: 'Другое',
};

export const HABIT_COLORS: Record<HabitColor, { fill: string; soft: string; text: string }> = {
  violet: { fill: 'bg-violet-500', soft: 'bg-violet-100 dark:bg-violet-500/20', text: 'text-violet-600 dark:text-violet-300' },
  sky: { fill: 'bg-sky-500', soft: 'bg-sky-100 dark:bg-sky-500/20', text: 'text-sky-600 dark:text-sky-300' },
  emerald: { fill: 'bg-emerald-500', soft: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-300' },
  amber: { fill: 'bg-amber-500', soft: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-300' },
  rose: { fill: 'bg-rose-500', soft: 'bg-rose-100 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-300' },
};
