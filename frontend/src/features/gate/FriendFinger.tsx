import React from 'react';
import { PALETTE } from '../../components/background/gridConfig';
import type { Friend } from './useSharedGrid';

/** A soft glow (and their name) on the tile the other person's finger is on. */
export const FriendFinger: React.FC<{ friend: Friend | null }> = ({ friend }) => {
  const rect = friend?.finger?.rect;
  if (!friend?.finger || !rect) return null; // off this screen, or not moving
  const hex = PALETTE[friend.finger.tool || 4].hex;
  return (
    <div
      aria-hidden="true"
      className="fixed z-10 pointer-events-none transition-[left,top] duration-100 ease-out"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    >
      <span className="absolute inset-[-6px] rounded-xl animate-pulse" style={{ boxShadow: `0 0 0 2px ${hex}, 0 0 18px 4px ${hex}` }} />
      <span
        className="absolute left-1/2 -translate-x-1/2 -top-6 px-1.5 py-0.5 rounded-md font-mono text-[9px] tracking-[0.15em] text-white whitespace-nowrap"
        style={{ backgroundColor: friend.finger.tool === 2 ? '#151515' : hex }}
      >
        {friend.name.toUpperCase()}
      </span>
    </div>
  );
};
