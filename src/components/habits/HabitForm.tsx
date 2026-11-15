import { useState, type FormEvent } from 'react';
import type { Habit, HabitColor } from '../../models/types';
import { useStore } from '../../store/AppStore';
import { saveHabit } from '../../store/mutations';
import { HABIT_COLORS } from '../../lib/categories';
import { todayKey } from '../../lib/date';
import { newId } from '../../lib/id';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Segmented, TextInput, WeekdayPicker } from '../ui/fields';
import { useToast } from '../ui/Toast';

const SUGGESTIONS = ['Выпивать воду', 'Делать зарядку', 'Читать', 'Ложиться спать вовремя', 'Заниматься спортом'];

export function HabitForm({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const { data, update } = useStore();
  const toast = useToast();
  const [name, setName] = useState(habit?.name ?? '');
  const [color, setColor] = useState<HabitColor>(habit?.color ?? 'violet');
  const [mode, setMode] = useState<'daily' | 'weekdays'>(habit?.frequency.type ?? 'daily');
  const [days, setDays] = useState<number[]>(habit?.frequency.type === 'weekdays' ? habit.frequency.days : [1, 3, 5]);
  const [target, setTarget] = useState(habit?.targetPerDay ?? 1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = 'Введите название привычки.';
    if (mode === 'weekdays' && days.length === 0) found.days = 'Выберите хотя бы один день.';
    setErrors(found);
    if (Object.keys(found).length) return;
    const next: Habit = {
      id: habit?.id ?? newId(),
      name: name.trim(),
      color,
      frequency: mode === 'daily' ? { type: 'daily' } : { type: 'weekdays', days },
      targetPerDay: target,
      createdAt: habit?.createdAt ?? todayKey(),
      archived: habit?.archived ?? false,
    };
    update((d) => saveHabit(d, next));
    toast(habit ? 'Привычка обновлена' : 'Привычка добавлена');
    onClose();
  }

  return (
    <Modal
      title={habit ? 'Изменить привычку' : 'Новая привычка'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="primary" type="submit" form="habit-form">{habit ? 'Сохранить' : 'Добавить'}</Button>
        </>
      }
    >
      <form id="habit-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Название" error={errors.name}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Например, читать 20 минут" />
        </Field>
        {!habit && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => setName(s)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                {s}
              </button>
            ))}
          </div>
        )}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Периодичность</span>
          <Segmented label="Периодичность" value={mode} onChange={setMode} options={[{ value: 'daily', label: 'Каждый день' }, { value: 'weekdays', label: 'По дням недели' }]} />
        </div>
        {mode === 'weekdays' && (
          <Field label="Дни" error={errors.days}>
            <WeekdayPicker value={days} onChange={setDays} weekStartsOn={data.settings.weekStartsOn} />
          </Field>
        )}
        <Field label="Сколько раз в день" hint="Например, 8 — для стаканов воды. Для обычной привычки оставьте 1.">
          <TextInput type="number" inputMode="numeric" min={1} max={99} value={target} onChange={(e) => setTarget(Math.min(99, Math.max(1, Number(e.target.value) || 1)))} />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Цвет</span>
          <div className="flex gap-2.5" role="radiogroup" aria-label="Цвет">
            {(Object.keys(HABIT_COLORS) as HabitColor[]).map((c) => (
              <button
                key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)}
                className={`size-9 rounded-full ${HABIT_COLORS[c].fill} transition-transform ${color === c ? 'scale-110 ring-2 ring-slate-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-slate-900' : 'opacity-70 hover:opacity-100'}`}
              />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
