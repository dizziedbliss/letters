import React, { useRef, useState } from 'react';
import { BANNER_PX, type Banner } from './banner';
import { useMediaUrl } from '../intro/useMediaUrl';

interface LetterBannerProps {
  banner: Banner;
  /** Pass to make it editable (writer side). */
  onChange?: (banner: Banner) => void;
  onChangeImage?: () => void;
  onRemove?: () => void;
}

const SIZES: { value: Banner['height']; label: string }[] = [
  { value: 'sm', label: 'SLIM' },
  { value: 'md', label: 'MEDIUM' },
  { value: 'lg', label: 'TALL' },
];

/** A letter's header image. Writers can resize it, drag it to reposition, swap or remove it. */
export const LetterBanner: React.FC<LetterBannerProps> = ({ banner, onChange, onChangeImage, onRemove }) => {
  const url = useMediaUrl(banner.src);
  const [repositioning, setRepositioning] = useState(false);
  const drag = useRef<{ y: number; focus: number } | null>(null);
  const editable = !!onChange;
  const height = BANNER_PX[banner.height];

  const onPointerDown = (e: React.PointerEvent) => {
    if (!repositioning) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, focus: banner.focus };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !onChange) return;
    // dragging down reveals more of the top, like moving the photo itself
    const focus = Math.min(100, Math.max(0, drag.current.focus - ((e.clientY - drag.current.y) / height) * 100));
    onChange({ ...banner, focus: Math.round(focus) });
  };

  const btn = 'h-8 px-3 rounded-full bg-black/60 backdrop-blur text-white font-mono text-[10px] tracking-wider cursor-pointer hover:bg-black/80';

  return (
    <div className="group relative w-full overflow-hidden rounded-3xl bg-white/5" style={{ height }}>
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          className={`w-full h-full object-cover select-none ${repositioning ? 'cursor-ns-resize touch-none' : ''}`}
          style={{ objectPosition: `50% ${banner.focus}%` }}
        />
      ) : (
        <div className="w-full h-full animate-pulse" />
      )}

      {editable && (
        <div className={`absolute right-3 bottom-3 flex flex-wrap justify-end gap-1.5 transition-opacity ${repositioning ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'}`}>
          {repositioning ? (
            <>
              <span className="h-8 px-3 rounded-full bg-black/60 text-white/80 font-body text-sm flex items-center">drag the image up or down</span>
              <button type="button" onClick={() => setRepositioning(false)} className={`${btn} !bg-brand-cyan !text-black font-bold`}>
                DONE
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onChangeImage} className={btn}>
                CHANGE
              </button>
              <button type="button" onClick={() => setRepositioning(true)} className={btn}>
                REPOSITION
              </button>
              {SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => onChange?.({ ...banner, height: s.value })}
                  className={`${btn} ${banner.height === s.value ? '!bg-white !text-black' : ''}`}
                >
                  {s.label}
                </button>
              ))}
              <button type="button" onClick={onRemove} className={`${btn} !text-rose-300`}>
                REMOVE
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default LetterBanner;
