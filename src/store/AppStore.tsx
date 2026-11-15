import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData } from '../models/types';
import type { StorageAdapter } from '../storage/adapter';
import { emptyData } from '../storage/schema';
import { deviceTimeZone } from '../lib/date';

type Updater = (data: AppData) => AppData;

interface StoreValue {
  data: AppData;
  /** Применяет чистую мутацию и сохраняет результат. */
  update: (fn: Updater) => void;
  replaceAll: (data: AppData) => void;
  resetAll: () => Promise<void>;
  /** Текст ошибки сохранения/загрузки, если она была. */
  storageError: string | null;
  dismissStorageError: () => void;
  /** Часовой пояс прошлого запуска, если он отличается от текущего. */
  timeZoneChangedFrom: string | null;
  acknowledgeTimeZone: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function AppStoreProvider({ adapter, children }: { adapter: StorageAdapter; children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [timeZoneChangedFrom, setTimeZoneChangedFrom] = useState<string | null>(null);
  const dataRef = useRef<AppData | null>(null);

  const persist = useCallback(
    (next: AppData) => {
      dataRef.current = next;
      setData(next);
      adapter.save(next).catch((e: unknown) => setStorageError(e instanceof Error ? e.message : 'Ошибка сохранения.'));
    },
    [adapter],
  );

  useEffect(() => {
    let cancelled = false;
    adapter
      .load()
      .then((loaded) => {
        if (cancelled) return;
        const initial = loaded ?? emptyData();
        const tz = deviceTimeZone();
        if (loaded && initial.settings.lastTimeZone !== tz) setTimeZoneChangedFrom(initial.settings.lastTimeZone);
        dataRef.current = initial;
        setData(initial);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStorageError(e instanceof Error ? e.message : 'Не удалось загрузить данные.');
        dataRef.current = emptyData();
        setData(dataRef.current);
      });
    const unsubscribe = adapter.subscribe((external) => {
      dataRef.current = external ?? emptyData();
      setData(dataRef.current);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [adapter]);

  const value = useMemo<StoreValue | null>(() => {
    if (!data) return null;
    return {
      data,
      update: (fn) => persist(fn(dataRef.current ?? data)),
      replaceAll: persist,
      resetAll: async () => {
        try {
          await adapter.clear();
        } catch (e) {
          setStorageError(e instanceof Error ? e.message : 'Не удалось удалить данные.');
          return;
        }
        dataRef.current = emptyData();
        setData(dataRef.current);
      },
      storageError,
      dismissStorageError: () => setStorageError(null),
      timeZoneChangedFrom,
      acknowledgeTimeZone: () => {
        setTimeZoneChangedFrom(null);
        const current = dataRef.current ?? data;
        persist({ ...current, settings: { ...current.settings, lastTimeZone: deviceTimeZone() } });
      },
    };
  }, [data, persist, adapter, storageError, timeZoneChangedFrom]);

  if (!value) {
    return <div className="grid min-h-dvh place-items-center text-sm text-slate-400">Загрузка…</div>;
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore должен вызываться внутри AppStoreProvider');
  return ctx;
}
