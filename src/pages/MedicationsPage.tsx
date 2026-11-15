import { useState } from 'react';
import { Pause, Pencil, Pill, Play, Plus, Trash2 } from 'lucide-react';
import type { Medication } from '../models/types';
import { useStore } from '../store/AppStore';
import { useReminders } from '../reminders/ReminderProvider';
import { deleteMedication, saveMedication } from '../store/mutations';
import { dosesOn, type DoseItem } from '../domain/agenda';
import { describeRecurrence } from '../domain/schedule';
import { addDays, formatShortDate, formatTime, todayKey } from '../lib/date';
import { MED_FORM_LABEL } from '../lib/categories';
import { MedicationForm } from '../components/medications/MedicationForm';
import { DoseStatusChip } from '../components/medications/DoseStatusChip';
import { DoseRow } from '../components/events/AgendaList';
import { Button, IconButton } from '../components/ui/Button';
import { Card, Chip, EmptyState, PageHeader, SectionTitle } from '../components/ui/misc';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

const HISTORY_DAYS = 14;

export function MedicationsPage() {
  const { data, update } = useStore();
  const { now } = useReminders();
  const toast = useToast();
  const [form, setForm] = useState<{ medication?: Medication } | null>(null);
  const [removing, setRemoving] = useState<Medication | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const today = todayKey(now);
  const fmt = data.settings.timeFormat;

  const todayDoses = dosesOn(data, today, now).sort((a, b) => a.time.localeCompare(b.time));

  // История: все приёмы за последние дни, время которых уже наступило, — включая те, что остались без отметки.
  const history: DoseItem[] = [];
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const date = addDays(today, -i);
    const day = dosesOn(data, date, now).filter((d) => d.status !== 'upcoming' && (i > 0 || d.status === 'taken' || d.status === 'skipped'));
    history.push(...day.sort((a, b) => b.time.localeCompare(a.time)));
  }
  const shownHistory = showAllHistory ? history : history.slice(0, 8);

  return (
    <>
      <PageHeader
        title="Лекарства"
        subtitle="Расписание приёма и история"
        action={<Button variant="primary" onClick={() => setForm({})}><Plus size={17} />Добавить</Button>}
      />

      {data.medications.length === 0 ? (
        <EmptyState
          icon={Pill}
          title="Лекарств пока нет"
          text="Добавьте препарат и время приёма так, как назначил врач. DayMate напомнит и сохранит историю."
          action={<Button variant="primary" onClick={() => setForm({})}><Plus size={17} />Добавить лекарство</Button>}
        />
      ) : (
        <>
          <SectionTitle>Сегодня</SectionTitle>
          {todayDoses.length > 0 ? (
            <ul className="space-y-2.5">
              {todayDoses.map((d) => <li key={d.key}><DoseRow item={d} /></li>)}
            </ul>
          ) : (
            <Card className="p-4 text-sm text-slate-500 dark:text-slate-400">На сегодня приёмов не запланировано.</Card>
          )}

          <SectionTitle>Мои лекарства</SectionTitle>
          <ul className="space-y-2.5">
            {data.medications.map((m) => (
              <li key={m.id}>
                <Card className={`p-4 ${m.active ? '' : 'opacity-70'}`}>
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300"><Pill size={19} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium break-words">{m.name}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{[m.dosage, MED_FORM_LABEL[m.form]].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div className="flex shrink-0">
                      <IconButton
                        label={m.active ? 'Приостановить напоминания' : 'Возобновить'}
                        onClick={() => {
                          update((d) => saveMedication(d, { ...m, active: !m.active, updatedAt: new Date().toISOString() }));
                          toast(m.active ? 'Приём приостановлен' : 'Приём возобновлён');
                        }}
                      >
                        {m.active ? <Pause size={16} /> : <Play size={16} />}
                      </IconButton>
                      <IconButton label="Изменить" onClick={() => setForm({ medication: m })}><Pencil size={16} /></IconButton>
                      <IconButton label="Удалить" className="hover:text-rose-600 dark:hover:text-rose-400" onClick={() => setRemoving(m)}><Trash2 size={16} /></IconButton>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.times.map((t) => <Chip key={t} className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{formatTime(t, fmt)}</Chip>)}
                    <Chip className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{describeRecurrence(m.recurrence)}</Chip>
                    {!m.active && <Chip className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">Приостановлено</Chip>}
                    {!m.remindersEnabled && <Chip className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Без напоминаний</Chip>}
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    С {formatShortDate(m.startDate)}{m.endDate ? ` по ${formatShortDate(m.endDate)}` : ', без даты окончания'} · приёмов в день: {m.times.length}
                  </p>
                  {m.notes && <p className="mt-1 text-xs whitespace-pre-line text-slate-500 dark:text-slate-400">{m.notes}</p>}
                </Card>
              </li>
            ))}
          </ul>

          <SectionTitle>История за {HISTORY_DAYS} дней</SectionTitle>
          {history.length === 0 ? (
            <Card className="p-4 text-sm text-slate-500 dark:text-slate-400">История появится после первой отметки о приёме.</Card>
          ) : (
            <Card className="divide-y divide-slate-100 dark:divide-slate-800">
              {shownHistory.map((d) => (
                <div key={d.key} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{d.medication.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{formatShortDate(d.date)}, {formatTime(d.time, fmt)}</div>
                  </div>
                  <DoseStatusChip item={d} format={fmt} />
                </div>
              ))}
              {history.length > 8 && (
                <button type="button" onClick={() => setShowAllHistory((v) => !v)} className="w-full rounded-b-3xl px-4 py-3 text-sm font-medium text-violet-600 hover:bg-slate-50 dark:text-violet-300 dark:hover:bg-slate-800">
                  {showAllHistory ? 'Свернуть' : `Показать все (${history.length})`}
                </button>
              )}
            </Card>
          )}
          <p className="mt-4 px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            «Принято» ставится только после вашей отметки. Приём без ответа отображается как «Нет отметки». DayMate не заменяет врача и не меняет назначенную схему лечения.
          </p>
        </>
      )}

      {form && <MedicationForm medication={form.medication} onClose={() => setForm(null)} />}
      {removing && (
        <ConfirmDialog
          title="Удалить лекарство?"
          message={<>«{removing.name}» будет удалено вместе с историей приёмов. Если нужно сохранить историю, приостановите приём вместо удаления.</>}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const snapshot = data;
            update((d) => deleteMedication(d, removing.id));
            toast('Лекарство удалено', { undo: () => update(() => snapshot) });
            setRemoving(null);
          }}
        />
      )}
    </>
  );
}
