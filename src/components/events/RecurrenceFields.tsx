import type { DateKey, Recurrence, RecurrenceFreq } from '../../models/types';
import { Field, Select, TextInput, WeekdayPicker } from '../ui/fields';
import { weekdayOf } from '../../lib/date';

interface Props {
  value: Recurrence;
  onChange: (r: Recurrence) => void;
  startDate: DateKey;
  weekStartsOn: 0 | 1;
  /** Для лекарств вариант «не повторяется» не нужен — есть дата окончания. */
  allowNone?: boolean;
  showUntil?: boolean;
  error?: string;
}

const UNIT: Record<RecurrenceFreq, string> = { none: '', daily: 'дн.', weekly: 'нед.', monthly: 'мес.' };

export function RecurrenceFields({ value, onChange, startDate, weekStartsOn, allowNone = true, showUntil = true, error }: Props) {
  const setFreq = (freq: RecurrenceFreq) =>
    onChange({
      ...value,
      freq,
      interval: freq === 'none' ? 1 : value.interval,
      byWeekday: freq === 'weekly' ? (value.byWeekday?.length ? value.byWeekday : [weekdayOf(startDate)]) : undefined,
      until: freq === 'none' ? undefined : value.until,
    });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Повторение">
          <Select value={value.freq} onChange={(e) => setFreq(e.target.value as RecurrenceFreq)}>
            {allowNone && <option value="none">Не повторять</option>}
            <option value="daily">По дням</option>
            <option value="weekly">По неделям</option>
            <option value="monthly">По месяцам</option>
          </Select>
        </Field>
        {value.freq !== 'none' && (
          <Field label={`Каждые, ${UNIT[value.freq]}`}>
            <TextInput
              type="number" inputMode="numeric" min={1} max={365} value={value.interval}
              onChange={(e) => onChange({ ...value, interval: Math.min(365, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </Field>
        )}
      </div>
      {value.freq === 'weekly' && (
        <Field label="Дни недели" error={error}>
          <WeekdayPicker value={value.byWeekday ?? []} onChange={(days) => onChange({ ...value, byWeekday: days })} weekStartsOn={weekStartsOn} />
        </Field>
      )}
      {showUntil && value.freq !== 'none' && (
        <Field label="Повторять до" hint="Оставьте пустым, чтобы повторять бессрочно.">
          <TextInput type="date" min={startDate} value={value.until ?? ''} onChange={(e) => onChange({ ...value, until: e.target.value || undefined })} />
        </Field>
      )}
    </div>
  );
}
