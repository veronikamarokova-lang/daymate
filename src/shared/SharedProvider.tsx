import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DateKey } from '../models/types';
import { useStore } from '../store/AppStore';
import { newId } from '../lib/id';
import { apiCall, normalizeServerUrl, SyncApiError } from './api';
import { applySync, emptyShared, type Member, type SharedItem, type SharedState, type SharedType, type SyncResponse } from './types';

const KEY = 'daymate:shared:v1';
const POLL_MS = 30_000;

function load(): SharedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyShared(), ...(JSON.parse(raw) as Partial<SharedState>) };
  } catch { /* повреждённый кэш — начинаем заново, общие данные есть на сервере */ }
  return emptyShared();
}

type Status = 'idle' | 'syncing' | 'offline' | 'error';

interface SharedValue {
  state: SharedState;
  status: Status;
  error: string | null;
  me: Member | null;
  partner: Member | null;
  /** Записи указанного типа, без удалённых. */
  itemsOf: (type: SharedType) => SharedItem[];
  nameOf: (userId: string) => string;
  connect: (serverUrl: string, name: string) => Promise<boolean>;
  createCode: () => Promise<boolean>;
  joinByCode: (code: string) => Promise<boolean>;
  leavePair: () => Promise<boolean>;
  deleteAccount: () => Promise<boolean>;
  /** Забыть подключение на этом устройстве, если сервер недоступен или аккаунт пропал. */
  forgetLocal: () => void;
  save: (type: SharedType, payload: Record<string, unknown>, options?: { id?: string; date?: DateKey | null }) => void;
  remove: (id: string) => void;
  setShareCycle: (on: boolean) => void;
  syncNow: () => void;
}

const SharedContext = createContext<SharedValue | null>(null);

