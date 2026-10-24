import React, { useEffect, useImperativeHandle, useRef } from 'react';
import {
  TILE_SIZE,
  BORDER_COLOR,
  INACTIVE_COLOR,
  PAPER_RGB,
  GLOW_INACTIVE_RGB,
  PALETTE,
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

/** One tile of the shared drawing, counted from the centre tile (0,0). c: 0 = empty, else a PALETTE index. */
export interface Cell {
  x: number;
  y: number;
  c: number;
}

export interface GridHandle {
  /** Replace the whole drawing (what's saved). */
  load(cells: Cell[]): void;
  /** Someone else's strokes: paint them with a little glow. */
  apply(cells: Cell[]): void;
  /** Where a cell is on screen, or null when it's off this screen. */
  cellRect(x: number, y: number): { left: number; top: number; width: number; height: number } | null;
}

export interface DrawOptions {
  tool: number; // a PALETTE index; 0 = eraser
  onPaint: (cells: Cell[]) => void;
  onCursor: (x: number, y: number) => void;
}

interface TileGridBackgroundProps {
  ref?: React.Ref<GridHandle>;
  /** Logged in: draw on the shared grid. Absent: the tap-to-toggle toy (nothing saved). */
  draw?: DrawOptions | null;
}

type Engine = GridHandle & { setShared(on: boolean): void };

/**
 * Canvas-rendered tile grid. A single <canvas> replaces ~1.5k DOM buttons:
 * state lives in typed arrays and only tiles being animated are stepped,
 * with the rAF loop sleeping whenever everything is at rest.
 */
export const TileGridBackground: React.FC<TileGridBackgroundProps> = ({ ref, draw }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const drawRef = useRef(draw);
  const shared = !!draw;

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useImperativeHandle(
    ref,
    () => ({
      load: (cells) => engineRef.current?.load(cells),
      apply: (cells) => engineRef.current?.apply(cells),
      cellRect: (x, y) => engineRef.current?.cellRect(x, y) ?? null,
    }),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;

    let cols = 0;
    let rows = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    let target: Uint8Array = new Uint8Array(0); // 1 = filled
    let color: Uint8Array = new Uint8Array(0); // which PALETTE colour a filled tile shows
    let fill = new Float32Array(0);
    let glow = new Float32Array(0);
    let hover = new Float32Array(0);
    let press = new Float32Array(0);
    let glowUntil = new Float64Array(0);
    const live = new Set<number>(); // tiles currently animating

    // Shared mode: the drawing, by "x,y" from the centre tile. It outlives resizes.
    let sharedMode = false;
    const world = new Map<string, number>();
    let stroke: { c: number; last: number } | null = null;
    let lastCursor = -1;

    let hoverIdx = -1;
    let pressIdx = -1;
    let raf = 0;
    let last = 0;

    const key = (x: number, y: number) => `${x},${y}`;
    const midC = () => Math.floor(cols / 2);
    const midR = () => Math.floor(rows / 2);
    const toWorld = (i: number) => ({ x: (i % cols) - midC(), y: ((i / cols) | 0) - midR() });
    const toIndex = (x: number, y: number) => {
      const c = x + midC();
      const r = y + midR();
      return c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c;
    };

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
      const on = PALETTE[color[i] || 1].rgb;
      let R = PAPER_RGB[0] + (on[0] - PAPER_RGB[0]) * f;
      let G = PAPER_RGB[1] + (on[1] - PAPER_RGB[1]) * f;
      let B = PAPER_RGB[2] + (on[2] - PAPER_RGB[2]) * f;
      // hover: empty tiles get a faint wash of the colour you'd paint, filled tiles brighten
      const tool = drawRef.current?.tool;
      const washRgb = PALETTE[sharedMode ? tool || 4 : 1].rgb;
      const wash = 0.15 * h * (1 - f);
      R += (washRgb[0] - R) * wash;
      G += (washRgb[1] - G) * wash;
      B += (washRgb[2] - B) * wash;
      const bright = 1 + 0.1 * h * f;
      return `rgb(${Math.min(255, R * bright) | 0},${Math.min(255, G * bright) | 0},${Math.min(255, B * bright) | 0})`;
    };

    const draw = () => {
      const cw = width / cols;
      const ch = height / rows;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = INACTIVE_COLOR;
      ctx.fillRect(0, 0, width, height);

      // Base pass: all tiles at rest scale
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          if (fill[i] < 0.002 && hover[i] < 0.002) continue; // already paper
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
        const rgb = target[i] ? PALETTE[color[i] || 1].rgb : GLOW_INACTIVE_RGB;

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

    /** Point tile i at colour c (0 = empty); it animates there. */
    const setTile = (i: number, c: number, withGlow: boolean) => {
      if (c) color[i] = c; // when emptying, keep the old colour so it fades out in it
      target[i] = c ? 1 : 0;
      if (withGlow) glowUntil[i] = performance.now() + GLOW_MS;
      live.add(i);
    };

    /** What each tile should show right now: the saved drawing, or the decorative pattern. */
    const wanted = (): Uint8Array => {
      const want = new Uint8Array(cols * rows);
      if (sharedMode) {
        world.forEach((c, k) => {
          const [x, y] = k.split(',').map(Number);
          const i = toIndex(x, y);
          if (i >= 0) want[i] = c;
        });
      } else {
        generateDefaultHighlights(rows, cols).forEach((k) => {
          const [r, c] = k.split(',').map(Number);
          want[r * cols + c] = 1;
        });
      }
      return want;
    };

    /** Move every tile to what it should show, animated (mode switch, a fresh load). */
    const reproject = () => {
      const want = wanted();
      for (let i = 0; i < want.length; i++) {
        const now = target[i] ? color[i] || 1 : 0;
        if (now !== want[i]) setTile(i, want[i], false);
      }
      kick();
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
        color = wanted(); // sized for the new grid
        target = color.map((c) => (c ? 1 : 0));
        fill = Float32Array.from(target);
        glow = new Float32Array(n);
        hover = new Float32Array(n);
        press = new Float32Array(n);
        glowUntil = new Float64Array(n);
        live.clear();
        hoverIdx = -1;
        pressIdx = -1;
        stroke = null;
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

    // ---- shared drawing -------------------------------------------------------------

    const paint = (i: number, c: number, out: Cell[]) => {
      const { x, y } = toWorld(i);
      const k = key(x, y);
      if ((world.get(k) ?? 0) === c) return;
      if (c) world.set(k, c);
      else world.delete(k);
      setTile(i, c, true);
      out.push({ x, y, c });
    };

    // Every tile on the straight line between two tiles, so a fast swipe leaves no gaps
    const between = (a: number, b: number) => {
      let c0 = a % cols;
      let r0 = (a / cols) | 0;
      const c1 = b % cols;
      const r1 = (b / cols) | 0;
      const dc = Math.abs(c1 - c0);
      const dr = -Math.abs(r1 - r0);
      const sc = c0 < c1 ? 1 : -1;
      const sr = r0 < r1 ? 1 : -1;
      let err = dc + dr;
      const out: number[] = [];
      for (;;) {
        out.push(r0 * cols + c0);
        if (c0 === c1 && r0 === r1) return out;
        const e2 = 2 * err;
        if (e2 >= dr) {
          err += dr;
          c0 += sc;
        }
        if (e2 <= dc) {
          err += dc;
          r0 += sr;
        }
      }
    };

    const reportCursor = (i: number) => {
      if (i < 0 || i === lastCursor) return;
      lastCursor = i;
      const { x, y } = toWorld(i);
      drawRef.current?.onCursor(x, y);
    };

    engineRef.current = {
      load(cells) {
        world.clear();
        cells.forEach((cell) => cell.c && world.set(key(cell.x, cell.y), cell.c));
        if (sharedMode) reproject();
      },
      apply(cells) {
        cells.forEach((cell) => {
          if (cell.c) world.set(key(cell.x, cell.y), cell.c);
          else world.delete(key(cell.x, cell.y));
          const i = toIndex(cell.x, cell.y);
          if (sharedMode && i >= 0) setTile(i, cell.c, true);
        });
        kick();
      },
      cellRect(x, y) {
        const i = toIndex(x, y);
        if (i < 0) return null;
        const rect = canvas.getBoundingClientRect();
        const cw = rect.width / cols;
        const ch = rect.height / rows;
        return { left: rect.left + (i % cols) * cw, top: rect.top + ((i / cols) | 0) * ch, width: cw, height: ch };
      },
      setShared(on) {
        if (on === sharedMode) return;
        sharedMode = on;
        stroke = null;
        canvas.style.touchAction = on ? 'none' : ''; // dragging paints instead of scrolling
        reproject();
      },
    };

    // ---- pointer ------------------------------------------------------------------------

    const setHover = (next: number) => {
      if (next === hoverIdx) return;
      if (hoverIdx >= 0) live.add(hoverIdx);
      hoverIdx = next;
      if (next >= 0) live.add(next);
      kick();
    };

    const onMove = (e: PointerEvent) => {
      const i = indexAt(e.clientX, e.clientY);
      if (e.pointerType !== 'touch') setHover(i);
      if (!sharedMode) return;
      reportCursor(i);
      if (stroke && i >= 0 && i !== stroke.last) {
        const out: Cell[] = [];
        between(stroke.last, i).forEach((j) => paint(j, stroke!.c, out));
        stroke.last = i;
        if (out.length) drawRef.current?.onPaint(out);
        kick();
      }
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
      if (pressIdx < 0) return;
      live.add(pressIdx);
      const d = drawRef.current;
      if (sharedMode && d) {
        canvas.setPointerCapture(e.pointerId);
        // Starting on a tile that's already your colour erases instead, like tapping it off
        const { x, y } = toWorld(pressIdx);
        const c = d.tool && world.get(key(x, y)) === d.tool ? 0 : d.tool;
        stroke = { c, last: pressIdx };
        const out: Cell[] = [];
        paint(pressIdx, c, out);
        if (out.length) d.onPaint(out);
        lastCursor = -1;
        reportCursor(pressIdx);
      }
      kick();
    };
    const onUp = (e: PointerEvent) => {
      stroke = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (pressIdx >= 0) {
        live.add(pressIdx);
        pressIdx = -1;
        kick();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (sharedMode) return; // painting already happened on pointerdown
      const i = indexAt(e.clientX, e.clientY);
      if (i < 0) return;
      setTile(i, target[i] ? 0 : 1, true);
      kick();
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('click', onClick);

    return () => {
      engineRef.current = null;
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

  useEffect(() => {
    engineRef.current?.setShared(shared);
  }, [shared]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full cursor-pointer touch-manipulation select-none"
    />
  );
};

export default TileGridBackground;
