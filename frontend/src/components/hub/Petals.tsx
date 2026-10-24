import React, { useEffect, useRef } from 'react';

const COLORS = ['rgba(97,0,216,0.55)', 'rgba(0,216,255,0.55)', 'rgba(97,0,216,0.25)', 'rgba(17,17,20,0.22)'];

interface Petal {
  x: number;
  y: number;
  size: number;
  fall: number; // px/s
  sway: number;
  phase: number;
  rot: number;
  spin: number;
  color: string;
}

/** A light drifting-petal layer. ~30 tiny shapes on one canvas, so it stays cheap on phones. */
export const Petals: React.FC<{ count?: number }> = ({ count = 30 }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d')!;
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();

    const make = (): Petal => ({
      x: Math.random() * w,
      y: Math.random() * h,
      size: 4 + Math.random() * 7,
      fall: 14 + Math.random() * 26,
      sway: 10 + Math.random() * 24,
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.6,
      color: COLORS[(Math.random() * COLORS.length) | 0],
    });

    let petals: Petal[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      petals = Array.from({ length: count }, make);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const p of petals) {
        p.y += p.fall * dt;
        p.phase += dt;
        p.rot += p.spin * dt;
        if (p.y - p.size > h) {
          p.y = -p.size;
          p.x = Math.random() * w;
        }
        const x = p.x + Math.sin(p.phase) * p.sway;
        ctx.save();
        ctx.translate(x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(Math.cos(p.phase * 1.7), 1); // flutter
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.quadraticCurveTo(p.size * 0.8, 0, 0, p.size);
        ctx.quadraticCurveTo(-p.size * 0.8, 0, 0, -p.size);
        ctx.fill();
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [count]);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none" />;
};

export default Petals;
