export class SyncApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function normalizeServerUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Запрос к серверу DayMate. status 0 — сервер недоступен (нет сети или неверный адрес). */
export async function apiCall<T>(serverUrl: string, path: string, body: unknown = {}, token?: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(`${normalizeServerUrl(serverUrl)}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new SyncApiError(0, 'Нет связи с сервером. Проверьте интернет и адрес сервера.');
  } finally {
    clearTimeout(timer);
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch { /* сервер ответил не JSON */ }
  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error;
    throw new SyncApiError(response.status, message ?? `Ошибка сервера (${response.status}).`);
  }
  return data as T;
}
