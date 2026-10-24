import React, { Suspense, lazy, useState } from 'react';
import { QUICK_REACTIONS, type Chip } from './reactions';

const EmojiSheet = lazy(() => import('./EmojiSheet'));

interface ReactionBarProps {
  chips: Chip[];
  onToggle: (emoji: string) => void;
  align?: 'start' | 'end';
  /** The letter's own bar says "react"; replies just get a small face */
  label?: string;
}

/** Existing reactions as tappable chips, plus a button that opens the quick row (and "+" for any emoji). */
export const ReactionBar: React.FC<ReactionBarProps> = ({ chips, onToggle, align = 'start', label }) => {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const choose = (emoji: string) => {
    onToggle(emoji);
    setOpen(false);
    setSheet(false);
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${align === 'end' ? 'justify-end' : ''}`}>
      {chips.map((c) => (
        <button
          key={c.emoji}
          type="button"
          onClick={() => onToggle(c.emoji)}
          aria-pressed={c.mine}
          className={`h-7 px-2 rounded-full flex items-center gap-1 text-sm cursor-pointer transition-colors ${
            c.mine ? 'bg-brand-cyan/20 ring-1 ring-brand-cyan/70' : 'bg-white/[0.08] hover:bg-white/[0.14]'
          }`}
        >
          <span>{c.emoji}</span>
          {c.count > 1 && <span className="font-mono text-[10px] text-white/70">{c.count}</span>}
        </button>
      ))}

      {open ? (
        <div className="flex items-center gap-0.5 h-8 px-1 rounded-full bg-white/[0.1] animate-fade-in">
          {QUICK_REACTIONS.map((e) => (
            <button key={e} type="button" onClick={() => choose(e)} className="w-7 h-7 rounded-full text-base hover:bg-white/15 hover:scale-110 transition-transform cursor-pointer">
              {e}
            </button>
          ))}
          <button type="button" onClick={() => setSheet(true)} aria-label="More emoji" className="w-7 h-7 rounded-full font-mono text-sm text-white/70 hover:bg-white/15 cursor-pointer">
            +
          </button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="w-6 h-7 font-mono text-xs text-white/40 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="React"
          className={`h-7 rounded-full flex items-center gap-1 text-white/45 hover:text-white hover:bg-white/[0.08] cursor-pointer ${label ? 'px-2.5 font-mono text-[10px] tracking-wider' : 'w-7 justify-center'}`}
        >
          <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 9.5h.01M15 9.5h.01" />
          </svg>
          {label}
        </button>
      )}

      {sheet && (
        <Suspense fallback={null}>
          <EmojiSheet onPick={choose} onClose={() => setSheet(false)} />
        </Suspense>
      )}
    </div>
  );
};
