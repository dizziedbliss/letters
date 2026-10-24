import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Cell, GridHandle } from '../../components/background/TileGridBackground';
import { gateApi } from '../../utils/api';
import { joinRoom, type LiveRoom, type LiveStatus } from '../../lib/live';

const SAVE_MS = 400; // strokes are batched into one save
const CURSOR_MS = 60; // how often your finger position is sent
const HEARTBEAT_MS = 8000;
const GONE_MS = 20000; // no heartbeat for this long = they left
const FINGER_FADE_MS = 2500;

export interface Friend {
  name: string;
  /** Where their finger is (and that tile's spot on this screen), while it's moving */
  finger: { x: number; y: number; tool: number; rect: { left: number; top: number; width: number; height: number } | null } | null;
}

/**
 * The gate's drawing, shared: loads what's saved, sends your strokes live and saves them in
 * batches, and paints the other person's strokes and finger as they happen.
 */
export function useSharedGrid(active: boolean, grid: RefObject<GridHandle | null>, myName: string | null, tool: number) {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [friend, setFriend] = useState<Friend | null>(null);
  const room = useRef<LiveRoom | null>(null);
  const pending = useRef(new Map<string, Cell>());
  const saveTimer = useRef<number | undefined>(undefined);
  const lastCursorSent = useRef(0);
  const me = useRef({ name: myName, tool });

  useEffect(() => {
    me.current = { name: myName, tool };
  }, [myName, tool]);

  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current);
    if (!pending.current.size) return;
    const cells = [...pending.current.values()];
    pending.current.clear();
    try {
      await gateApi.paint(cells);
    } catch {
      // offline or a hiccup: put them back (unless painted over since); the heartbeat retries
      cells.forEach((c) => {
        const k = `${c.x},${c.y}`;
        if (!pending.current.has(k)) pending.current.set(k, c);
      });
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    let fingerTimer: number | undefined;
    let lastSeen = 0;

    const refetch = async () => {
      await flush();
      try {
        grid.current?.load(await gateApi.load());
      } catch {
        // keep what's on screen
      }
    };

    const seen = (name: unknown) => {
      lastSeen = Date.now();
      setFriend((f) => ({ name: String(name ?? f?.name ?? 'them'), finger: f?.finger ?? null }));
    };

    const r = joinRoom(
      'gate',
      {
        paint: (p) => grid.current?.apply(p.cells as Cell[]),
        clear: () => grid.current?.load([]),
        cursor: (p) => {
          lastSeen = Date.now();
          const x = Number(p.x);
          const y = Number(p.y);
          const rect = grid.current?.cellRect(x, y) ?? null;
          setFriend({ name: String(p.name ?? 'them'), finger: { x, y, tool: Number(p.tool), rect } });
          clearTimeout(fingerTimer);
          fingerTimer = window.setTimeout(() => setFriend((f) => (f ? { ...f, finger: null } : f)), FINGER_FADE_MS);
        },
        here: (p) => {
          seen(p.name);
          // they just arrived: say hi back so they see us straight away
          if (p.hello) room.current?.send('here', { name: me.current.name });
        },
        bye: () => setFriend(null),
      },
      (s) => {
        setStatus(s);
        if (s === 'live') {
          refetch();
          room.current?.send('here', { name: me.current.name, hello: true });
        }
      }
    );
    room.current = r;

    const heartbeat = window.setInterval(() => {
      r.send('here', { name: me.current.name });
      flush(); // also retries anything that failed to save
      if (lastSeen && Date.now() - lastSeen > GONE_MS) setFriend(null);
    }, HEARTBEAT_MS);

    // Coming back to the tab: catch up on anything missed while it slept
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch();
      else flush();
    };
    const onLeave = () => {
      r.send('bye', {});
      flush();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onLeave);

    return () => {
      onLeave();
      clearInterval(heartbeat);
      clearTimeout(fingerTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onLeave);
      r.leave();
      room.current = null;
      setFriend(null);
    };
  }, [active, grid, flush]);

  const onPaint = useCallback(
    (cells: Cell[]) => {
      cells.forEach((c) => pending.current.set(`${c.x},${c.y}`, c));
      room.current?.send('paint', { cells });
      clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(flush, SAVE_MS);
    },
    [flush]
  );

  const cursorTimer = useRef<number | undefined>(undefined);
  const onCursor = useCallback((x: number, y: number) => {
    const send = () => {
      lastCursorSent.current = performance.now();
      room.current?.send('cursor', { x, y, tool: me.current.tool, name: me.current.name });
    };
    clearTimeout(cursorTimer.current);
    const wait = CURSOR_MS - (performance.now() - lastCursorSent.current);
    if (wait <= 0) send();
    else cursorTimer.current = window.setTimeout(send, wait); // the last move always gets through
  }, []);

  const clearAll = useCallback(async () => {
    pending.current.clear();
    await gateApi.clear();
    grid.current?.load([]);
    room.current?.send('clear', {});
  }, [grid]);

  return { status, friend, onPaint, onCursor, clearAll };
}
