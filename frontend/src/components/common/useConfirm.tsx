import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

/**
 * Our own confirm dialog (the browser's one looks out of place).
 * `const { confirm, dialog } = useConfirm()`, render `dialog`, then `if (await confirm({...}))`.
 */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    []
  );

  const finish = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
  }, []);

  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
      if (e.key === 'Enter') finish(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opts, finish]);

  const dialog =
    opts &&
    createPortal(
      <div className="fixed inset-0 z-[200] flex items-center justify-center px-5" role="alertdialog" aria-label={opts.title}>
        <button type="button" aria-label="Cancel" className="absolute inset-0 bg-black/60 cursor-default" onClick={() => finish(false)} />
        <div className="relative w-full max-w-[380px] rounded-3xl bg-[#19191c] border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.6)] p-6 text-white animate-fade-in">
          <h2 className="font-heading font-medium text-2xl leading-snug">{opts.title}</h2>
          {opts.body && <p className="font-body text-lg text-white/60 mt-2 leading-relaxed">{opts.body}</p>}
          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={() => finish(false)}
              className="flex-1 h-12 rounded-2xl bg-white/[0.07] hover:bg-white/12 font-mono text-[11px] tracking-[0.2em] cursor-pointer"
            >
              {(opts.cancelLabel ?? 'Not yet').toUpperCase()}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => finish(true)}
              className={`flex-1 h-12 rounded-2xl font-mono text-[11px] tracking-[0.2em] font-bold cursor-pointer ${
                opts.danger ? 'bg-rose-500 text-white hover:bg-rose-400' : 'bg-brand-cyan text-black hover:shadow-[0_0_20px_rgba(0,216,255,0.5)]'
              }`}
            >
              {(opts.confirmLabel ?? 'Yes').toUpperCase()}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );

  return { confirm, dialog };
}
