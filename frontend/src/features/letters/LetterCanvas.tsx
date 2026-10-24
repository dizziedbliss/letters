import React from 'react';
import { CONTENT_Z, MAX_SCALE, stickersBottomOf, type Sticker } from '../intro/doc';
import { useDesignScale } from '../intro/useDesignScale';
import { StickerView } from '../intro/stickers/StickerView';

interface LetterCanvasProps {
  stickers: Sticker[];
  children: React.ReactNode;
  /** Writer side: render editable stickers instead (gets the current scale and frame height). */
  overlay?: (box: { scale: number; frameHeight: number }) => React.ReactNode;
  ready?: boolean;
}

/**
 * A letter on the same phone-shaped, scaled canvas as the landing page, so stickers
 * land in the same spot on every screen. Text sits above the background, stickers above the text.
 */
export const LetterCanvas: React.FC<LetterCanvasProps> = ({ stickers, children, overlay, ready = true }) => {
  const { outerRef, frameRef, box, frameStyle } = useDesignScale(MAX_SCALE, ready);
  return (
    <div ref={outerRef} className="relative w-full" style={{ height: box.height || undefined }}>
      <div ref={frameRef} className="absolute top-0 left-0 px-6 py-4" style={{ ...frameStyle, minHeight: stickersBottomOf(stickers) }}>
        <div className="relative" style={{ zIndex: CONTENT_Z }}>
          {children}
        </div>
        {overlay ? overlay({ scale: box.scale, frameHeight: box.height / (box.scale || 1) }) : stickers.map((s) => <StickerView key={s.id} sticker={s} />)}
      </div>
    </div>
  );
};

export default LetterCanvas;
