import { useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Send, StickyNote, Trash2 } from 'lucide-react';
import type { DateKey } from '../../models/types';
import { useShared } from '../../shared/SharedProvider';
import { addDays, formatClock, formatLongDate, todayKey } from '../../lib/date';
import { useStore } from '../../store/AppStore';
import { Button, IconButton } from '../ui/Button';
import { Card } from '../ui/misc';
import { TextInput } from '../ui/fields';

/** Общие заметки на день: короткие записи, которые видят оба. */
export function NotesTab() {
  const { itemsOf, save, remove, nameOf, me } = useShared();
  const { data } = useStore();
  const today = todayKey();
  const [date, setDate] = useState<DateKey>(today);
  const [text, setText] = useState('');
  const notes = itemsOf('note').filter((n) => n.date === date).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    save('note', { text: value.slice(0, 1000) }, { date });
    setText('');
  }

  return (
    <>
      <Card className="flex items-center justify-between p-2">
        <IconButton label="Предыдущий день" onClick={() => setDate(addDays(date, -1))}><ChevronLeft size={19} /></IconButton>
        <button type="button" onClick={() => setDate(today)} className="rounded-xl px-3 py-1.5 text-sm font-semibold first-letter:uppercase hover:bg-slate-100 dark:hover:bg-slate-800">
          {formatLongDate(date)}{date === today && ' · сегодня'}
        </button>
        <IconButton label="Следующий день" onClick={() => setDate(addDays(date, 1))}><ChevronRight size={19} /></IconButton>
      </Card>

      <div className="mt-3 space-y-2">
        {notes.length === 0 && (
          <Card className="flex flex-col items-center px-6 py-8 text-center">
            <StickyNote size={24} className="text-violet-400" />
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">На этот день заметок нет. Напишите первую — её увидите вы оба.</p>
          </Card>
        )}
        {notes.map((n) => {
          const mine = n.authorId === me?.id;
          return (
            <div key={n.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`group max-w-[85%] rounded-3xl px-4 py-2.5 ${mine ? 'bg-violet-600 text-white' : 'border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
                <p className="text-sm break-words whitespace-pre-line">{String(n.payload.text ?? '')}</p>
                <div className={`mt-1 flex items-center gap-2 text-[11px] ${mine ? 'text-violet-200' : 'text-slate-400'}`}>
                  <span>{nameOf(n.authorId)} · {formatClock(new Date(n.updatedAt), data.settings.timeFormat)}</span>
                  <button type="button" aria-label="Удалить заметку" onClick={() => remove(n.id)} className="rounded p-0.5 opacity-70 hover:opacity-100">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <TextInput value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Заметка на этот день" aria-label="Текст заметки" />
        <Button variant="primary" type="submit" disabled={!text.trim()} aria-label="Добавить заметку"><Send size={17} /></Button>
      </form>
    </>
  );
}
