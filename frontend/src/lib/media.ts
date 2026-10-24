import { supabase } from './supabase';
import charactersImg from '../assets/characters.png';

// Images bundled with the site that docs can point at as "asset:<name>"
const ASSETS: Record<string, string> = { characters: charactersImg };

// Uploads share the private bucket created in 0004. Letter images live under letters/,
// and 0006 only lets the reader see those once the letter that uses them is opened.
export const MEDIA_BUCKET = 'intro-media';

const SIGNED_URL_TTL = 60 * 60; // seconds
const REUSE_FOR = (SIGNED_URL_TTL - 5 * 60) * 1000; // hand out the same link until it's nearly expired
const MAX_SIDE = 1600;
const MAX_GIF_BYTES = 8 * 1024 * 1024;

/** "storage:<path>" -> a short-lived signed URL; anything else is already a URL. */
export async function resolveMedia(src: string): Promise<string> {
  if (src.startsWith('asset:')) return ASSETS[src.slice('asset:'.length)] ?? src;
  if (!src.startsWith('storage:')) return src;
  const path = src.slice('storage:'.length);
  if (import.meta.env.VITE_DEMO === '1') {
    const { demoMediaUrl } = await import('../demo/fakeFetch');
    return demoMediaUrl(path) ?? src;
  }
  return signedUrl(path);
}

// Same image, same link: a fresh signed URL each time would be a new address, so the
// browser would download the image again. Kept for the tab's session (survives reloads).
const signed = new Map<string, Promise<string>>();
const CACHE_KEY = 'signed-media-v1';

function readCache(): Record<string, { url: string; until: number }> {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function signedUrl(path: string): Promise<string> {
  const saved = readCache()[path];
  if (saved && saved.until > Date.now()) return Promise.resolve(saved.url);
  if (!signed.has(path)) {
    const p = supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL)
      .then(({ data, error }) => {
        signed.delete(path); // the session cache holds it from here
        if (error) throw error;
        try {
          const cache = readCache();
          const now = Date.now();
          for (const k of Object.keys(cache)) if (cache[k].until <= now) delete cache[k];
          cache[path] = { url: data.signedUrl, until: now + REUSE_FOR };
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch {
          // storage full or blocked: we just sign again next time
        }
        return data.signedUrl;
      });
    signed.set(path, p.catch((err) => {
      signed.delete(path);
      throw err;
    }));
  }
  return signed.get(path)!;
}

/** Shrink a phone photo before it leaves the device (GIFs are kept as-is so they still move). */
async function shrink(file: File): Promise<Blob> {
  if (file.type === 'image/gif') {
    if (file.size > MAX_GIF_BYTES) throw new Error('that GIF is too big (max 8 MB)');
    return file;
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not read that image'))), 'image/webp', 0.85)
  );
}

/** Upload an image and return the "storage:<path>" reference to keep in the doc. */
export async function uploadMedia(file: File, folder: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('only images for now');
  const blob = await shrink(file);
  const ext = blob.type === 'image/gif' ? 'gif' : 'webp';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000', // every upload gets a new name, so it never changes
  });
  if (error) throw error;
  return `storage:${path}`;
}
