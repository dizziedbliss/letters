import { useEffect, useRef, useState } from 'react';
import { DESIGN_WIDTH } from './doc';

/**
 * Fit a DESIGN_WIDTH-wide frame into its container: returns the scale, the
 * horizontal offset that centres it, and the scaled height the container needs.
 */
export function useDesignScale(maxScale: number, ready = true) {
  const outerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: 0, offset: 0 });

  useEffect(() => {
    const outer = outerRef.current;
    const frame = frameRef.current;
    // pages that show a loading state first pass ready=false until the frame is rendered
    if (!ready || !outer || !frame) return;
    const measure = () => {
      const scale = Math.min(outer.clientWidth / DESIGN_WIDTH, maxScale);
      setBox({
        scale,
        height: frame.offsetHeight * scale, // offsetHeight ignores the transform
        offset: (outer.clientWidth - DESIGN_WIDTH * scale) / 2,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [maxScale, ready]);

  const frameStyle = {
    width: DESIGN_WIDTH,
    transform: `translateX(${box.offset}px) scale(${box.scale})`,
    transformOrigin: 'top left',
  } as const;

  return { outerRef, frameRef, box, frameStyle };
}
