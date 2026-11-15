import { useState, type FormEvent } from 'react';
import type { Category, DateKey, PlannerEvent, Recurrence } from '../../models/types';
import { useStore } from '../../store/AppStore';
import { excludeEventDate, saveEvent } from '../../store/mutations';
import { NO_REPEAT } from '../../domain/schedule';
import { CATEGORY_META, EVENT_CATEGORIES } from '../../lib/categories';
import { isValidDateKey, isValidTime } from '../../lib/date';
import { newId } from '../../lib/id';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Segmented, Select, Textarea, TextInput, Toggle } from '../ui/fields';
import { RecurrenceFields } from './RecurrenceFields';
import { useToast } from '../ui/Toast';

interface Props {
  /** Редактируемое событие; без него форма создаёт новое. */
  event?: PlannerEvent;
  /** Дата экземпляра, с которого открыли форму (важно для повторяющихся). */
  occurrenceDate?: DateKey;
  defaultDate: DateKey;
  onClose: () => void;
}

const OFFSETS = [0, 5, 10, 15, 30, 60, 120];

export function EventForm({ event, occurrenceDate, defaultDate, onClose }: Props) {
  const { data, update } = useStore();
  const toast = useToast();
  const isSeries = !!event && event.recurrence.freq !== 'none';
  const [scope, setScope] = useState<'one' | 'all'>(isSeries ? 'one' : 'all');

  const [title, setTitle] = useState(event?.title ?? '');
  const [category, setCategory] = useState<Category>(event?.category ?? 'personal');
  const [oneDate, setOneDate] = useState<DateKey>(occurrenceDate ?? event?.date ?? defaultDate);
  const [seriesDate, setSeriesDate] = useState<DateKey>(event?.date ?? defaultDate);
  const [time, setTime] = useState(event?.time ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence>(event?.recurrence ?? NO_REPEAT);
  const [remind, setRemind] = useState(event?.reminder.enabled ?? true);
  const [offsetMin, setOffsetMin] = useState(event?.reminder.offsetMin ?? 0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const editingOne = isSeries && scope === 'one';
  const date = editingOne ? oneDate : seriesDate;
  const setDate = editingOne ? setOneDate : setSeriesDate;

  function submit(e: FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!title.trim()) found.title = 'Введите название.';
    if (!isValidDateKey(date)) found.date = 'Укажите дату.';
    if (time && !isValidTime(time)) found.time = 'Некорректное время.';
    const rule = editingOne ? NO_REPEAT : recurrence;
    if (rule.freq === 'weekly' && !rule.byWeekday?.length) found.recurrence = 'Выберите хотя бы один день недели.';
    if (rule.until && rule.until < date) found.recurrence = 'Дата окончания раньше начала.';
    setErrors(found);
    if (Object.keys(found).length) return;

    const now = new Date().toISOString();
    const fields = {
      title: title.trim(),
      category,
      date,
      time: time || undefined,
      notes: notes.trim() || undefined,
      reminder: { enabled: remind && !!time, offsetMin },
      updatedAt: now,
    };

    if (event && editingOne && occurrenceDate) {
      // Меняем один экземпляр: исключаем дату из серии и создаём отдельное событие.
      const single: PlannerEvent = { ...fields, id: newId(), recurrence: NO_REPEAT, exdates: [], createdAt: now };
      update((d) => saveEvent(excludeEventDate(d, event.id, occurrenceDate), single));
    } else if (event) {
      // Исключённые даты серии сохраняются; у одиночного события они не нужны.
      update((d) => saveEvent(d, { ...event, ...fields, recurrence: rule, exdates: rule.freq === 'none' ? [] : event.exdates }));
    } else {
      update((d) => saveEvent(d, { ...fields, id: newId(), recurrence: rule, exdates: [], createdAt: now }));
    }
    toast(event ? 'Изменения сохранены' : 'Событие добавлено');
    onClose();
  }

  return (
    <Modal
      title={event ? 'Изменить событие' : 'Новое событие'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="primary" type="submit" form="event-form">{event ? 'Сохранить' : 'Добавить'}</Button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} className="space-y-4" noValidate>
        {isSeries && (
          <Segmented
            label="Что изменить"
            value={scope}
            onChange={setScope}
            options={[{ value: 'one', label: 'Только это событие' }, { value: 'all', label: 'Всю серию' }]}
          />
        )}
        <Field label="Название" error={errors.title}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, занятия в университете" maxLength={200} />
        </Field>
        <Field label="Категория">
          <Select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={isSeries && scope === 'all' ? 'Начало серии' : 'Дата'} error={errors.date}>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Время" error={errors.time} hint={time ? undefined : 'Без времени — на весь день'}>
            <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        {!editingOne && (
          <RecurrenceFields value={recurrence} onChange={setRecurrence} startDate={date} weekStartsOn={data.settings.weekStartsOn} error={errors.recurrence} />
        )}
        {errors.recurrence && recurrence.freq !== 'weekly' && <p role="alert" className="text-xs text-rose-600">{errors.recurrence}</p>}
        <div className="space-y-3 rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
          <Toggle
            checked={remind && !!time}
            onChange={setRemind}
            label="Напоминание"
            description={time ? 'Пришлём уведомление и повторим, если вы не ответите.' : 'Чтобы включить, укажите время события.'}
          />
          {remind && !!time && (
            <Field label="Когда напомнить">
              <Select value={offsetMin} onChange={(e) => setOffsetMin(Number(e.target.value))}>
                {OFFSETS.map((m) => (
                  <option key={m} value={m}>{m === 0 ? 'В момент события' : m < 60 ? `За ${m} мин` : `За ${m / 60} ч`}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <Field label="Заметки">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Необязательно" />
        </Field>
      </form>
    </Modal>
  );
}
