import { useState, type FormEvent } from 'react';
import { CalendarHeart, Check, Trash2 } from 'lucide-react';
import { useShared } from '../../shared/SharedProvider';
import type { SharedItem } from '../../shared/types';
import { formatLongDate, todayKey } from '../../lib/date';
import { Button, IconButton } from '../ui/Button';
import { Card, Chip, SectionTitle } from '../ui/misc';
import { Field, Segmented, TextInput } from '../ui/fields';

type Kind = 'plan' | 'wish';

/** Общие планы (с датой) и желания (без даты). */
export function PlansTab() {
  const { itemsOf, save, remove, nameOf } = useShared();
  const today = todayKey();
  const [kind, setKind] = useState<Kind>('plan');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const all = itemsOf('plan');
  const dated = all.filter((p) => p.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const upcoming = dated.filter((p) => String(p.date) >= today);
  const past = dated.filter((p) => String(p.date) < today).reverse();
  const wishes = all.filter((p) => !p.date).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value || (kind === 'plan' && !date)) return;
    save('plan', { title: value.slice(0, 200), done: false }, { date: kind === 'plan' ? date : null });
    setTitle('');
  }

  const row = (p: SharedItem) => {
    const done = p.payload.done === true;
    return (
      <li key={p.id}>
        <Card className="flex items-center gap-3 p-3.5">
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={done ? 'Снять отметку' : 'Отметить выполненным'}
            onClick={() => save('plan', { ...p.payload, done: !done }, { id: p.id })}
            className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors ${done ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 text-transparent hover:border-violet-400 dark:border-slate-600'}`}
          >
            <Check size={15} strokeWidth={3} />
          </button>
          <div className="min-w-0 flex-1">
            <div className={`font-medium break-words ${done ? 'text-slate-400 line-through dark:text-slate-500' : ''}`}>{String(p.payload.title ?? '')}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              {p.date && <span className="first-letter:uppercase">{formatLongDate(p.date)}</span>}
              {p.date === today && <Chip className="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">сегодня</Chip>}
              <span>добавлено: {nameOf(p.authorId).toLowerCase()}</span>
            </div>
          </div>
          <IconButton label="Удалить" className="hover:text-rose-600 dark:hover:text-rose-400" onClick={() => remove(p.id)}><Trash2 size={16} /></IconButton>
        </Card>
      </li>
    );
  };

  return (
    <>
      <Card className="p-4">
        <form onSubmit={submit} className="space-y-3">
          <Segmented label="Что добавить" value={kind} onChange={setKind} options={[{ value: 'plan', label: 'План на дату' }, { value: 'wish', label: 'Желание' }]} />
          <Field label={kind === 'plan' ? 'Что планируем' : 'Чего хочется'}>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={kind === 'plan' ? 'Например, сходить в кино' : 'Например, поехать на море'} />
          </Field>
          {kind === 'plan' && <Field label="Когда"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>}
          <Button variant="primary" type="submit" disabled={!title.trim() || (kind === 'plan' && !date)}>Добавить</Button>
        </form>
      </Card>

      {all.length === 0 && (
        <Card className="mt-3 flex flex-col items-center px-6 py-8 text-center">
          <CalendarHeart size={24} className="text-violet-400" />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Пока пусто. Добавьте общий план или желание.</p>
        </Card>
      )}
      {upcoming.length > 0 && <><SectionTitle>Планы</SectionTitle><ul className="space-y-2.5">{upcoming.map(row)}</ul></>}
      {wishes.length > 0 && <><SectionTitle>Желания</SectionTitle><ul className="space-y-2.5">{wishes.map(row)}</ul></>}
      {past.length > 0 && <><SectionTitle>Прошедшие</SectionTitle><ul className="space-y-2.5">{past.slice(0, 20).map(row)}</ul></>}
    </>
  );
}
