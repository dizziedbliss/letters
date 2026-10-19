import { useCallback, useRef, useState } from 'react';
import { ApiError, readerApi, type Letter } from '../utils/api';

export type ShuffleStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

const SEEN_KEY = 'letters_seen';

const loadSeen = (): number[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
};

const saveSeen = (ids: number[]) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    // private mode etc: she just might see a repeat after reloading
  }
};

/**
 * Shuffle through letters one at a time, each only once. Read letters are
 * remembered in this browser, so letters added later show up as "more".
 * `status === 'empty'` means she's read everything so far.
 */
export function useRandomLetter() {
  const [letter, setLetter] = useState<Letter | null>(null);
  const [status, setStatus] = useState<ShuffleStatus>('idle');
  const seen = useRef<number[]>(loadSeen());

  const next = useCallback(async () => {
    setStatus('loading');
    try {
      const picked = await readerApi.random(seen.current);
      seen.current = [...seen.current, picked.id];
      saveSeen(seen.current);
      setLetter(picked);
      setStatus('ready');
    } catch (err) {
      setStatus(err instanceof ApiError && err.status === 404 ? 'empty' : 'error');
    }
  }, []);

  return { letter, status, next };
}
