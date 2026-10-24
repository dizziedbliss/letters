import { supabase } from './supabase';

// Uploads share the private bucket created in 0004. Letter images live under letters/,
// and 0006 only lets the reader see those once the letter that uses them is opened.
export const MEDIA_BUCKET = 'intro-media';

const SIGNED_URL_TTL = 60 * 60; // seconds
const MAX_SIDE = 1600;
const MAX_GIF_BYTES = 8 * 1024 * 1024;

/** "storage:<path>" -> a short-lived signed URL; anything else is already a URL. */
export async function resolveMedia(src: string): Promise<string> {
  if (!src.startsWith('storage:')) return src;
  const path = src.slice('storage:'.length);
  if (import.meta.env.VITE_DEMO === '1') {
    const { demoMediaUrl } = await import('../demo/fakeFetch');
    return demoMediaUrl(path) ?? src;
  }
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error) throw error;
  return data.signedUrl;
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
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: blob.type });
  if (error) throw error;
  return `storage:${path}`;
}
