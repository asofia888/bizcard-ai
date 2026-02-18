import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ConfirmState {
  message: string;
  confirmLabel: string;
  resolve: (value: boolean) => void;
}

export interface DialogContextValue {
  showToast: (message: string, type?: ToastType) => void;
  showConfirm: (message: string, confirmLabel?: string) => Promise<boolean>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

export const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within <DialogProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const showConfirm = useCallback(
    (message: string, confirmLabel = '実行する'): Promise<boolean> =>
      new Promise(resolve => {
        setConfirm({ message, confirmLabel, resolve });
      }),
    []
  );

  const handleConfirm = (value: boolean) => {
    confirm?.resolve(value);
    setConfirm(null);
  };

  const iconMap: Record<ToastType, string> = {
    success: '✓',
    error: '！',
    info: 'ℹ',
  };

  const bgMap: Record<ToastType, string> = {
    success: 'bg-emerald-600',
    error: 'bg-red-500',
    info: 'bg-slate-700',
  };

  return (
    <DialogContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* ── Toast 通知 ── */}
      <div className="fixed top-4 inset-x-0 flex flex-col items-center gap-2 z-[200] pointer-events-none px-4">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-sm px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-3 ${bgMap[t.type]}`}
          >
            <span className="text-base leading-none w-5 text-center shrink-0">
              {iconMap[t.type]}
            </span>
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>

      {/* ── 確認モーダル ── */}
      {confirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50"
          onClick={() => handleConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-slate-800 font-medium text-base leading-relaxed">
              {confirm.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 active:scale-[0.98] transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleConfirm(true)}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 active:scale-[0.98] transition-all"
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
