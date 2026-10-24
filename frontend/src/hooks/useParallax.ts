import { useEffect, type RefObject } from 'react';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Drives `--px` / `--py` (each -1..1, eased) on the element. Layers read them in CSS
 * (`translate3d(calc(var(--px) * depth * 1px), ...)`), so React never re-renders on move.
 * Mouse on desktop, device tilt on phones (Android needs no permission prompt).
 */
export function useParallax(
  ref: RefObject<HTMLElement | null>,
  onFrame?: (x: number, y: number) => void
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;
    let baseBeta: number | null = null;

    const loop = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      el.style.setProperty('--px', cx.toFixed(3));
      el.style.setProperty('--py', cy.toFixed(3));
      onFrame?.(cx, cy);
      raf = Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001 ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      kick();
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      baseBeta ??= e.beta; // however she's holding the phone is "centre"
      tx = clamp(e.gamma / 25, -1, 1);
      ty = clamp((e.beta - baseBeta) / 25, -1, 1);
      kick();
    };

    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('deviceorientation', onTilt);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, [ref, onFrame]);
}
