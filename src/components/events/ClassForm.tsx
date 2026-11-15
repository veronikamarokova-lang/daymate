import { useState, type FormEvent } from 'react';
import type { DateKey, PlannerEvent, Recurrence } from '../../models/types';
import { useStore } from '../../store/AppStore';
import { saveEvent } from '../../store/mutations';
import { fromDateKey, isValidDateKey, isValidTime } from '../../lib/date';
import { newId } from '../../lib/id';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Select, Textarea, TextInput, Toggle } from '../ui/fields';
import { useToast } from '../ui/Toast';

const TYPES = ['Лекция', 'Практика', 'Семинар', 'Лабораторная', 'Консультация', 'Зачёт', 'Экзамен'];
const OFFSETS = [5, 10, 15, 20, 30, 45, 60];
const WEEKDAY_ACC = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];

type Repeat = 'weekly' | 'biweekly' | 'none';

function repeatOf(r: Recurrence | undefined): Repeat {
  if (!r || r.freq === 'none') return r ? 'none' : 'weekly';
  return r.interval >= 2 ? 'biweekly' : 'weekly';
}

/** Занятие из расписания вуза: это событие категории «Учёба» с аудиторией, преподавателем и повтором по неделям. */
export function ClassForm({ event, defaultDate, onClose }: { event?: PlannerEvent; defaultDate: DateKey; onClose: () => void }) {
  const { update } = useStore();
  const toast = useToast();
  const [title, setTitle] = useState(event?.title ?? '');
  const [classType, setClassType] = useState(event?.classType ?? 'Лекция');
  const [date, setDate] = useState<DateKey>(event?.date ?? defaultDate);
  const [time, setTime] = useState(event?.time ?? '09:00');
  const [endTime, setEndTime] = useState(event?.endTime ?? '10:30');
  const [repeat, setRepeat] = useState<Repeat>(repeatOf(event?.recurrence));
  const [until, setUntil] = useState(event?.recurrence.until ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [teacher, setTeacher] = useState(event?.teacher ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [remind, setRemind] = useState(event?.reminder.enabled ?? true);
  const [offsetMin, setOffsetMin] = useState(event?.reminder.offsetMin || 10);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const weekday = isValidDateKey(date) ? WEEKDAY_ACC[fromDateKey(date).getDay()] : '';
  const prefix = fromDateKey(date).getDay() === 2 ? 'во' : 'в';

  function submit(e: FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!title.trim()) found.title = 'Введите название предмета.';
    if (!isValidDateKey(date)) found.date = 'Укажите дату первого занятия.';
    if (!isValidTime(time)) found.time = 'Укажите время начала.';
    if (endTime && (!isValidTime(endTime) || endTime <= time)) found.endTime = 'Конец должен быть позже начала.';
    if (until && until < date) found.until = 'Раньше первого занятия.';
    setErrors(found);
    if (Object.keys(found).length) return;

    const now = new Date().toISOString();
    const recurrence: Recurrence = repeat === 'none'
      ? { freq: 'none', interval: 1 }
      : { freq: 'weekly', interval: repeat === 'biweekly' ? 2 : 1, byWeekday: [fromDateKey(date).getDay()], until: until || undefined };
    const next: PlannerEvent = {
      id: event?.id ?? newId(),
      kind: 'class',
      category: 'study',
      title: title.trim(),
      classType: classType || undefined,
      date,
      time,
      endTime: endTime || undefined,
      location: location.trim() || undefined,
      teacher: teacher.trim() || undefined,
      notes: notes.trim() || undefined,
      recurrence,
      exdates: recurrence.freq === 'none' ? [] : event?.exdates ?? [],
      reminder: { enabled: remind, offsetMin },
      createdAt: event?.createdAt ?? now,
      updatedAt: now,
    };
    update((d) => saveEvent(d, next));
    toast(event ? 'Занятие обновлено' : 'Занятие добавлено в расписание');
    onClose();
  }

  return (
    <Modal
      title={event ? 'Изменить занятие' : 'Новое занятие'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="primary" type="submit" form="class-form">{event ? 'Сохранить' : 'Добавить'}</Button>
        </>
      }
    >
      <form id="class-form" onSubmit={submit} className="space-y-4" noValidate>
        {event && event.recurrence.freq !== 'none' && (
          <p className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            Изменения применятся ко всем занятиям этой серии. Чтобы изменить одну пару, отмените или перенесите её в списке дня.
          </p>
        )}
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Предмет" error={errors.title}>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Например, математический анализ" />
          </Field>
          <Field label="Тип">
            <Select value={classType} onChange={(e) => setClassType(e.target.value)}>
              {!TYPES.includes(classType) && classType && <option value={classType}>{classType}</option>}
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="">Без типа</option>
            </Select>
          </Field>
        </div>
        <Field label="Где проходит" hint="Аудитория и корпус — это придёт в напоминании.">
          <TextInput value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} placeholder="Например, ауд. 305, корпус Б" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Начало" error={errors.time}><TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          <Field label="Конец" error={errors.endTime}><TextInput type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Первое занятие" error={errors.date} hint={weekday && repeat !== 'none' ? `Будет повторяться ${prefix} ${weekday}` : undefined}>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Повтор">
            <Select value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
              <option value="weekly">Каждую неделю</option>
              <option value="biweekly">Через неделю</option>
              <option value="none">Один раз</option>
            </Select>
          </Field>
        </div>
        {repeat === 'biweekly' && (
          <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">
            Для чётных и нечётных недель создайте два занятия: у каждого своя дата первого занятия.
          </p>
        )}
        {repeat !== 'none' && (
          <Field label="Последнее занятие (конец семестра)" error={errors.until} hint={until ? undefined : 'Не указано — будет повторяться, пока не удалите.'}>
            <TextInput type="date" min={date} value={until} onChange={(e) => setUntil(e.target.value)} />
          </Field>
        )}
        <Field label="Преподаватель">
          <TextInput value={teacher} onChange={(e) => setTeacher(e.target.value)} maxLength={200} placeholder="Необязательно" />
        </Field>
        <div className="space-y-3 rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
          <Toggle checked={remind} onChange={setRemind} label="Напомнить перед занятием" description="В уведомлении будет аудитория и время начала. Повторов и громкого сигнала нет." />
          {remind && (
            <Field label="За сколько">
              <Select value={offsetMin} onChange={(e) => setOffsetMin(Number(e.target.value))}>
                {OFFSETS.map((m) => <option key={m} value={m}>За {m} мин</option>)}
              </Select>
            </Field>
          )}
        </div>
        <Field label="Заметки">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Например, взять халат" />
        </Field>
      </form>
    </Modal>
  );
}
