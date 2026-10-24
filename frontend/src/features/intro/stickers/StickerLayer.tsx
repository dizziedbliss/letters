import React, { useEffect, useRef, useState } from 'react';
import { stickerZ, type Sticker } from '../doc';
import { StickerContent } from './StickerView';
import { clampWidth, heightOf, snapAngle, snapMove, type Guide } from './snap';

interface StickerLayerProps {
  stickers: Sticker[];
  scale: number;
  frameHeight: number; // design px
  snap: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** `key` groups a whole drag into one undo step. */
  onChange: (stickers: Sticker[], key?: string) => void;
}

type Drag =
  | { mode: 'move'; id: string; startX: number; startY: number; orig: Sticker }
  | { mode: 'resize'; id: string; startX: number; orig: Sticker }
  | { mode: 'rotate'; id: string; cx: number; cy: number; orig: Sticker };

/** Editable stickers: drag to move, corner to resize, top handle to rotate. Snaps to the grid and to guides. */
export const StickerLayer: React.FC<StickerLayerProps> = ({ stickers, scale, frameHeight, snap, selectedId, onSelect, onChange }) => {
  const drag = useRef<Drag | null>(null);
  const els = useRef(new Map<string, HTMLDivElement>());
  const [guides, setGuides] = useState<Guide[]>([]);

  const update = (id: string, patch: Partial<Sticker>, key: string) =>
    onChange(stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)), key);

  const begin = (e: React.PointerEvent, s: Sticker, mode: Drag['mode']) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onSelect(s.id);
    const orig = s;
    if (mode === 'rotate') {
      const r = els.current.get(s.id)!.getBoundingClientRect();
      drag.current = { mode, id: s.id, cx: r.left + r.width / 2, cy: r.top + r.height / 2, orig };
    } else if (mode === 'resize') {
      drag.current = { mode, id: s.id, startX: e.clientX, orig };
    } else {
      drag.current = { mode, id: s.id, startX: e.clientX, startY: e.clientY, orig };
    }
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const key = `drag:${d.id}`;
    if (d.mode === 'move') {
      const raw = { x: d.orig.x + (e.clientX - d.startX) / scale, y: d.orig.y + (e.clientY - d.startY) / scale };
      if (!snap) {
        update(d.id, { x: Math.round(raw.x), y: Math.round(raw.y) }, key);
        return;
      }
      const h = heightOf(d.orig, els.current.get(d.id)?.offsetHeight);
      const others = stickers
        .filter((s) => s.id !== d.id)
        .map((s) => ({ x: s.x, y: s.y, w: s.width, h: heightOf(s, els.current.get(s.id)?.offsetHeight) }));
      const r = snapMove({ ...raw, w: d.orig.width, h }, others, frameHeight);
      setGuides(r.guides);
      update(d.id, { x: r.x, y: r.y }, key);
    } else if (d.mode === 'resize') {
      const w = d.orig.width + (e.clientX - d.startX) / scale;
      update(d.id, { width: snap ? clampWidth(w) : Math.min(380, Math.max(24, Math.round(w))) }, key);
    } else {
      const deg = (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI + 90;
      update(d.id, { rotation: snap ? snapAngle(deg) : Math.round(deg) }, key);
    }
  };

  const end = () => {
    drag.current = null;
    setGuides([]);
  };

  // Delete / Backspace removes the selected sticker (unless you're typing somewhere)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId || (e.target as HTMLElement)?.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onChange(stickers.filter((s) => s.id !== selectedId));
        onSelect(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, stickers, onChange, onSelect]);

  const handle = 'absolute w-7 h-7 rounded-full bg-brand-cyan text-black text-xs font-bold flex items-center justify-center shadow-md touch-none cursor-pointer';

  return (
    <>
      {stickers.map((s) => {
        const selected = s.id === selectedId;
        return (
          <div
            key={s.id}
            ref={(el) => {
              if (el) els.current.set(s.id, el);
              else els.current.delete(s.id);
            }}
            onPointerDown={(e) => begin(e, s, 'move')}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onClick={(e) => e.stopPropagation()}
            className={`absolute touch-none cursor-grab active:cursor-grabbing ${selected ? 'outline-2 outline-dashed outline-brand-cyan outline-offset-4' : ''}`}
            // the selected sticker floats above everything so its handles are always reachable
            style={{ left: s.x, top: s.y, width: s.width, zIndex: selected ? 900 : stickerZ(s), transform: `rotate(${s.rotation}deg)` }}
          >
            <StickerContent sticker={s} />
            {selected && (
              <>
                <button
                  type="button"
                  aria-label="Rotate"
                  className={`${handle} left-1/2 -translate-x-1/2 -top-11`}
                  onPointerDown={(e) => begin(e, s, 'rotate')}
                  onPointerMove={move}
                  onPointerUp={end}
                >
                  ↻
                </button>
                <button
                  type="button"
                  aria-label="Resize"
                  className={`${handle} -right-4 -bottom-4`}
                  onPointerDown={(e) => begin(e, s, 'resize')}
                  onPointerMove={move}
                  onPointerUp={end}
                >
                  ⤡
                </button>
                <button
                  type="button"
                  aria-label="Delete sticker"
                  className={`${handle} -left-4 -top-4 bg-rose-500 text-white`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(stickers.filter((x) => x.id !== s.id));
                    onSelect(null);
                  }}
                >
                  ✕
                </button>
              </>
            )}
          </div>
        );
      })}

      {/* magnetic guide lines while dragging */}
      {guides.map((g, i) =>
        g.axis === 'x' ? (
          <div key={i} className="absolute top-0 bottom-0 w-px bg-brand-cyan/80 pointer-events-none z-[999]" style={{ left: g.pos }} />
        ) : (
          <div key={i} className="absolute left-0 right-0 h-px bg-brand-cyan/80 pointer-events-none z-[999]" style={{ top: g.pos }} />
        )
      )}
    </>
  );
};

export default StickerLayer;
