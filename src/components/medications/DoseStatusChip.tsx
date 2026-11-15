import type { DoseItem } from '../../domain/agenda';
import { formatClock } from '../../lib/date';
import { Chip } from '../ui/misc';

const STYLE: Record<DoseItem['status'], string> = {
  upcoming: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  due: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  snoozed: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  taken: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  skipped: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  missed: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
};

export function doseStatusLabel(item: DoseItem, format: '24h' | '12h'): string {
  switch (item.status) {
    case 'upcoming': return 'Запланировано';
    case 'due': return 'Пора принять';
    case 'snoozed': return item.log?.snoozedUntil ? `Отложено до ${formatClock(new Date(item.log.snoozedUntil), format)}` : 'Отложено';
    case 'taken': return item.log?.at ? `Принято в ${formatClock(new Date(item.log.at), format)}` : 'Принято';
    case 'skipped': return 'Пропущено';
    case 'missed': return 'Нет отметки';
  }
}

export function DoseStatusChip({ item, format }: { item: DoseItem; format: '24h' | '12h' }) {
  return <Chip className={STYLE[item.status]}>{doseStatusLabel(item, format)}</Chip>;
}
