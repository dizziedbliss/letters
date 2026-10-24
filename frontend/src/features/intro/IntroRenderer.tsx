import React, { Suspense, lazy } from 'react';
import { CONTENT_Z, MAX_SCALE, stickersBottom, themeFor, type IntroDoc } from './doc';
import { useDesignScale } from './useDesignScale';
import { LettersButtonContext } from './introContext';
import { StickerView } from './stickers/StickerView';

// BlockNote is big: it loads with the page content, not with the hub
const IntroBody = lazy(() => import('./IntroBody'));

interface IntroRendererProps {
  doc: IntroDoc;
  onButton?: () => void;
}

/**
 * Draws an intro doc at DESIGN_WIDTH and scales it to the available width.
 * The page background is the caller's job (see `themeFor`), since it fills the screen.
 */
export const IntroRenderer: React.FC<IntroRendererProps> = ({ doc, onButton }) => {
  const { outerRef, frameRef, box, frameStyle } = useDesignScale(MAX_SCALE);
  const theme = themeFor(doc.background);

  return (
    <div ref={outerRef} className="relative w-full" style={{ height: box.height || undefined }}>
      <div ref={frameRef} className="absolute top-0 left-0 px-6 py-4" style={{ ...frameStyle, minHeight: stickersBottom(doc) }}>
        <div className="relative" style={{ zIndex: CONTENT_Z }}>
          <LettersButtonContext.Provider value={onButton}>
            <Suspense fallback={<div className="h-40" />}>
              <IntroBody content={doc.content} editable={false} ink={theme.ink} />
            </Suspense>
          </LettersButtonContext.Provider>
        </div>
        {doc.stickers.map((s) => (
          <StickerView key={s.id} sticker={s} />
        ))}
      </div>
    </div>
  );
};

export default IntroRenderer;
