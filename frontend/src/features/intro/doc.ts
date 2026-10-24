// The intro page as data: one JSON doc per person, built by the other person.
// Rendered at a fixed design width and scaled to the screen, so what the builder
// sees is exactly what the reader sees, sticker positions included.

export const DESIGN_WIDTH = 420;

export type Align = 'left' | 'center' | 'right';

export interface HeadingBlock {
  id: string;
  type: 'heading';
  /** `text` in the sans heading font, then `accent` in italic serif ("Hello, " + "Saumiiiiii"). */
  props: { text: string; accent?: string; size?: 'lg' | 'xl'; align?: Align; color?: string };
}

export interface TextBlock {
  id: string;
  type: 'text';
  /** Blank line = new paragraph. */
  props: { text: string; size?: 'sm' | 'md' | 'lg'; italic?: boolean; align?: Align; color?: string };
}

export interface ImageBlock {
  id: string;
  type: 'image';
  /** `src`: "storage:<path>" (uploaded), "asset:<name>" (bundled), or an http(s) URL (pasted GIF link). */
  props: { src: string; width?: number; align?: Align; rounded?: boolean; alt?: string };
}

export interface EmbedBlock {
  id: string;
  type: 'embed';
  props: { url: string };
}

export interface ButtonBlock {
  id: string;
  type: 'button';
  /** The way into the letters. Always present: movable and restylable, never deletable. */
  props: { label: string; color?: 'cyan' | 'purple' | 'white' | 'ink'; align?: Align };
}

export type Block = HeadingBlock | TextBlock | ImageBlock | EmbedBlock | ButtonBlock;

export interface Sticker {
  id: string;
  kind: 'emoji' | 'image';
  value: string; // the emoji, or an image src like ImageBlock
  x: number; // design px from the left
  y: number; // design px from the top
  width: number; // design px
  rotation: number; // degrees
  z: number;
}

export type Background =
  | { kind: 'preset'; value: 'dark' | 'paper' | 'purple' }
  | { kind: 'color'; value: string }
  | { kind: 'image'; value: string };

export interface IntroDoc {
  version: 1;
  background: Background;
  blocks: Block[];
  stickers: Sticker[];
  /** The letters page ("Hello, ___" + the note before the first letter), published with the doc. */
  letters?: { nickname: string; note: string };
}

// Design-px sizes, shared by the renderer and the inline editor so editing looks identical
export const HEADING_PX = { lg: 38, xl: 48 } as const;
export const TEXT_PX = { sm: 16, md: 18, lg: 22 } as const;

export const newId = () => crypto.randomUUID();

const BLOCK_TYPES = new Set(['heading', 'text', 'image', 'embed', 'button']);

export const defaultButton = (): ButtonBlock => ({
  id: 'letters-button',
  type: 'button',
  props: { label: 'This :3', color: 'cyan' },
});

/**
 * Accept whatever came out of the database and return a doc that's safe to render.
 * Unknown block types are dropped, and the letters button is put back if it's missing.
 */
export function parseDoc(raw: unknown): IntroDoc | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<IntroDoc>;
  if (d.version !== 1 || !Array.isArray(d.blocks)) return null;

  const blocks = d.blocks.filter(
    (b): b is Block => !!b && typeof b === 'object' && BLOCK_TYPES.has(b.type) && typeof b.id === 'string' && !!b.props
  );
  if (!blocks.some((b) => b.type === 'button')) blocks.push(defaultButton());

  return {
    version: 1,
    background: d.background ?? { kind: 'preset', value: 'dark' },
    blocks,
    stickers: Array.isArray(d.stickers) ? d.stickers : [],
    ...(d.letters && typeof d.letters === 'object' ? { letters: d.letters } : {}),
  };
}

/** Where a brand-new build starts. */
export const starterDoc = (name: string | null): IntroDoc => ({
  version: 1,
  background: { kind: 'preset', value: 'dark' },
  blocks: [
    { id: newId(), type: 'heading', props: { text: 'Hello, ', accent: name ?? 'you' } },
    { id: newId(), type: 'text', props: { text: 'write something sweet here :3', size: 'md' } },
    defaultButton(),
  ],
  stickers: [],
});

/** Shown until the other person publishes your page. */
export const placeholderDoc = (name: string | null): IntroDoc => ({
  version: 1,
  background: { kind: 'preset', value: 'dark' },
  blocks: [
    { id: 'greeting', type: 'heading', props: { text: 'Hello, ', accent: name ?? 'you' } },
    { id: 'empty', type: 'text', props: { text: "nothing here yet... someone hasn't built your intro page hehe", size: 'md' } },
    { id: 'poke', type: 'text', props: { text: 'go poke them about it :3', size: 'sm' } },
    defaultButton(),
  ],
  stickers: [],
});

/** Text colours that read well on each background. */
export function themeFor(bg: Background): { bg: string; image?: string; ink: string; strong: string } {
  if (bg.kind === 'preset') {
    if (bg.value === 'paper') return { bg: '#e6e7eb', ink: '#2a2a30', strong: '#111114' };
    if (bg.value === 'purple') return { bg: '#6100D8', ink: '#efe9ff', strong: '#ffffff' };
    return { bg: '#151515', ink: '#e8e8e8', strong: '#ffffff' };
  }
  if (bg.kind === 'image') return { bg: '#151515', image: bg.value, ink: '#f0f0f0', strong: '#ffffff' };
  return isLight(bg.value)
    ? { bg: bg.value, ink: '#2a2a30', strong: '#111114' }
    : { bg: bg.value, ink: '#e8e8e8', strong: '#ffffff' };
}

function isLight(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

/** YouTube / Spotify links -> embeddable player URL, or null if we don't know the site. */
export function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      const id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'open.spotify.com') {
      const m = u.pathname.match(/^\/(track|album|playlist|episode|artist)\/(\w+)/);
      return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
    }
  } catch {
    // not a URL
  }
  return null;
}
