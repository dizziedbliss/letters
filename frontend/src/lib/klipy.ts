// KLIPY: GIF and sticker search (Tenor's API shut down in June 2026).
// The key is a public client key; it lives in VITE_KLIPY_KEY.

const KEY = import.meta.env.VITE_KLIPY_KEY as string | undefined;
const BASE = 'https://api.klipy.com/api/v1';

export type KlipyKind = 'gifs' | 'stickers';

export interface KlipyItem {
  id: number;
  title: string;
  preview: string; // small, for the picker grid
  url: string; // what gets inserted (animated)
  width: number;
  height: number;
}

type Media = { url: string; width: number; height: number };
type RawItem = { id: number; title: string; file: Record<'hd' | 'md' | 'sm' | 'xs', Record<string, Media>> };

const pick = (sizes: Record<string, Media>, formats: string[]) => formats.map((f) => sizes[f]).find(Boolean);

export const klipyEnabled = () => !!KEY;

/** Trending when `query` is empty, search otherwise. `customerId` lets KLIPY personalise per person. */
export async function klipy(kind: KlipyKind, query: string, page: number, customerId: string): Promise<{ items: KlipyItem[]; hasNext: boolean }> {
  if (!KEY) throw new Error('add VITE_KLIPY_KEY to use the GIF picker');
  const params = new URLSearchParams({ page: String(page), per_page: '24', customer_id: customerId || 'anon' });
  if (query.trim()) params.set('q', query.trim());
  const res = await fetch(`${BASE}/${KEY}/${kind}/${query.trim() ? 'search' : 'trending'}?${params}`);
  if (!res.ok) throw new Error(`KLIPY said ${res.status}`);
  const body = (await res.json()) as { data: { data: RawItem[]; has_next: boolean } };
  const items = body.data.data
    .map((r) => {
      const preview = pick(r.file.sm ?? {}, ['webp', 'gif']) ?? pick(r.file.xs ?? {}, ['webp', 'gif']);
      // stickers keep transparency as webp/gif; md is plenty for a phone-sized page
      const full = pick(r.file.md ?? {}, ['webp', 'gif']) ?? pick(r.file.hd ?? {}, ['webp', 'gif']);
      if (!preview || !full) return null;
      return { id: r.id, title: r.title, preview: preview.url, url: full.url, width: full.width, height: full.height };
    })
    .filter((x): x is KlipyItem => !!x);
  return { items, hasNext: body.data.has_next };
}
