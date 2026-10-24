// The intro page as data: one JSON doc per person, built by the other person.
// Rendered at a fixed design width and scaled to the screen, so what the builder
// sees is exactly what the reader sees, sticker positions included.
//
// v2 (current): BlockNote content (same editor as the letters) + stickers + background.
// v1 (stage B builder): our own block list. parseDoc() converts it on load.

export const DESIGN_WIDTH = 420;
export const MAX_SCALE = 1.2; // laptops get a bigger page, not a different layout
const PAD_X = 24; // the frame's horizontal padding (px-6)
const CONTENT_WIDTH = DESIGN_WIDTH - PAD_X * 2;

export const newId = () => crypto.randomUUID();

export type Align = 'left' | 'center' | 'right';

export interface Sticker {
  id: string;
  kind: 'image' | 'emoji' | 'doodle'; // only 'image' is offered now; the others may exist in old pages
  value: string; // an image src ("storage:", "asset:", or a URL like a KLIPY sticker)
  x: number; // design px from the left
  y: number; // design px from the top
  width: number; // design px
  rotation: number; // degrees
  z: number; // order among stickers (newest on top)
}

/** Optional header image across the top of the page. */
export interface Banner {
  src: string; // "storage:", "asset:", or a URL (a KLIPY GIF works too)
  height: 'sm' | 'md' | 'lg';
  focus: number; // 0-100: which part of the image stays in view (vertical)
}

export const BANNER_PX = { sm: 120, md: 170, lg: 230 } as const;

export type Background =
  | { kind: 'preset'; value: 'dark' | 'paper' | 'purple' }
  | { kind: 'color'; value: string }
  | { kind: 'image'; value: string };

/** BlockNote block JSON (kept loose here; the editor validates it). */
export type ContentBlock = { type: string; props?: Record<string, unknown>; content?: unknown; children?: unknown[] };

export interface IntroDoc {
  version: 2;
  background: Background;
  banner?: Banner | null;
  content: ContentBlock[];
  stickers: Sticker[];
}

// ---- helpers ------------------------------------------------------------------

const text = (t: string, styles: Record<string, unknown> = {}) => ({ type: 'text', text: t, styles });

export const lettersButtonBlock = (props: Partial<{ label: string; color: string; align: Align }> = {}): ContentBlock => ({
  type: 'lettersButton',
  props: { label: 'This :3', color: 'cyan', align: 'left', ...props },
});

/** Stickers always sit above the text (which is at CONTENT_Z). */
export const stickerZ = (s: Sticker) => 10 + s.z;
export const CONTENT_Z = 5;

/** Lowest point any sticker reaches, so the frame is tall enough to show it. */
export const stickersBottom = (doc: IntroDoc) => Math.max(0, ...doc.stickers.map((s) => s.y + s.width * 1.2));

/** The letters button is always on the page: put it back at the end if it's missing. */
export function ensureLettersButton(content: ContentBlock[]): ContentBlock[] {
  return content.some((b) => b.type === 'lettersButton') ? content : [...content, lettersButtonBlock()];
}

const paragraphs = (t: string) =>
  t
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

// ---- v1 -> v2 -------------------------------------------------------------------

type V1Block = { id: string; type: string; props: Record<string, unknown> };

const V1_HEADING_PX = { lg: '38px', xl: '48px' } as const;
const V1_TEXT_PX = { sm: '16px', md: null, lg: '22px' } as const; // md is the editor's base size

