import { useCallback, useRef, useState } from 'react';
import { nextLetter, profileNames, type Letter } from '../utils/api';

export type ShuffleStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

/**
 * Shuffle through the other person's letters one at a time, each only once.
 * The database remembers what's been read (per account), so it follows you
 * across devices. `status === 'empty'` means you've read everything so far.
 */
export function useRandomLetter() {
  const [letter, setLetter] = useState<Letter | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [status, setStatus] = useState<ShuffleStatus>('idle');
  const names = useRef<Record<string, string> | null>(null);

  const next = useCallback(async () => {
    setStatus('loading');
    try {
      const picked = await nextLetter();
      if (!picked) {
        setStatus('empty');
        return;
      }
      names.current ??= await profileNames().catch(() => ({}));
      setAuthor((picked.authorId && names.current[picked.authorId]) || null);
      setLetter(picked);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  return { letter, author, status, next };
}
