import { useCallback, useEffect, useState } from 'react';

export type ToastKind = 'ok' | 'error';

/** One small message at the bottom of the screen that fades after a moment. */
export function useToast(ms = 2800) {
  const [toast, setToast] = useState<{ text: string; kind: ToastKind; id: number } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(t);
  }, [toast, ms]);

  const show = useCallback((text: string, kind: ToastKind = 'ok') => setToast({ text, kind, id: Date.now() }), []);

  const node = toast && (
    <div
      key={toast.id}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={`fixed left-1/2 -translate-x-1/2 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-50 max-w-[90vw] px-5 py-3 rounded-2xl font-body text-base shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-fade-in ${
        toast.kind === 'error' ? 'bg-rose-500 text-white' : 'bg-brand-cyan text-black'
      }`}
    >
      {toast.text}
    </div>
  );

  return { show, node };
}
