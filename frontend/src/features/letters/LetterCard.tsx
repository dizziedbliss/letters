import React from 'react';
import type { IndexLetter } from '../../utils/api';
import { leftText, lockText } from './lock';

const Seal: React.FC = () => (
  <svg viewBox="0 0 40 28" className="w-10 h-7 shrink-0" aria-hidden="true">
    <rect x="1" y="1" width="38" height="26" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M1.5 2 20 15 38.5 2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="20" cy="15" r="4.5" fill="#6100D8" />
  </svg>
);

const Lock: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="1.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

interface LetterCardProps {
  letter: IndexLetter;
  writer: string | null;
  now: number;
  armed: boolean; // first tap on a quota letter arms it; second tap opens
  compact?: boolean;
  /** New replies or reactions from the writer since you last looked */
  newReplies?: boolean;
  onTap: (l: IndexLetter) => void;
}

/** One letter in the index: titled or sealed, open or locked (with the reason). */
export const LetterCard: React.FC<LetterCardProps> = ({ letter: l, writer, now, armed, compact, newReplies, onTap }) => {
  const read = !!l.openedAt;
  const left = leftText(l);

  return (
    <button
      type="button"
      onClick={() => onTap(l)}
      aria-disabled={l.locked || undefined}
      className={`group w-full text-left rounded-2xl px-4 transition-all duration-200 cursor-pointer border ${
        compact ? 'py-3' : 'py-4'
      } ${
        armed
          ? 'border-brand-cyan bg-brand-cyan/10'
          : l.locked
            ? 'border-white/5 bg-white/[0.03] text-white/45'
            : read
              ? 'border-white/5 bg-white/[0.03] hover:bg-white/[0.06]'
              : 'border-white/10 bg-white/[0.06] hover:bg-white/[0.1] hover:border-white/20'
      }`}
    >
      <div className="flex items-center gap-3">
        {l.sealed && !read && (
          <span className={l.locked ? 'text-white/30' : 'text-white/70'}>
            <Seal />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className={`font-body truncate ${compact ? 'text-lg' : 'text-xl'} ${l.title ? '' : 'italic text-white/60'}`}>
            {l.title ?? 'a sealed letter'}
          </div>
          <div className="font-mono text-[11px] tracking-wider mt-1 text-white/45">
            {armed ? (
              <span className="text-brand-cyan">tap again to open{left ? ` · ${left}` : ''}</span>
            ) : l.locked ? (
              <span className="text-rose-300/80">
                <Lock />
                {lockText(l, writer, now)}
              </span>
            ) : read ? (
              <>read {new Date(l.openedAt!).toLocaleDateString([], { day: 'numeric', month: 'short' })}</>
            ) : (
              <>new · {new Date(l.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}</>
            )}
          </div>
        </div>
        {newReplies && <span className="shrink-0 px-1.5 py-0.5 rounded bg-rose-500 font-mono text-[9px] tracking-wider text-white">NEW ♡</span>}
        {!l.locked && !read && <span className="w-2 h-2 rounded-full bg-brand-cyan shrink-0" aria-label="unread" />}
      </div>
    </button>
  );
};

export default LetterCard;
