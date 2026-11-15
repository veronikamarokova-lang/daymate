import { useState } from 'react';
import { Ban, CalendarClock, Check, MapPin, Pencil, Pill, Repeat, RotateCcw, Trash2, User } from 'lucide-react';
import type { AgendaItem, DoseItem, EventItem } from '../../domain/agenda';
import type { Medication } from '../../models/types';
import { useStore } from '../../store/AppStore';
import { deleteEvent, excludeEventDate, logDose, setEventStatus } from '../../store/mutations';
import { useReminders } from '../../reminders/ReminderProvider';
import { CATEGORY_META, MED_FORM_LABEL } from '../../lib/categories';
import { formatShortDate, formatTime } from '../../lib/date';
import { Button, IconButton } from '../ui/Button';
import { Card, Chip } from '../ui/misc';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { EventForm } from './EventForm';
import { ClassForm } from './ClassForm';
import { MoveEventDialog } from './MoveEventDialog';
import { MedicationForm } from '../medications/MedicationForm';
import { DoseStatusChip } from '../medications/DoseStatusChip';

type Dialog =
  | { type: 'edit' | 'move' | 'delete'; item: EventItem }
  | { type: 'med'; medication: Medication }
  | null;

/** Список дел дня: события и приёмы лекарств со всеми действиями. */
export function AgendaList({ items }: { items: AgendaItem[] }) {
  const { data, update } = useStore();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);

  return (
    <>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.key}>
            {item.kind === 'event' ? (
              <EventRow item={item} onDialog={(type) => setDialog({ type, item })} />
            ) : (
              <DoseRow item={item} onEdit={() => setDialog({ type: 'med', medication: item.medication })} />
            )}
          </li>
        ))}
      </ul>

      {dialog?.type === 'edit' && (dialog.item.event.kind === 'class'
        ? <ClassForm event={dialog.item.event} defaultDate={dialog.item.date} onClose={close} />
        : <EventForm event={dialog.item.event} occurrenceDate={dialog.item.date} defaultDate={dialog.item.date} onClose={close} />)}
      {dialog?.type === 'move' && <MoveEventDialog event={dialog.item.event} occurrenceDate={dialog.item.date} onClose={close} />}
      {dialog?.type === 'med' && <MedicationForm medication={dialog.medication} onClose={close} />}
      {dialog?.type === 'delete' && (() => {
        const { event, date } = dialog.item;
        const isSeries = event.recurrence.freq !== 'none';
        const snapshot = data;
        const undo = () => update(() => snapshot);
        return (
          <ConfirmDialog
            title="Удалить событие?"
            message={isSeries
              ? <>«{event.title}» повторяется. Удалить только событие {formatShortDate(date)} или всю серию вместе с историей?</>
              : <>«{event.title}» будет удалено вместе с отметкой о выполнении.</>}
            confirmLabel={isSeries ? 'Только это' : 'Удалить'}
            onCancel={close}
            onConfirm={() => {
              update((d) => (isSeries ? excludeEventDate(d, event.id, date) : deleteEvent(d, event.id)));
              toast('Событие удалено', { undo });
              close();
            }}
            extra={isSeries ? { label: 'Всю серию', onClick: () => { update((d) => deleteEvent(d, event.id)); toast('Серия удалена', { undo }); close(); } } : undefined}
          />
        );
      })()}
    </>
  );
}

