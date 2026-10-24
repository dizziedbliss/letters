import React from 'react';
import { PALETTE } from '../../components/background/gridConfig';
import type { LiveStatus } from '../../lib/live';
import type { Friend } from './useSharedGrid';

interface DrawBarProps {
  tool: number;
  onTool: (t: number) => void;
  friend: Friend | null;
  status: LiveStatus;
  onClear: () => void;
  onEnter: () => void;
}

/** Bottom of the gate once you're signed in: colours, eraser, who's here, and the way in. */
export const DrawBar: React.FC<DrawBarProps> = ({ tool, onTool, friend, status, onClear, onEnter }) => (
  <div className="fixed inset-x-0 bottom-0 z-20 pointer-events-none flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] animate-fade-in">
    <div className="pointer-events-auto flex items-center gap-3 font-mono text-[10px] tracking-[0.18em] text-brand-black/70 select-none">
      <span className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${friend ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : status === 'live' ? 'bg-brand-black/30' : 'bg-rose-500'}`}
        />
        {friend ? `${friend.name.toUpperCase()} IS HERE` : status === 'offline' ? 'OFFLINE · SAVES WHEN BACK' : 'JUST YOU RN'}
      </span>
      <button type="button" onClick={onClear} className="underline underline-offset-4 decoration-brand-black/30 hover:decoration-brand-black cursor-pointer">
        CLEAR
      </button>
    </div>

    <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-paper/85 backdrop-blur-sm border-2 border-brand-black shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
      {PALETTE.map((p, i) => {
        const active = tool === i;
        return (
          <button
            key={p.name}
            type="button"
            aria-label={p.name}
            aria-pressed={active}
            onClick={() => onTool(i)}
            className={`relative w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-transform duration-150 active:scale-90 ${
              active ? 'ring-2 ring-brand-black ring-offset-2 ring-offset-paper scale-105' : 'hover:scale-105'
            }`}
            style={{ backgroundColor: i === 0 ? 'transparent' : p.hex }}
          >
            {i === 0 && (
              // eraser: an empty tile with a slash
              <span className="absolute inset-1 rounded-lg border-2 border-dashed border-brand-black/50 overflow-hidden">
                <span className="absolute left-1/2 top-[-4px] bottom-[-4px] w-[2px] bg-brand-black/60 rotate-45" />
              </span>
            )}
          </button>
        );
      })}
      <span className="w-px h-7 bg-brand-black/20 mx-0.5" />
      <button
        type="button"
        onClick={onEnter}
        className="h-9 px-4 rounded-xl bg-brand-black text-white font-mono text-[11px] tracking-[0.2em] font-bold flex items-center gap-2 hover:bg-brand-purple active:scale-95 transition-all duration-150 cursor-pointer"
      >
        ENTER
        <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-[2.5]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  </div>
);
