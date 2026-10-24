import React, { useEffect, useRef } from 'react';
import {
  TILE_SIZE,
  BORDER_COLOR,
  ACTIVE_RGB,
  INACTIVE_COLOR,
  PAPER_RGB,
  GLOW_ACTIVE_RGB,
  GLOW_INACTIVE_RGB,
  generateDefaultHighlights,
} from './gridConfig';

const GLOW_MS = 550;

// Exponential smoothing time constants (seconds)
const TAU_FILL = 0.08;
const TAU_GLOW = 0.12;
const TAU_HOVER = 0.1;
const TAU_PRESS = 0.04;

const approach = (value: number, target: number, dt: number, tau: number) =>
  value + (target - value) * (1 - Math.exp(-dt / tau));

/**
 * Canvas-rendered tile grid. A single <canvas> replaces ~1.5k DOM buttons:
 * state lives in typed arrays and only tiles being animated are stepped,
 * with the rAF loop sleeping whenever everything is at rest.
 */
export const TileGridBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;

    let cols = 0;
    let rows = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    let target = new Uint8Array(0); // 1 = purple
    let fill = new Float32Array(0);
    let glow = new Float32Array(0);
    let hover = new Float32Array(0);
    let press = new Float32Array(0);
    let glowUntil = new Float64Array(0);
    const live = new Set<number>(); // tiles currently animating

    let hoverIdx = -1;
    let pressIdx = -1;
    let raf = 0;
    let last = 0;

    const indexAt = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const c = Math.floor(((clientX - rect.left) / rect.width) * cols);
      const r = Math.floor(((clientY - rect.top) / rect.height) * rows);
      if (c < 0 || r < 0 || c >= cols || r >= rows) return -1;
      return r * cols + c;
    };

    const tileColor = (i: number) => {
      const f = fill[i];
      const h = hover[i];
      let R = PAPER_RGB[0] + (ACTIVE_RGB[0] - PAPER_RGB[0]) * f;
      let G = PAPER_RGB[1] + (ACTIVE_RGB[1] - PAPER_RGB[1]) * f;
      let B = PAPER_RGB[2] + (ACTIVE_RGB[2] - PAPER_RGB[2]) * f;
      // hover: inactive tiles get a faint purple wash, active tiles brighten
      const wash = 0.15 * h * (1 - f);
      R += (ACTIVE_RGB[0] - R) * wash;
      G += (ACTIVE_RGB[1] - G) * wash;
      B += (ACTIVE_RGB[2] - B) * wash;
      const bright = 1 + 0.1 * h * f;
      return `rgb(${Math.min(255, R * bright) | 0},${Math.min(255, G * bright) | 0},${Math.min(255, B * bright) | 0})`;
    };

    const draw = () => {
      const cw = width / cols;
      const ch = height / rows;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = INACTIVE_COLOR;
      ctx.fillRect(0, 0, width, height);

      // Base pass: all tiles at rest scale, batched by identical colour
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const f = fill[i];
          if (f < 0.002 && hover[i] < 0.002) continue; // already white
          ctx.fillStyle = tileColor(i);
          ctx.fillRect(c * cw, r * ch, cw, ch);
        }
      }

      // Borders: one path, one stroke
      ctx.strokeStyle = BORDER_COLOR;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.rect(c * cw + 0.25, r * ch + 0.25, cw - 0.5, ch - 0.5);
        }
      }
      ctx.stroke();

      // Overlay pass: tiles that are scaled / glowing draw on top of neighbours
      live.forEach((i) => {
        const g = glow[i];
        const scale = (1 + 0.12 * g) * (1 - 0.1 * press[i]);
        if (g < 0.01 && Math.abs(scale - 1) < 0.002) return;

        const c = i % cols;
        const r = (i / cols) | 0;
        const cx = c * cw + cw / 2;
        const cy = r * ch + ch / 2;
        const w = cw * scale;
        const h = ch * scale;
        const rgb = target[i] ? GLOW_ACTIVE_RGB : GLOW_INACTIVE_RGB;

        ctx.save();
        if (scale < 1) {
          ctx.fillStyle = INACTIVE_COLOR;
          ctx.fillRect(c * cw, r * ch, cw, ch);
        }
        if (g > 0.01) {
          ctx.shadowColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(target[i] ? 0.85 : 0.75) * g})`;
          ctx.shadowBlur = 16 * dpr * g;
        }
        ctx.fillStyle = tileColor(i);
        ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = BORDER_COLOR;
        ctx.strokeRect(cx - w / 2 + 0.25, cy - h / 2 + 0.25, w - 0.5, h - 0.5);
        ctx.restore();
      });
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let busy = false;

      live.forEach((i) => {
        const glowT = now < glowUntil[i] ? 1 : 0;
        const hoverT = hoverIdx === i ? 1 : 0;
        const pressT = pressIdx === i ? 1 : 0;

        fill[i] = approach(fill[i], target[i], dt, TAU_FILL);
        glow[i] = approach(glow[i], glowT, dt, TAU_GLOW);
        hover[i] = approach(hover[i], hoverT, dt, TAU_HOVER);
        press[i] = approach(press[i], pressT, dt, TAU_PRESS);

        const settled =
          Math.abs(fill[i] - target[i]) < 0.002 &&
          Math.abs(glow[i] - glowT) < 0.002 &&
          Math.abs(hover[i] - hoverT) < 0.002 &&
          Math.abs(press[i] - pressT) < 0.002;

        if (settled) {
          fill[i] = target[i];
          glow[i] = glowT;
          hover[i] = hoverT;
          press[i] = pressT;
          live.delete(i);
        } else {
          busy = true;
        }
      });

      draw();
      raf = busy ? requestAnimationFrame(tick) : 0;
    };

    const kick = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const build = (force: boolean) => {
      const rect = canvas.getBoundingClientRect();
      const newCols = Math.max(10, Math.ceil(rect.width / TILE_SIZE));
      const newRows = Math.max(8, Math.ceil(rect.height / TILE_SIZE));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      if (force || newCols !== cols || newRows !== rows) {
        cols = newCols;
        rows = newRows;
        const n = cols * rows;
        target = new Uint8Array(n);
        generateDefaultHighlights(rows, cols).forEach((key) => {
          const [r, c] = key.split(',').map(Number);
          target[r * cols + c] = 1;
        });
        fill = Float32Array.from(target);
        glow = new Float32Array(n);
        hover = new Float32Array(n);
        press = new Float32Array(n);
        glowUntil = new Float64Array(n);
        live.clear();
        hoverIdx = -1;
        pressIdx = -1;
      }
      draw();
    };

    build(true);

    // Coalesce resize bursts into one rebuild per frame
    let resizeRaf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => build(false));
    });
    ro.observe(canvas);

    const setHover = (next: number) => {
      if (next === hoverIdx) return;
      if (hoverIdx >= 0) live.add(hoverIdx);
      hoverIdx = next;
      if (next >= 0) live.add(next);
      kick();
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      setHover(indexAt(e.clientX, e.clientY));
    };
    const onLeave = () => {
      setHover(-1);
      if (pressIdx >= 0) {
        live.add(pressIdx);
        pressIdx = -1;
        kick();
      }
    };
    const onDown = (e: PointerEvent) => {
      pressIdx = indexAt(e.clientX, e.clientY);
      if (pressIdx >= 0) {
        live.add(pressIdx);
        kick();
      }
    };
    const onUp = () => {
      if (pressIdx >= 0) {
        live.add(pressIdx);
        pressIdx = -1;
        kick();
      }
    };
    const onClick = (e: MouseEvent) => {
      const i = indexAt(e.clientX, e.clientY);
      if (i < 0) return;
      target[i] = target[i] ? 0 : 1;
      glowUntil[i] = performance.now() + GLOW_MS;
      live.add(i);
      kick();
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('click', onClick);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full cursor-pointer touch-manipulation select-none"
    />
  );
};

export default TileGridBackground;
