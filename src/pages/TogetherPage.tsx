import { useState, type FormEvent } from 'react';
import { CloudOff, Copy, HeartHandshake, RefreshCw, TriangleAlert, Unlink } from 'lucide-react';
import { useShared } from '../shared/SharedProvider';
import { useStore } from '../store/AppStore';
import { formatClock } from '../lib/date';
import { NotesTab } from '../components/together/NotesTab';
import { PlansTab } from '../components/together/PlansTab';
import { CycleTab } from '../components/together/CycleTab';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/misc';
import { Field, Segmented, TextInput } from '../components/ui/fields';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

type Tab = 'notes' | 'plans' | 'cycle';

export function TogetherPage() {
  const shared = useShared();
  const { data } = useStore();
  const toast = useToast();
  const { state, partner, status, error } = shared;
  const [tab, setTab] = useState<Tab>('notes');
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null);
  const paired = !!partner;
  const current: Tab = paired ? tab : 'cycle';

  return (
    <>
      <PageHeader
        title="Вместе"
        subtitle={paired ? `Вы и ${partner.name}` : 'Общие заметки, планы и календарь цикла'}
        action={state.account && (
          <Button size="sm" onClick={shared.syncNow} disabled={status === 'syncing'} aria-label="Обновить">
            <RefreshCw size={15} className={status === 'syncing' ? 'animate-spin' : ''} />Обновить
          </Button>
        )}
      />

      {error && (
        <div role="alert" className="mb-3 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {status === 'offline' ? <CloudOff size={18} className="mt-0.5 shrink-0" /> : <TriangleAlert size={18} className="mt-0.5 shrink-0" />}
          <div className="flex-1">
            <p>{error}</p>
            {status === 'offline' && state.account && <p className="mt-1 text-xs opacity-80">Изменения сохранятся на телефоне и отправятся, когда связь появится.</p>}
            {status === 'error' && state.account && (
              <Button size="sm" className="mt-2" onClick={shared.forgetLocal}>Отключиться на этом устройстве</Button>
            )}
          </div>
        </div>
      )}

      {!state.account ? <ConnectCard /> : !paired ? <PairCard /> : (
        <div className="mb-4">
          <Segmented label="Раздел" value={tab} onChange={setTab} options={[{ value: 'notes', label: 'Заметки' }, { value: 'plans', label: 'Планы' }, { value: 'cycle', label: 'Цикл' }]} />
        </div>
      )}

      {!paired && <h2 className="mt-6 mb-2.5 px-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Календарь цикла</h2>}
      {current === 'notes' && <NotesTab />}
      {current === 'plans' && <PlansTab />}
      {current === 'cycle' && <CycleTab />}

      {state.account && (
        <Card className="mt-6 space-y-3 p-4 text-xs text-slate-500 dark:text-slate-400">
          <p>
            Сервер: {state.serverUrl.replace(/^https?:\/\//, '')}
            {state.lastSyncAt && ` · обновлено в ${formatClock(new Date(state.lastSyncAt), data.settings.timeFormat)}`}
            {state.outbox.length > 0 && ` · ждёт отправки: ${state.outbox.length}`}
          </p>
          <p>
            На сервере хранятся только общие заметки, планы и — если включено — календарь цикла. Лекарства, расписание и привычки остаются на телефоне.
            Новые записи партнёра появляются, когда приложение открыто; уведомления о них не приходят.
          </p>
          <div className="flex flex-wrap gap-2">
            {paired && <Button size="sm" onClick={() => setConfirm('leave')}><Unlink size={15} />Разорвать пару</Button>}
            <Button size="sm" className="text-rose-600 dark:text-rose-400" onClick={() => setConfirm('delete')}>Удалить мой аккаунт с сервера</Button>
          </div>
        </Card>
      )}

      {confirm === 'leave' && (
        <ConfirmDialog
          title="Разорвать пару?"
          confirmLabel="Разорвать"
          message={<>Вы перестанете видеть общие заметки и планы, а ваш календарь цикла сотрётся с сервера. У {partner?.name ?? 'партнёра'} общие записи останутся. Отметки цикла на вашем телефоне сохранятся.</>}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); void shared.leavePair().then((ok) => ok && toast('Пара разорвана')); }}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmDialog
          title="Удалить аккаунт с сервера?"
          confirmLabel="Удалить"
          message="Ваш аккаунт и календарь цикла будут удалены с сервера, пара — разорвана. Если партнёра нет, общие записи тоже удалятся. Личные данные на телефоне не затрагиваются."
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); void shared.deleteAccount().then((ok) => ok && toast('Аккаунт удалён с сервера')); }}
        />
      )}
    </>
  );
}

function ConnectCard() {
  const shared = useShared();
  const { data } = useStore();
  const [name, setName] = useState(data.settings.userName);
  const [url, setUrl] = useState(shared.state.serverUrl);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await shared.connect(url, name);
    setBusy(false);
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"><HeartHandshake size={22} /></span>
        <div>
          <h2 className="font-semibold">Соединитесь с близким человеком</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Общие заметки на день, планы и желания, календарь цикла. Ваши лекарства, расписание и привычки никому не передаются.</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field label="Ваше имя" hint="Его увидит партнёр.">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Как вас подписать" />
        </Field>
        <Field label="Адрес сервера" hint="Одинаковый у обоих. Его даёт тот, кто настроил сервер.">
          <TextInput value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoCapitalize="none" placeholder="например, daymate.example.ru" />
        </Field>
        <Button variant="primary" type="submit" disabled={busy || !name.trim() || !url.trim()}>{busy ? 'Подключение…' : 'Подключиться'}</Button>
      </form>
    </Card>
  );
}

function PairCard() {
  const shared = useShared();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const pairCode = shared.state.pairCode && shared.state.pairCode.expiresAt * 1000 > Date.now() ? shared.state.pairCode : undefined;

  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    return ok;
  };

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Создайте пару</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Один из вас получает код и отправляет его второму. Код действует 15 минут и срабатывает один раз.</p>
      </div>
      {pairCode ? (
        <div className="rounded-2xl bg-violet-50 p-4 text-center dark:bg-violet-500/10">
          <div className="text-xs text-slate-500 dark:text-slate-400">Ваш код — отправьте его партнёру</div>
          <div className="mt-1 font-mono text-2xl font-semibold tracking-[0.2em] text-violet-700 dark:text-violet-200">{pairCode.code}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => void navigator.clipboard?.writeText(pairCode.code).then(() => toast('Код скопирован'), () => toast('Не удалось скопировать — перепишите код вручную', { tone: 'error' }))}><Copy size={15} />Скопировать</Button>
            <Button size="sm" onClick={shared.syncNow}>Партнёр ввёл код</Button>
          </div>
        </div>
      ) : (
        <Button variant="primary" disabled={busy} onClick={() => void run(shared.createCode)}>Получить код</Button>
      )}
      <form
        className="border-t border-slate-100 pt-4 dark:border-slate-800"
        onSubmit={(e) => { e.preventDefault(); void run(() => shared.joinByCode(code)).then((ok) => ok && toast('Вы соединены')); }}
      >
        <Field label="Или введите код партнёра">
          <div className="flex gap-2">
            <TextInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} autoCapitalize="characters" placeholder="8 символов" className="font-mono tracking-widest" />
            <Button type="submit" disabled={busy || code.trim().length < 8}>Соединиться</Button>
          </div>
        </Field>
      </form>
    </Card>
  );
}