export function EventRow({ item, onDialog }: { item: EventItem; onDialog: (type: 'edit' | 'move' | 'delete') => void }) {
  const { data, update } = useStore();
  const toast = useToast();
  const ev = item.event;
  const meta = CATEGORY_META[ev.category];
  const fmt = data.settings.timeFormat;
  const isClass = ev.kind === 'class';
  const done = item.status === 'done';
  const cancelled = item.status === 'cancelled';
  const setStatus = (status: 'done' | 'cancelled' | null) => update((d) => setEventStatus(d, ev.id, item.date, status));
  const timeLabel = item.time ? formatTime(item.time, fmt) + (ev.endTime ? `–${formatTime(ev.endTime, fmt)}` : '') : 'Весь день';

  return (
    <Card className={`flex items-stretch gap-3 p-3.5 transition-shadow hover:shadow-md ${cancelled ? 'opacity-70' : ''}`}>
      <span className={`w-1 shrink-0 rounded-full ${cancelled ? 'bg-slate-300 dark:bg-slate-600' : meta.bar}`} aria-hidden />
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        disabled={cancelled}
        aria-label={done ? 'Снять отметку о выполнении' : 'Отметить выполненным'}
        onClick={() => setStatus(done ? null : 'done')}
        className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors disabled:opacity-40 ${
          done ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 text-transparent hover:border-violet-400 dark:border-slate-600'
        }`}
      >
        <Check size={15} strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <div className={`font-medium break-words ${done || cancelled ? 'text-slate-400 line-through dark:text-slate-500' : ''}`}>{ev.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-200">{timeLabel}</span>
          {cancelled
            ? <Chip className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">Отменено</Chip>
            : <Chip className={meta.chip}>{ev.classType || meta.label}</Chip>}
          {ev.recurrence.freq !== 'none' && <Repeat size={13} aria-label="Повторяется" />}
        </div>
        {(ev.location || ev.teacher) && (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            {ev.location && <span className="inline-flex items-center gap-1 font-medium"><MapPin size={13} />{ev.location}</span>}
            {ev.teacher && <span className="inline-flex items-center gap-1"><User size={13} />{ev.teacher}</span>}
          </div>
        )}
        {ev.notes && <p className="mt-1.5 text-xs whitespace-pre-line text-slate-500 dark:text-slate-400">{ev.notes}</p>}
      </div>
      <div className="-mr-1.5 flex shrink-0 self-start">
        {isClass && (cancelled ? (
          <IconButton label="Вернуть занятие" onClick={() => { setStatus(null); toast('Занятие возвращено'); }}><RotateCcw size={16} /></IconButton>
        ) : (
          <IconButton
            label="Отменить это занятие"
            className="hover:text-rose-600 dark:hover:text-rose-400"
            onClick={() => { setStatus('cancelled'); toast('Занятие отменено, напоминания не будет', { undo: () => setStatus(null), undoLabel: 'Вернуть' }); }}
          >
            <Ban size={16} />
          </IconButton>
        ))}
        <IconButton label="Перенести" onClick={() => onDialog('move')}><CalendarClock size={17} /></IconButton>
        <IconButton label="Изменить" onClick={() => onDialog('edit')}><Pencil size={16} /></IconButton>
        <IconButton label="Удалить" className="hover:text-rose-600 dark:hover:text-rose-400" onClick={() => onDialog('delete')}><Trash2 size={16} /></IconButton>
      </div>
    </Card>
  );
}

export function DoseRow({ item, onEdit, showDate = false }: { item: DoseItem; onEdit?: () => void; showDate?: boolean }) {
  const { data, update } = useStore();
  const { takeDose, skipDose, snoozeDose } = useReminders();
  const ref = { refId: item.medication.id, date: item.date, time: item.time };
  const resolved = item.status === 'taken' || item.status === 'skipped';
  const canSnooze = item.status === 'due' || item.status === 'snoozed';
  const highlight = item.status === 'due';

  return (
    <Card className={`p-3.5 transition-shadow hover:shadow-md ${highlight ? 'ring-2 ring-violet-300 dark:ring-violet-500/50' : ''}`}>
      <div className="flex items-stretch gap-3">
        <span className={`w-1 shrink-0 rounded-full ${CATEGORY_META.medication.bar}`} aria-hidden />
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300">
          <Pill size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`font-medium break-words ${resolved ? 'text-slate-400 dark:text-slate-500' : ''}`}>
            {item.medication.name}
            {item.medication.dosage && <span className="font-normal text-slate-500 dark:text-slate-400"> · {item.medication.dosage}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {showDate && `${formatShortDate(item.date)}, `}{formatTime(item.time, data.settings.timeFormat)}
            </span>
            <span>{MED_FORM_LABEL[item.medication.form]}</span>
            <DoseStatusChip item={item} format={data.settings.timeFormat} />
          </div>
          {item.medication.notes && <p className="mt-1.5 text-xs whitespace-pre-line text-slate-500 dark:text-slate-400">{item.medication.notes}</p>}
        </div>
        {onEdit && <IconButton label="Изменить расписание" onClick={onEdit}><Pencil size={16} /></IconButton>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 pl-4">
        {resolved ? (
          <Button size="sm" variant="ghost" onClick={() => update((d) => logDose(d, ref.refId, ref.date, ref.time, null))}>
            <RotateCcw size={15} />Отменить отметку
          </Button>
        ) : (
          <>
            <Button size="sm" variant="primary" onClick={() => takeDose(ref)}><Check size={15} strokeWidth={3} />Принял</Button>
            {canSnooze && <Button size="sm" onClick={() => snoozeDose(ref)}>Отложить на {data.settings.snoozeMinutes} мин</Button>}
            <Button size="sm" variant="ghost" onClick={() => skipDose(ref)}>Пропустить</Button>
          </>
        )}
      </div>
    </Card>
  );
}
