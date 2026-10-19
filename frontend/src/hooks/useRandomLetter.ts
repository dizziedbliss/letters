import { useCallback, useRef, useState } from 'react';
import { ApiError, readerApi, type Letter } from '../utils/api';

export type ShuffleStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

/**
 * Shuffle through letters one at a time. `next()` fetches a random letter
 * (never the same one twice in a row, when there's more than one).
 */
export function useRandomLetter() {
  const [letter, setLetter] = useState<Letter | null>(null);
  const [status, setStatus] = useState<ShuffleStatus>('idle');
  const currentId = useRef<number | undefined>(undefined);

  const next = useCallback(async () => {
    setStatus('loading');
    try {
      let picked: Letter;
      try {
        picked = await readerApi.random(currentId.current);
      } catch (err) {
        // Only one letter exists, so "anything but the current one" has no answer
        if (!(err instanceof ApiError && err.status === 404 && currentId.current)) throw err;
        picked = await readerApi.random();
      }
      currentId.current = picked.id;
      setLetter(picked);
      setStatus('ready');
    } catch (err) {
      setStatus(err instanceof ApiError && err.status === 404 ? 'empty' : 'error');
    }
  }, []);

  return { letter, status, next };
}
