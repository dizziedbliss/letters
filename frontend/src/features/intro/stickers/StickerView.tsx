import React from 'react';
import type { Sticker } from '../doc';
import { useMediaUrl } from '../useMediaUrl';
import { DOODLES } from './doodles';

/** One sticker, drawn at its spot. Shared by the reader and the builder. */
export const StickerContent: React.FC<{ sticker: Sticker }> = ({ sticker: s }) => {
  const url = useMediaUrl(s.kind === 'image' ? s.value : undefined);
  if (s.kind === 'emoji') {
    return (
      <span className="block leading-none text-center select-none" style={{ fontSize: s.width * 0.85 }}>
        {s.value}
      </span>
    );
  }
  if (s.kind === 'doodle') return <span className="block [&>svg]:w-full [&>svg]:h-auto">{DOODLES[s.value] ?? null}</span>;
  return url ? <img src={url} alt="" draggable={false} className="block w-full h-auto select-none rounded-sm" /> : <span className="block aspect-square bg-white/10 animate-pulse" />;
};

export const StickerView: React.FC<{ sticker: Sticker }> = ({ sticker: s }) => (
  <div
    className="absolute pointer-events-none"
    style={{ left: s.x, top: s.y, width: s.width, zIndex: 10 + s.z, transform: `rotate(${s.rotation}deg)` }}
  >
    <StickerContent sticker={s} />
  </div>
);

export default StickerView;