function convertV1Block(b: V1Block): ContentBlock[] {
  const p = b.props;
  const align = (p.align as Align) ?? 'left';
  const ink = p.color ? { ink: p.color } : {};
  switch (b.type) {
    case 'heading': {
      const size = V1_HEADING_PX[(p.size as 'lg' | 'xl') ?? 'lg'];
      const runs = [];
      if (p.text) runs.push(text(String(p.text), { font: '"Outfit", sans-serif', size, bold: true, ...ink }));
      if (p.accent) runs.push(text(String(p.accent), { font: '"Cardo", serif', size, italic: true, ...ink }));
      return [{ type: 'paragraph', props: { textAlignment: align }, content: runs }];
    }
    case 'text': {
      const size = V1_TEXT_PX[(p.size as 'sm' | 'md' | 'lg') ?? 'md'];
      const styles = { ...(size ? { size } : {}), ...(p.italic ? { italic: true } : {}), ...ink };
      return paragraphs(String(p.text ?? '')).map((para) => ({
        type: 'paragraph',
        props: { textAlignment: align },
        content: [text(para, styles)],
      }));
    }
    case 'image':
      if (!p.src) return [];
      return [
        {
          type: 'image',
          props: {
            url: p.src,
            previewWidth: Math.round(Math.min(1, Math.max(0.15, Number(p.width ?? 1))) * CONTENT_WIDTH),
            textAlignment: (p.align as Align) ?? 'center',
          },
        },
      ];
    case 'embed':
      if (!p.url) return [];
      return [{ type: 'paragraph', content: [{ type: 'link', href: String(p.url), content: [text(String(p.url))] }] }];
    case 'button':
      return [lettersButtonBlock({ label: String(p.label ?? 'This :3'), color: String(p.color ?? 'cyan'), align })];
    default:
      return [];
  }
}

/**
 * Accept whatever came out of the database and return a v2 doc that's safe to render,
 * converting v1 pages and putting the letters button back if it's missing.
 */
export function parseDoc(raw: unknown): IntroDoc | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const background = (d.background as Background) ?? { kind: 'preset', value: 'dark' };
  const stickers = Array.isArray(d.stickers) ? (d.stickers as Sticker[]) : [];

  if (d.version === 2 && Array.isArray(d.content)) {
    const banner = d.banner && typeof d.banner === 'object' && (d.banner as Banner).src ? (d.banner as Banner) : null;
    return { version: 2, background, banner, stickers, content: ensureLettersButton(d.content as ContentBlock[]) };
  }
  if (d.version === 1 && Array.isArray(d.blocks)) {
    const content = (d.blocks as V1Block[]).filter((b) => b && b.props).flatMap(convertV1Block);
    return { version: 2, background, stickers, content: ensureLettersButton(content) };
  }
  return null;
}

/** Shown until the other person publishes your page. */
export const placeholderDoc = (name: string | null): IntroDoc => ({
  version: 2,
  background: { kind: 'preset', value: 'dark' },
  stickers: [],
  content: [
    {
      type: 'paragraph',
      content: [
        text('Hello, ', { font: '"Outfit", sans-serif', size: '38px', bold: true }),
        text(name ?? 'you', { font: '"Cardo", serif', size: '38px', italic: true }),
      ],
    },
    { type: 'paragraph', content: [text("nothing here yet... someone hasn't built your intro page hehe")] },
    { type: 'paragraph', content: [text('go poke them about it :3', { size: '16px' })] },
    lettersButtonBlock(),
  ],
});

/** Where a brand-new build starts. */
export const starterDoc = (name: string | null): IntroDoc => ({
  version: 2,
  background: { kind: 'preset', value: 'dark' },
  stickers: [],
  content: [
    {
      type: 'paragraph',
      content: [
        text('Hello, ', { font: '"Outfit", sans-serif', size: '38px', bold: true }),
        text(name ?? 'you', { font: '"Cardo", serif', size: '38px', italic: true }),
      ],
    },
    { type: 'paragraph', content: [text('write something sweet here :3')] },
    lettersButtonBlock(),
  ],
});

/** Text colours that read well on each background. */
export function themeFor(bg: Background): { bg: string; image?: string; ink: string; strong: string; light: boolean } {
  if (bg.kind === 'preset') {
    if (bg.value === 'paper') return { bg: '#e6e7eb', ink: '#2a2a30', strong: '#111114', light: true };
    if (bg.value === 'purple') return { bg: '#6100D8', ink: '#efe9ff', strong: '#ffffff', light: false };
    return { bg: '#151515', ink: '#e8e8e8', strong: '#ffffff', light: false };
  }
  if (bg.kind === 'image') return { bg: '#151515', image: bg.value, ink: '#f0f0f0', strong: '#ffffff', light: false };
  return isLight(bg.value)
    ? { bg: bg.value, ink: '#2a2a30', strong: '#111114', light: true }
    : { bg: bg.value, ink: '#e8e8e8', strong: '#ffffff', light: false };
}

function isLight(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}
