import { useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import type { Medication, MedicationForm as MedForm, Recurrence } from '../../models/types';
import { useStore } from '../../store/AppStore';
import { saveMedication } from '../../store/mutations';
import { MED_FORM_LABEL } from '../../lib/categories';
import { isValidDateKey, isValidTime, todayKey } from '../../lib/date';
import { newId } from '../../lib/id';
import { Modal } from '../ui/Modal';
import { Button, IconButton } from '../ui/Button';
import { Field, Select, Textarea, TextInput, Toggle } from '../ui/fields';
import { RecurrenceFields } from '../events/RecurrenceFields';
import { useToast } from '../ui/Toast';

export function MedicationForm({ medication, onClose }: { medication?: Medication; onClose: () => void }) {
  const { data, update } = useStore();
  const toast = useToast();
  const [name, setName] = useState(medication?.name ?? '');
  const [dosage, setDosage] = useState(medication?.dosage ?? '');
  const [form, setForm] = useState<MedForm>(medication?.form ?? 'tablet');
  const [times, setTimes] = useState<string[]>(medication?.times ?? ['09:00']);
  const [startDate, setStartDate] = useState(medication?.startDate ?? todayKey());
  const [endDate, setEndDate] = useState(medication?.endDate ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence>(medication?.recurrence ?? { freq: 'daily', interval: 1 });
  const [notes, setNotes] = useState(medication?.notes ?? '');
  const [reminders, setReminders] = useState(medication?.remindersEnabled ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = 'Введите название препарата.';
    if (!isValidDateKey(startDate)) found.startDate = 'Укажите дату начала.';
    if (endDate && endDate < startDate) found.endDate = 'Окончание раньше начала.';
    const cleanTimes = [...new Set(times.filter(isValidTime))].sort();
    if (cleanTimes.length === 0) found.times = 'Добавьте хотя бы одно время приёма.';
    else if (cleanTimes.length !== times.length) found.times = 'Времена приёма должны быть заполнены и не повторяться.';
    if (recurrence.freq === 'weekly' && !recurrence.byWeekday?.length) found.recurrence = 'Выберите хотя бы один день недели.';
    setErrors(found);
    if (Object.keys(found).length) return;

    const now = new Date().toISOString();
    const next: Medication = {
      id: medication?.id ?? newId(),
      name: name.trim(),
      dosage: dosage.trim(),
      form,
      times: cleanTimes,
      startDate,
      endDate: endDate || undefined,
      recurrence: { ...recurrence, until: undefined },
      notes: notes.trim() || undefined,
      remindersEnabled: reminders,
      active: medication?.active ?? true,
      createdAt: medication?.createdAt ?? now,
      updatedAt: now,
    };
    update((d) => saveMedication(d, next));
    toast(medication ? 'Расписание обновлено' : 'Лекарство добавлено');
    onClose();
  }

  return (
    <Modal
      title={medication ? 'Изменить лекарство' : 'Новое лекарство'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="primary" type="submit" form="med-form">{medication ? 'Сохранить' : 'Добавить'}</Button>
        </>
      }
    >
      <form id="med-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Название" error={errors.name}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder="Как на упаковке или в назначении" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Назначенная дозировка" hint="Впишите так, как назначил врач.">
            <TextInput value={dosage} onChange={(e) => setDosage(e.target.value)} maxLength={200} />
          </Field>
          <Field label="Форма">
            <Select value={form} onChange={(e) => setForm(e.target.value as MedForm)}>
              {(Object.keys(MED_FORM_LABEL) as MedForm[]).map((f) => <option key={f} value={f}>{MED_FORM_LABEL[f]}</option>)}
            </Select>
          </Field>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Время приёма</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Приёмов в день: {times.length}</span>
          </div>
          <div className="space-y-2">
            {times.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <TextInput type="time" aria-label={`Приём ${i + 1}`} value={t} onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))} />
                {times.length > 1 && (
                  <IconButton label="Убрать это время" onClick={() => setTimes(times.filter((_, j) => j !== i))}><X size={16} /></IconButton>
                )}
              </div>
            ))}
          </div>
          {errors.times && <p role="alert" className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{errors.times}</p>}
          {times.length < 12 && (
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setTimes([...times, ''])}><Plus size={16} />Добавить время</Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата начала" error={errors.startDate}>
            <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Дата окончания" error={errors.endDate} hint={endDate ? undefined : 'Не указана'}>
            <TextInput type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>

        <RecurrenceFields value={recurrence} onChange={setRecurrence} startDate={startDate} weekStartsOn={data.settings.weekStartsOn} allowNone={false} showUntil={false} error={errors.recurrence} />

        <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
          <Toggle checked={reminders} onChange={setReminders} label="Напоминать о приёме" description="Повторяем, пока вы не ответите: «Принял», «Отложить» или «Пропустить»." />
        </div>

        <Field label="Заметки">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Например, после еды" />
        </Field>

        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          DayMate только напоминает по расписанию, которое задали вы. Приложение не подбирает дозировки и не заменяет консультацию врача.
        </p>
      </form>
    </Modal>
  );
}
