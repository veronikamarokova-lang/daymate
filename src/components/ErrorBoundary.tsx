import { Component, type ReactNode } from 'react';

/** Последний рубеж: если экран упал, показываем понятное сообщение, а данные остаются в хранилище. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-lg font-semibold">Что-то пошло не так</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Ваши данные сохранены. Перезагрузите страницу — если ошибка повторится, сделайте экспорт в настройках.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-100 p-3 text-left text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{this.state.error.message}</pre>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 h-11 rounded-2xl bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700">
            Перезагрузить
          </button>
        </div>
      </div>
    );
  }
}
