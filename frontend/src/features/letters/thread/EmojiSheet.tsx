import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** Every emoji, in a bottom sheet. emoji-mart (and its data) only download when this opens. */
export const EmojiSheet: React.FC<{ onPick: (emoji: string) => void; onClose: () => void }> = ({ onPick, onClose }) => {
  const host = useRef<HTMLDivElement>(null);
  const pick = useRef(onPick);

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let cancelled = false;
    const el = host.current!;
    Promise.all([import('emoji-mart'), import('@emoji-mart/data')]).then(([{ Picker }, data]) => {
      if (cancelled) return;
      const picker = new Picker({
        data: data.default,
        onEmojiSelect: (e: { native: string }) => pick.current(e.native),
        theme: 'dark',
        previewPosition: 'none',
        skinTonePosition: 'search',
        navPosition: 'bottom',
        perLine: 8,
        maxFrequentRows: 2,
      });
      el.appendChild(picker as unknown as Node);
    });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      el.replaceChildren();
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        ref={host}
        onClick={(e) => e.stopPropagation()}
        className="mb-[max(1rem,env(safe-area-inset-bottom))] min-h-[200px] rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] [&_em-emoji-picker]:max-w-[92vw]"
      />
    </div>,
    document.body
  );
};

export default EmojiSheet;
