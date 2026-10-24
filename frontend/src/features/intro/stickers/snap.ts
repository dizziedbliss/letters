import { DESIGN_WIDTH, type Sticker } from '../doc';

export const GRID = 8;
const THRESHOLD = 6; // design px: how close counts as "magnetic"
const PAD_X = 24;

export interface Guide {
  axis: 'x' | 'y';
  pos: number;
}

type Box = { x: number; y: number; w: number; h: number };

/** Snap a moving box to guide lines (page centre/edges, other stickers), else to the grid. */
export function snapMove(box: Box, others: Box[], frameH: number): { x: number; y: number; guides: Guide[] } {
  const xTargets = [0, PAD_X, DESIGN_WIDTH / 2, DESIGN_WIDTH - PAD_X, DESIGN_WIDTH, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
  const yTargets = [0, frameH / 2, frameH, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];

  const snapAxis = (start: number, size: number, targets: number[]) => {
    let best: { delta: number; pos: number } | null = null;
    for (const edge of [start, start + size / 2, start + size]) {
      for (const t of targets) {
        const d = t - edge;
        if (Math.abs(d) <= THRESHOLD && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, pos: t };
      }
    }
    return best;
  };

  const sx = snapAxis(box.x, box.w, xTargets);
  const sy = snapAxis(box.y, box.h, yTargets);
  const guides: Guide[] = [];
  const x = sx ? box.x + sx.delta : Math.round(box.x / GRID) * GRID;
  const y = sy ? box.y + sy.delta : Math.round(box.y / GRID) * GRID;
  if (sx) guides.push({ axis: 'x', pos: sx.pos });
  if (sy) guides.push({ axis: 'y', pos: sy.pos });
  return { x, y, guides };
}

/** Rotation clicks to 15° steps when close to one. */
export const snapAngle = (deg: number) => {
  const nearest = Math.round(deg / 15) * 15;
  return Math.abs(nearest - deg) <= 5 ? nearest : Math.round(deg);
};

export const clampWidth = (w: number) => Math.min(380, Math.max(24, Math.round(w / 4) * 4));

/** Rough height for snapping: emoji and doodles are about square; images report their real height. */
export const heightOf = (s: Sticker, measured?: number) => measured ?? s.width;
