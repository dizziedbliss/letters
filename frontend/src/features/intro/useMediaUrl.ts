import { useEffect, useState } from 'react';
import { resolveMedia } from '../../lib/media';
import charactersImg from '../../assets/characters.png';

// Bundled images the starter page can point at
const ASSETS: Record<string, string> = { characters: charactersImg };

/**
 * Resolve an image `src` to something an <img> can load.
 * Uploaded files live in a private bucket, so they need a short-lived signed URL.
 */
export function useMediaUrl(src: string | undefined) {
  const direct = !src ? null : src.startsWith('asset:') ? ASSETS[src.slice(6)] ?? null : src.startsWith('storage:') ? null : src;
  const [signed, setSigned] = useState<{ src: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!src?.startsWith('storage:')) return;
    let cancelled = false;
    resolveMedia(src)
      .then((url) => !cancelled && setSigned({ src, url }))
      .catch(() => !cancelled && setSigned({ src, url: null }));
    return () => {
      cancelled = true;
    };
  }, [src]);

  return direct ?? (signed && signed.src === src ? signed.url : null);
}
