import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, ShieldCheck, Trash2, Upload } from 'lucide-react';
import type { AppData, Settings, ThemeMode } from '../models/types';
import { useStore } from '../store/AppStore';
import { updateSettings } from '../store/mutations';
import { DataFormatError, parseAppData } from '../storage/schema';
import { getNotifyPermission, notifyPermission, requestNotifyPermission, showSystemNotification, type NotifyPermission } from '../reminders/notifier';
import { exactAlarmsAllowed, isNative, openExactAlarmSettings, scheduleNativeTest } from '../reminders/native';
import { deviceTimeZone, todayKey } from '../lib/date';
import { Button } from '../components/ui/Button';
import { Card, PageHeader, SectionTitle } from '../components/ui/misc';
import { Field, Segmented, Select, TextInput, Toggle } from '../components/ui/fields';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

const NATIVE_PERMISSION_TEXT: Record<NotifyPermission, string> = {
  unsupported: 'Не удалось проверить разрешение на уведомления.',
  default: 'Android ещё не спрашивал разрешение на уведомления.',
  granted: 'Разрешение получено. Уведомления приходят, даже когда приложение закрыто.',
  denied: 'Уведомления запрещены. Разрешите их в настройках телефона: Приложения → DayMate → Уведомления.',
};

const PERMISSION_TEXT: Record<NotifyPermission, string> = {
  unsupported: 'Этот браузер не поддерживает системные уведомления. Напоминания будут появляться только внутри DayMate.',
  default: 'Браузер ещё не спрашивал разрешение на уведомления.',
  granted: 'Разрешение браузера получено.',
  denied: 'Уведомления запрещены в настройках браузера для этого сайта. Разрешите их там и вернитесь сюда.',
};

function Row({ children }: { children: ReactNode }) {
  return <div className="px-4 py-3.5">{children}</div>;
}

