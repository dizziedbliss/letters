/** Optional header image across the top of a letter (Notion-style cover). */
export interface Banner {
  src: string; // "storage:<path>" (uploads stay locked with the letter) or a URL (a KLIPY GIF works too)
  height: 'sm' | 'md' | 'lg';
  focus: number; // 0-100: which part of the image stays in view (vertical)
}

export const BANNER_PX = { sm: 140, md: 200, lg: 280 } as const;

import type { Background, Sticker } from '../intro/doc';

/** A letter's own page look: background + stickers (same pieces as the landing page). */
export interface LetterLook {
  background: Background;
  stickers: Sticker[];
}

export const DEFAULT_LOOK: LetterLook = { background: { kind: 'preset', value: 'dark' }, stickers: [] };
