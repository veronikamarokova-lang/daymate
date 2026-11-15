import type { ReactNode } from 'react';
import { BellRing, Check, Globe, TriangleAlert, X } from 'lucide-react';
import { hrefFor, NAV, type Route } from './nav';
import { useStore } from '../../store/AppStore';
import { useReminders } from '../../reminders/ReminderProvider';
import { formatTime } from '../../lib/date';
import { Button, IconButton } from '../ui/Button';

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-100 bg-white px-4 py-6 lg:flex dark:border-slate-800 dark:bg-slate-900">
        <a href={hrefFor('today')} className="mb-8 flex items-center gap-2.5 rounded-xl px-2">
          <span className="grid size-9 place-items-center rounded-xl bg-violet-600 text-white"><Check size={20} strokeWidth={3} /></span>
          <span className="text-lg font-semibold tracking-tight">DayMate</span>
        </a>
        <nav className="space-y-1" aria-label="Основная навигация">
          {NAV.map(({ route: r, label, icon: Icon }) => (
            <a
              key={r}
              href={hrefFor(r)}
              aria-current={route === r ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors ${
                route === r
                  ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={19} strokeWidth={route === r ? 2.25 : 1.9} />
              {label}
            </a>
          ))}
        </nav>
        <p className="mt-auto px-2 text-xs leading-relaxed text-slate-400">Данные хранятся только на этом устройстве.</p>
      </aside>

      <main className="mx-auto w-full max-w-3xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:px-10 lg:pt-10 lg:pb-16">
        <SystemBanners />
        <div key={route} className="animate-fade-in">{children}</div>
      </main>

      <nav
        aria-label="Основная навигация"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden dark:border-slate-800 dark:bg-slate-900/90"
      >
        <div className="mx-auto flex max-w-lg">
          {NAV.map(({ route: r, label, icon: Icon }) => (
            <a
              key={r}
              href={hrefFor(r)}
              aria-current={route === r ? 'page' : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition-colors ${
                route === r ? 'text-violet-600 dark:text-violet-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <span className={`grid h-7 w-11 place-items-center rounded-full transition-colors ${route === r ? 'bg-violet-100 dark:bg-violet-500/20' : ''}`}>
                <Icon size={19} strokeWidth={route === r ? 2.25 : 1.9} />
              </span>
              <span className="max-w-full truncate px-0.5">{label}</span>
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Сообщения, которые важно увидеть на любой странице: ошибки, смена пояса, сработавшие напоминания. */
function SystemBanners() {
  const { data, storageError, dismissStorageError, timeZoneChangedFrom, acknowledgeTimeZone } = useStore();
  const { active, lateKeys, takeDose, snoozeDose, skipDose, completeEvent, dismiss } = useReminders();
  const visible = active.slice(-3);

  if (!storageError && !timeZoneChangedFrom && visible.length === 0) return null;
  return (
    <div className="mb-4 space-y-2.5">
      {storageError && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <span className="flex-1">{storageError}</span>
          <IconButton label="Скрыть" onClick={dismissStorageError}><X size={16} /></IconButton>
        </div>
      )}
      {timeZoneChangedFrom && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <Globe size={18} className="mt-0.5 shrink-0" />
          <span className="flex-1">
            Часовой пояс устройства изменился (был {timeZoneChangedFrom}). Напоминания сработают по местному времени: 09:00 останется 09:00.
            Если интервалы между приёмами лекарств важны, уточните расписание у врача.
          </span>
          <Button size="sm" onClick={acknowledgeTimeZone}>Понятно</Button>
        </div>
      )}
      {visible.map((r) => (
        <div key={r.key} className="animate-pop-in rounded-2xl border border-violet-200 bg-violet-50 p-3.5 dark:border-violet-500/30 dark:bg-violet-500/10">
          <div className="flex items-start gap-3">
            <BellRing size={18} className="mt-0.5 shrink-0 text-violet-600 dark:text-violet-300" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold break-words">{r.title}</div>
              <div className="text-xs text-slate-600 dark:text-slate-300">
                {formatTime(r.time, data.settings.timeFormat)}
                {lateKeys.has(r.key) && ' · напоминание пришло с опозданием: DayMate был закрыт или вкладка была неактивна'}
              </div>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2 pl-7">
            {r.kind === 'dose' ? (
              <>
                <Button size="sm" variant="primary" onClick={() => takeDose(r)}>Принял</Button>
                <Button size="sm" onClick={() => snoozeDose(r)}>Отложить на {data.settings.snoozeMinutes} мин</Button>
                <Button size="sm" variant="ghost" onClick={() => skipDose(r)}>Пропустить</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="primary" onClick={() => completeEvent(r)}>Готово</Button>
                <Button size="sm" variant="ghost" onClick={() => dismiss(r)}>Скрыть</Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