export function SharedProvider({ children }: { children: ReactNode }) {
  const { data } = useStore();
  const [state, setState] = useState<SharedState>(load);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const ref = useRef(state);
  const busy = useRef(false);
  const again = useRef(false);

  const commit = useCallback((next: SharedState) => {
    ref.current = next;
    setState(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* кэш не сохранился — данные всё равно на сервере */ }
  }, []);

  const fail = useCallback((e: unknown) => {
    const apiError = e instanceof SyncApiError ? e : new SyncApiError(-1, 'Неизвестная ошибка.');
    setStatus(apiError.status === 0 ? 'offline' : 'error');
    setError(apiError.message);
  }, []);

  const sync = useCallback(async () => {
    const { account } = ref.current;
    if (!account) return;
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    setStatus('syncing');
    try {
      let more = true;
      while (more) {
        const current = ref.current;
        const sent = current.space ? current.outbox.slice(0, 200) : [];
        const res = await apiCall<SyncResponse>(current.serverUrl, '/api/sync', {
          since: current.seq,
          changes: sent.map(({ id, type, date, payload, deleted }) => ({ id, type, date: date ?? null, payload, deleted })),
        }, account.token);
        const spaceChanged = !!res.space && ref.current.space?.id !== res.space.id && ref.current.seq > 0;
        commit(applySync(spaceChanged ? { ...ref.current, seq: 0, items: {} } : ref.current, res, sent));
        // Сменилась пара — запрашиваем всё с начала; остались неотправленные изменения — отправляем дальше.
        if (spaceChanged) commit({ ...ref.current, seq: 0 });
        more = spaceChanged || !!res.more || (!!res.space && ref.current.outbox.length > 0 && sent.length > 0);
      }
      setStatus('idle');
      setError(null);
    } catch (e) {
      fail(e);
    } finally {
      busy.current = false;
      if (again.current) { again.current = false; void sync(); }
    }
  }, [commit, fail]);

  // Синхронизация: при запуске, при возвращении в приложение и раз в 30 секунд, пока оно открыто.
  const hasAccount = !!state.account;
  useEffect(() => {
    if (!hasAccount) return;
    void sync();
    const onWake = () => { if (document.visibilityState === 'visible') void sync(); };
    const timer = window.setInterval(onWake, POLL_MS);
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', onWake);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('online', onWake);
    };
  }, [hasAccount, sync]);

  const queue = useCallback((item: SharedItem) => {
    const current = ref.current;
    const items = { ...current.items };
    if (item.deleted) delete items[item.id];
    else items[item.id] = item;
    commit({ ...current, items, outbox: [...current.outbox.filter((o) => o.id !== item.id), item] });
    void sync();
  }, [commit, sync]);

  // Календарь цикла уходит на сервер только при включённом общем доступе; при выключении стирается оттуда.
  const myId = state.account?.userId;
  const spaceId = state.space?.id;
  const cycleKey = JSON.stringify(data.cycleDays);
  useEffect(() => {
    if (!myId || !spaceId) return;
    const id = `cycle:${myId}`;
    const existing = ref.current.items[id];
    const sharedNow = existing ? JSON.stringify((existing.payload as { days?: unknown }).days ?? []) : null;
    if (ref.current.shareCycle) {
      if (sharedNow !== cycleKey) {
        queue({ id, type: 'cycle', payload: { days: JSON.parse(cycleKey) as DateKey[] }, authorId: myId, updatedAt: new Date().toISOString(), deleted: false });
      }
    } else if (existing) {
      queue({ id, type: 'cycle', payload: {}, authorId: myId, updatedAt: new Date().toISOString(), deleted: true });
    }
  }, [myId, spaceId, cycleKey, state.shareCycle, state.seq, queue]);

  const value = useMemo<SharedValue>(() => {
    const members = state.space?.members ?? [];
    const me = state.account ? { id: state.account.userId, name: state.account.name } : null;
    const partner = members.find((m) => m.id !== state.account?.userId) ?? null;
    const run = async (fn: () => Promise<void>): Promise<boolean> => {
      try {
        await fn();
        setError(null);
        setStatus('idle');
        return true;
      } catch (e) {
        fail(e);
        return false;
      }
    };
    const call = <T,>(path: string, body: unknown = {}) => apiCall<T>(ref.current.serverUrl, path, body, ref.current.account?.token);

    return {
      state, status, error, me, partner,
      itemsOf: (type) => Object.values(state.items).filter((i) => i.type === type && !i.deleted),
      nameOf: (userId) => (userId === me?.id ? 'Вы' : members.find((m) => m.id === userId)?.name ?? 'Партнёр'),
      connect: (serverUrl, name) => run(async () => {
        const url = normalizeServerUrl(serverUrl);
        if (!url) throw new SyncApiError(-1, 'Укажите адрес сервера.');
        const account = await apiCall<{ userId: string; token: string }>(url, '/api/register', { name });
        commit({ ...emptyShared(), serverUrl: url, account: { ...account, name: name.trim() } });
      }),
      createCode: () => run(async () => {
        const res = await call<{ code: string; expiresAt: number; space: SharedState['space'] }>('/api/pair/create');
        commit({ ...ref.current, space: res.space, pairCode: { code: res.code, expiresAt: res.expiresAt } });
      }),
      joinByCode: (code) => run(async () => {
        const res = await call<{ space: SharedState['space'] }>('/api/pair/join', { code });
        commit({ ...ref.current, space: res.space, seq: 0, items: {}, outbox: [], pairCode: undefined });
        void sync();
      }),
      leavePair: () => run(async () => {
        await call('/api/pair/leave');
        commit({ ...ref.current, space: null, seq: 0, items: {}, outbox: [], pairCode: undefined });
      }),
      deleteAccount: () => run(async () => {
        await call('/api/account/delete');
        commit({ ...emptyShared(), serverUrl: ref.current.serverUrl });
      }),
      forgetLocal: () => {
        commit({ ...emptyShared(), serverUrl: ref.current.serverUrl });
        setError(null);
        setStatus('idle');
      },
      save: (type, payload, options) => {
        if (!me) return;
        const id = options?.id ?? newId();
        const previous = ref.current.items[id];
        queue({
          id, type, payload,
          date: options && 'date' in options ? options.date : previous?.date,
          authorId: previous?.authorId ?? me.id,
          updatedAt: new Date().toISOString(),
          deleted: false,
        });
      },
      remove: (id) => {
        const previous = ref.current.items[id];
        if (previous) queue({ ...previous, payload: {}, deleted: true, updatedAt: new Date().toISOString() });
      },
      setShareCycle: (on) => commit({ ...ref.current, shareCycle: on }),
      syncNow: () => void sync(),
    };
  }, [state, status, error, commit, fail, queue, sync]);

  return <SharedContext.Provider value={value}>{children}</SharedContext.Provider>;
}

export function useShared(): SharedValue {
  const ctx = useContext(SharedContext);
  if (!ctx) throw new Error('useShared должен вызываться внутри SharedProvider');
  return ctx;
}
