import { useState } from 'react';
import type { DateKey, PlannerEvent } from '../../models/types';
import { useStore } from '../../store/AppStore';
import { excludeEventDate, saveEvent } from '../../store/mutations';
import { NO_REPEAT } from '../../domain/schedule';
import { formatShortDate, isValidDateKey } from '../../lib/date';
import { newId } from '../../lib/id';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/fields';
import { useToast } from '../ui/Toast';

/** Быстрый перенос события на другую дату и время. У серии переносится только выбранный экземпляр. */
export function MoveEventDialog({ event, occurrenceDate, onClose }: { event: PlannerEvent; occurrenceDate: DateKey; onClose: () => void }) {
  const { update } = useStore();
  const toast = useToast();
  const [date, setDate] = useState(occurrenceDate);
  const [time, setTime] = useState(event.time ?? '');
  const isSeries = event.recurrence.freq !== 'none';
  const valid = isValidDateKey(date);

  function move() {
    if (!valid) return;
    const now = new Date().toISOString();
    const moved = { date, time: time || undefined, updatedAt: now, reminder: { ...event.reminder, enabled: event.reminder.enabled && !!time } };
    if (isSeries) {
      update((d) => saveEvent(excludeEventDate(d, event.id, occurrenceDate), { ...event, ...moved, id: newId(), recurrence: NO_REPEAT, exdates: [], createdAt: now }));
    } else {
      update((d) => saveEvent(d, { ...event, ...moved }));
    }
    toast(`Перенесено на ${formatShortDate(date)}`);
    onClose();
  }

  return (
    <Modal
      title="Перенести событие"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={move} disabled={!valid}>Перенести</Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        «{event.title}»{isSeries && ' — переносится только это событие, остальные в серии останутся на месте.'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Новая дата"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Время"><TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
