import { useCallback, useRef, useState } from 'react';
import type { IntroDoc } from '../doc';

const LIMIT = 60;
const COALESCE_MS = 800;

interface History {
  past: IntroDoc[];
  present: IntroDoc | null;
  future: IntroDoc[];
}

/**
 * The doc being edited, with undo/redo. Changes that share a `key` within
 * COALESCE_MS (e.g. typing in one block) collapse into a single undo step.
 */
export function useDocHistory() {
  const [h, setH] = useState<History>({ past: [], present: null, future: [] });
  const last = useRef<{ key: string; t: number } | null>(null);

  const reset = useCallback((doc: IntroDoc) => {
    last.current = null;
    setH({ past: [], present: doc, future: [] });
  }, []);

  const update = useCallback((fn: (d: IntroDoc) => IntroDoc, key?: string) => {
    // decided outside the updater: StrictMode runs updaters twice
    const now = Date.now();
    const coalesce = !!key && last.current?.key === key && now - last.current.t < COALESCE_MS;
    last.current = key ? { key, t: now } : null;
    setH((s) => {
      if (!s.present) return s;
      return {
        past: coalesce ? s.past : [...s.past, s.present].slice(-LIMIT),
        present: fn(s.present),
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    last.current = null;
    setH((s) =>
      s.past.length && s.present
        ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] }
        : s
    );
  }, []);

  const redo = useCallback(() => {
    last.current = null;
    setH((s) =>
      s.future.length && s.present
        ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) }
        : s
    );
  }, []);

  return {
    doc: h.present,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
    reset,
    update,
    undo,
    redo,
  };
}
