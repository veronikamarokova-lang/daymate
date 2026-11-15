import type { AppData } from '../models/types';
import { parseAppData } from './schema';

/**
 * Абстракция хранилища. Интерфейс асинхронный намеренно: позже сюда подключается
 * IndexedDB или облачный API с авторизацией, а остальной код не меняется.
 */
export interface StorageAdapter {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
  clear(): Promise<void>;
  /** Сообщает об изменениях, сделанных вне текущей вкладки. */
  subscribe(listener: (data: AppData | null) => void): () => void;
}

export class StorageError extends Error {}

const KEY = 'daymate:data:v1';

export class LocalStorageAdapter implements StorageAdapter {
  async load(): Promise<AppData | null> {
    let raw: string | null;
    try {
      raw = localStorage.getItem(KEY);
    } catch {
      throw new StorageError('Браузер запретил доступ к локальному хранилищу.');
    }
    if (!raw) return null;
    try {
      return parseAppData(JSON.parse(raw));
    } catch {
      // Сохраняем повреждённую копию, чтобы данные можно было восстановить вручную.
      try { localStorage.setItem(`${KEY}:corrupted`, raw); } catch { /* нет места — пропускаем */ }
      throw new StorageError('Сохранённые данные повреждены. Копия оставлена в хранилище браузера.');
    }
  }

  async save(data: AppData): Promise<void> {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      throw new StorageError('Не удалось сохранить данные: хранилище браузера переполнено или недоступно.');
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(`${KEY}:corrupted`);
    } catch {
      throw new StorageError('Не удалось очистить хранилище браузера.');
    }
  }

  subscribe(listener: (data: AppData | null) => void): () => void {
    const handler = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      try {
        listener(e.newValue ? parseAppData(JSON.parse(e.newValue)) : null);
      } catch { /* другая вкладка записала мусор — игнорируем */ }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
}