export function SettingsPage() {
  const { data, update, replaceAll, resetAll } = useStore();
  const toast = useToast();
  const s = data.settings;
  const set = (patch: Partial<Settings>) => update((d) => updateSettings(d, patch));
  const [permission, setPermission] = useState<NotifyPermission>(() => (isNative ? 'default' : notifyPermission()));
  const [exactOk, setExactOk] = useState(true);
  useEffect(() => {
    if (!isNative) return;
    const refresh = () => {
      void getNotifyPermission().then(setPermission);
      void exactAlarmsAllowed().then(setExactOk);
    };
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function toggleNotifications(on: boolean) {
    if (!on) return set({ notificationsEnabled: false });
    const result = await requestNotifyPermission();
    setPermission(result);
    if (result === 'granted') {
      set({ notificationsEnabled: true });
      toast('Уведомления включены');
    } else {
      set({ notificationsEnabled: false });
      toast(result === 'denied' ? 'Браузер запретил уведомления' : 'Уведомления недоступны', { tone: 'error' });
    }
  }

  async function testNotification() {
    if (isNative) {
      const scheduled = await scheduleNativeTest();
      toast(scheduled ? 'Через 5 секунд придёт обычное, через 15 — громкое' : 'Не удалось запланировать уведомление', { tone: scheduled ? 'ok' : 'error' });
      return;
    }
    const ok = await showSystemNotification(
      { key: 'daymate-test', kind: 'event', refId: 'test', date: todayKey(), time: '00:00', title: 'DayMate: проверка', body: '', scheduledAt: Date.now(), fireAt: Date.now(), repeat: false },
      'Так будут выглядеть напоминания.',
    );
    toast(ok ? 'Тестовое уведомление отправлено' : 'Не удалось показать уведомление', { tone: ok ? 'ok' : 'error' });
  }

  function exportData() {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daymate-${todayKey()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Файл с данными сохранён');
    } catch {
      toast('Не удалось создать файл экспорта', { tone: 'error' });
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new DataFormatError('Файл слишком большой для данных DayMate.');
      setPendingImport(parseAppData(JSON.parse(await file.text())));
    } catch (e) {
      toast(e instanceof DataFormatError ? e.message : 'Не удалось прочитать файл: это не JSON-экспорт DayMate.', { tone: 'error' });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <>
      <PageHeader title="Настройки" />

      <SectionTitle>Профиль</SectionTitle>
      <Card>
        <Row>
          <Field label="Ваше имя" hint="Используется только в приветствии и никуда не отправляется.">
            <TextInput value={s.userName} maxLength={60} placeholder="Как к вам обращаться" onChange={(e) => set({ userName: e.target.value })} />
          </Field>
        </Row>
      </Card>

      <SectionTitle>Оформление</SectionTitle>
      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        <Row>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Тема</span>
          <Segmented<ThemeMode>
            label="Тема" value={s.theme} onChange={(theme) => set({ theme })}
            options={[{ value: 'light', label: 'Светлая' }, { value: 'dark', label: 'Тёмная' }, { value: 'system', label: 'Как в системе' }]}
          />
        </Row>
        <Row>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Формат времени</span>
          <Segmented label="Формат времени" value={s.timeFormat} onChange={(timeFormat) => set({ timeFormat })} options={[{ value: '24h', label: '24 часа' }, { value: '12h', label: '12 часов (AM/PM)' }]} />
        </Row>
        <Row>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Первый день недели</span>
          <Segmented label="Первый день недели" value={s.weekStartsOn === 1 ? 'mon' : 'sun'} onChange={(v) => set({ weekStartsOn: v === 'mon' ? 1 : 0 })} options={[{ value: 'mon', label: 'Понедельник' }, { value: 'sun', label: 'Воскресенье' }]} />
        </Row>
      </Card>

      <SectionTitle>Напоминания</SectionTitle>
      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        <Row>
          <Toggle checked={s.notificationsEnabled && permission === 'granted'} onChange={toggleNotifications} label="Системные уведомления" description={(isNative ? NATIVE_PERMISSION_TEXT : PERMISSION_TEXT)[permission]} />
          {s.notificationsEnabled && permission === 'granted' && (
            <Button size="sm" className="mt-3" onClick={testNotification}>Проверить уведомление</Button>
          )}
        </Row>
        {isNative && !exactOk && (
          <Row>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Точные будильники выключены: Android может задержать напоминание на несколько минут.
            </p>
            <Button size="sm" className="mt-2" onClick={() => void openExactAlarmSettings().then(setExactOk)}>Разрешить точное время</Button>
          </Row>
        )}
        <Row>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Отложить на">
              <Select value={s.snoozeMinutes} onChange={(e) => set({ snoozeMinutes: Number(e.target.value) })}>
                {[5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m} мин</option>)}
              </Select>
            </Field>
            <Field label="Повторять каждые">
              <Select value={s.repeatMinutes} onChange={(e) => set({ repeatMinutes: Number(e.target.value) })}>
                {[2, 5, 10, 15, 30].map((m) => <option key={m} value={m}>{m} мин</option>)}
              </Select>
            </Field>
            <Field label="Число повторов">
              <Select value={s.maxRepeats} onChange={(e) => set({ maxRepeats: Number(e.target.value) })}>
                {[0, 1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n === 0 ? 'Не повторять' : n}</option>)}
              </Select>
            </Field>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Повторы приходят, пока вы не ответили на напоминание.</p>
        </Row>
        <Row>
          <Toggle
            checked={s.loudRepeat}
            onChange={(loudRepeat) => set({ loudRepeat })}
            label="Громкий повтор"
            description={isNative
              ? 'Повторное напоминание звучит дольше и на громкости будильника, а не уведомлений.'
              : 'Работает в Android-приложении. В браузере громкость уведомлений задаёт система.'}
          />
        </Row>
        <Row>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            <strong className="font-semibold text-slate-700 dark:text-slate-200">Как это работает.</strong>{' '}
            {isNative ? (
              <>
                Расписание на ближайшие две недели хранится в самом Android, поэтому напоминания приходят при закрытом приложении
                и после перезагрузки телефона. Открывайте DayMate хотя бы раз в две недели, чтобы расписание продлевалось.
                Если уведомления пропадают, отключите для DayMate экономию заряда в настройках телефона.
              </>
            ) : (
              <>
                Это веб-версия: напоминания срабатывают, пока DayMate открыт во вкладке браузера (вкладка может быть в фоне).
                Если браузер или вкладка закрыты, уведомление не придёт — при следующем открытии DayMate покажет пропущенное напоминание
                с пометкой об опоздании. Напоминания при закрытом приложении работают в Android-версии.
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Часовой пояс устройства: {deviceTimeZone()}</p>
        </Row>
      </Card>

      <SectionTitle>Данные и конфиденциальность</SectionTitle>
      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        <Row>
          <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-emerald-500" />
            <p>
              Все данные, включая сведения о лекарствах, хранятся только в этом браузере на вашем устройстве.
              DayMate ничего не отправляет на серверы и третьим лицам. Хранилище браузера не зашифровано —
              на общем компьютере используйте отдельный профиль браузера.
            </p>
          </div>
        </Row>
        <Row>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportData}><Download size={16} />Экспорт в файл</Button>
            <Button onClick={() => fileInput.current?.click()}><Upload size={16} />Импорт из файла</Button>
            <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Файл экспорта содержит ваши данные в открытом виде — храните его в надёжном месте.</p>
        </Row>
        <Row>
          <Button variant="secondary" className="text-rose-600 dark:text-rose-400" onClick={() => setConfirmReset(true)}><Trash2 size={16} />Удалить все данные</Button>
        </Row>
      </Card>

      <p className="mt-6 px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        DayMate 0.1 · Приложение помогает помнить о делах и приёме лекарств, но не является медицинским изделием,
        не ставит диагнозы и не заменяет консультацию врача.
      </p>

      {pendingImport && (
        <ConfirmDialog
          title="Заменить данные импортом?"
          danger={false}
          confirmLabel="Импортировать"
          message={
            <>
              В файле: событий — {pendingImport.events.length}, лекарств — {pendingImport.medications.length}, привычек — {pendingImport.habits.length}.
              Текущие данные на этом устройстве будут полностью заменены.
            </>
          }
          onCancel={() => setPendingImport(null)}
          onConfirm={() => {
            replaceAll({ ...pendingImport, settings: { ...pendingImport.settings, lastTimeZone: deviceTimeZone(), notificationsEnabled: pendingImport.settings.notificationsEnabled && permission === 'granted' } });
            setPendingImport(null);
            toast('Данные импортированы');
          }}
        />
      )}
      {confirmReset && (
        <ConfirmDialog
          title="Удалить все данные?"
          confirmLabel="Удалить всё"
          message="События, лекарства, история приёмов, привычки и настройки будут удалены с этого устройства без возможности восстановления. Сначала можно сделать экспорт."
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            void resetAll().then(() => toast('Все данные удалены'));
            try { localStorage.removeItem('daymate:reminders:v1'); } catch { /* недоступно */ }
            setConfirmReset(false);
          }}
        />
      )}
    </>
  );
}
