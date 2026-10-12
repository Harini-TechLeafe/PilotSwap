import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Kind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: Kind;
  title: string;
  message?: string;
  href?: string | null;
}
interface ToastApi {
  push: (t: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastApi>({ push: () => {} });
export const useToast = (): ToastApi => useContext(ToastContext);

const ACCENT: Record<Kind, string> = {
  success: 'border-l-emerald-400',
  error: 'border-l-rose-400',
  info: 'border-l-altitude',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((p) => [...p.slice(-3), { ...t, id }]);
    window.setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 7000);
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={`toast-in pointer-events-auto glass rounded-xl border-l-4 p-3.5 ${ACCENT[t.kind]}`}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-cloud">{t.title}</p>
              <button aria-label="Dismiss" onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))} className="text-slate-500 hover:text-cloud">
                ✕
              </button>
            </div>
            {t.message && <p className="mt-1 text-sm text-slate-600">{t.message}</p>}
            {t.href && (
              <a href={t.href} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-sm font-medium text-horizon hover:underline">
                View on block explorer
              </a>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
