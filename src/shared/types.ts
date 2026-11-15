import type { DateKey } from '../models/types';

export type SharedType = 'note' | 'plan' | 'cycle';

/** Запись, общая для пары. Хранится на сервере и в кэше на устройстве. */
export interface SharedItem {
  id: string;
  type: SharedType;
  date?: DateKey | null;
  payload: Record<string, unknown>;
  authorId: string;
  updatedAt: string;
  deleted: boolean;
  seq?: number;
}

export interface Member {
  id: string;
  name: string;
}

export interface SharedState {
  serverUrl: string;
  account: { userId: string; token: string; name: string } | null;
  space: { id: string; members: Member[] } | null;
  /** Номер последнего полученного изменения. */
  seq: number;
  items: Record<string, SharedItem>;
  /** Изменения, ещё не отправленные на сервер (например, сделанные без сети). */
  outbox: SharedItem[];
  /** Делиться ли своим календарём цикла с партнёром. По умолчанию — нет. */
  shareCycle: boolean;
  pairCode?: { code: string; expiresAt: number };
  lastSyncAt?: string;
}

export interface SyncResponse {
  space: SharedState['space'];
  seq: number;
  items: SharedItem[];
  more?: boolean;
}

export const DEFAULT_SERVER_URL: string = (import.meta.env?.VITE_SYNC_URL as string | undefined) ?? '';

export function emptyShared(): SharedState {
  return { serverUrl: DEFAULT_SERVER_URL, account: null, space: null, seq: 0, items: {}, outbox: [], shareCycle: false };
}

/**
 * Применяет ответ сервера к состоянию. `sent` — изменения, ушедшие в этом запросе:
 * они убираются из очереди, а всё, что пользователь успел изменить позже, остаётся поверх.
 */
export function applySync(state: SharedState, res: SyncResponse, sent: readonly SharedItem[]): SharedState {
  if (!res.space) {
    return { ...state, space: null, seq: 0, items: {}, outbox: [], pairCode: state.pairCode };
  }
  const spaceChanged = state.space?.id !== res.space.id;
  const items = spaceChanged ? {} : { ...state.items };
  for (const item of res.items) {
    if (item.deleted) delete items[item.id];
    else items[item.id] = item;
  }
  const outbox = state.outbox.filter((o) => !sent.includes(o));
  for (const pending of outbox) {
    if (pending.deleted) delete items[pending.id];
    else items[pending.id] = pending;
  }
  const paired = res.space.members.length >= 2;
  return {
    ...state, space: res.space, seq: res.seq, items, outbox,
    pairCode: paired ? undefined : state.pairCode,
    lastSyncAt: new Date().toISOString(),
  };
}
