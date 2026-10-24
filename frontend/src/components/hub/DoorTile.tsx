import React, { useState } from 'react';
import { IconLock } from './icons';

interface DoorTileProps {
  label: string;
  code: string;
  note: string;
  icon: React.ReactNode;
  tilt: number;
  index: number;
  locked?: boolean;
  onOpen?: () => void;
}

/** A paper-white menu tile. Locked ones are greyed out and shake when tapped. */
export const DoorTile: React.FC<DoorTileProps> = ({ label, code, note, icon, tilt, index, locked, onOpen }) => {
  const [shaking, setShaking] = useState(false);

  const press = () => {
    if (locked) {
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      return;
    }
    onOpen?.();
  };

  return (
    <button
      type="button"
      onClick={press}
      aria-disabled={locked || undefined}
      style={
        {
          '--tilt': `${tilt}deg`,
          animation: shaking
            ? 'lock-shake 0.4s ease'
            : 'tile-in 0.6s var(--ease-snap) both',
          animationDelay: shaking ? '0s' : `calc(var(--t0, 0s) + ${300 + index * 80}ms)`,
          transform: `rotate(${tilt}deg)`,
        } as React.CSSProperties
      }
      className={`group relative text-left overflow-hidden p-4 min-h-[112px] border-l-4 transition-[box-shadow,filter] duration-200 cursor-pointer ${
        locked
          ? 'bg-paper-deep/80 border-ink/20 text-ink/45'
          : 'bg-white border-brand-purple text-ink shadow-[4px_4px_0_rgba(17,17,20,0.12)] hover:shadow-[6px_6px_0_rgba(97,0,216,0.35)] active:brightness-95'
      }`}
    >
      {/* ghosted icon */}
      <span className="absolute -right-3 -bottom-3 w-24 h-24 opacity-[0.09] pointer-events-none">{icon}</span>

      <span className="font-mono text-[11px] tracking-[0.2em] opacity-60">{code}</span>
      <span className="block font-display text-[28px] leading-none uppercase tracking-wide mt-1">{label}</span>
      <span className="block font-mono text-[11px] mt-2 opacity-70">{locked ? 'LOCKED' : note}</span>

      {locked ? (
        <span className="absolute top-3 right-3 w-4 h-4">
          <IconLock />
        </span>
      ) : (
        <span className="absolute left-0 right-0 bottom-0 h-[3px] bg-brand-purple origin-left scale-x-[0.25] group-hover:scale-x-100 transition-transform duration-300 ease-[var(--ease-snap)]" />
      )}
    </button>
  );
};

export default DoorTile;
