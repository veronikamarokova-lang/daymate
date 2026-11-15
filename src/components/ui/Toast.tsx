import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';

interface ToastItem {
  id: number;
  text: string;
  tone: 'ok' | 'error';
  undo?: () => void;
  undoLabel?: string;
}

type ShowToast = (text: string, options?: { tone?: 'ok' | 'error'; undo?: () => void; undoLabel?: string }) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback<ShowToast>(
    (text, options) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-2), { id, text, tone: options?.tone ?? 'ok', undo: options?.undo, undoLabel: options?.undoLabel }]);
      window.setTimeout(() => dismiss(id), options?.undo ? 6000 : 3500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-8">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto flex max-w-sm animate-pop-in items-center gap-2.5 rounded-2xl bg-slate-900 py-2.5 pr-3 pl-3.5 text-sm text-white shadow-xl dark:bg-slate-100 dark:text-slate-900">
            {t.tone === 'ok' ? <CheckCircle2 size={18} className="shrink-0 text-emerald-400 dark:text-emerald-600" /> : <CircleAlert size={18} className="shrink-0 text-rose-400 dark:text-rose-600" />}
            <span>{t.text}</span>
            {t.undo && (
              <button
                type="button"
                className="ml-1 rounded-lg px-2 py-1 font-semibold text-violet-300 hover:bg-white/10 dark:text-violet-700 dark:hover:bg-black/5"
                onClick={() => { t.undo?.(); dismiss(t.id); }}
              >
                {t.undoLabel ?? 'Отменить'}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
