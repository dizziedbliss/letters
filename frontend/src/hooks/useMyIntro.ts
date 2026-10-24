import { useEffect, useState } from 'react';
import { myIntro, myName, type Intro } from '../utils/api';

/**
 * My personal intro page. Falls back to a placeholder (with my display name)
 * until the other person writes it. `ready` is false while loading, so pages
 * can hold the text back instead of flashing the placeholder.
 */
export function useMyIntro() {
  const [intro, setIntro] = useState<Intro | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([myIntro(), myName()])
      .then(([mine, name]) => {
        if (cancelled) return;
        setIntro(
          mine ?? {
            nickname: name ?? 'you',
            intro: "nothing here yet... someone hasn't written your intro page hehe",
            aside: 'go poke them about it :3',
            note: '',
          }
        );
      })
      .catch(() => {})
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return { intro, ready };
}

/** Split on blank lines, so the editor can write multiple paragraphs. */
export const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
