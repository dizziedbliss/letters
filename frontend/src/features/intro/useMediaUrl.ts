import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import charactersImg from '../../assets/characters.png';

// Bundled images the starter page can point at
const ASSETS: Record<string, string> = { characters: charactersImg };

const SIGNED_URL_TTL = 60 * 60; // seconds

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
    supabase.storage
      .from('intro-media')
      .createSignedUrl(src.slice(8), SIGNED_URL_TTL)
      .then(({ data }) => {
        if (!cancelled) setSigned({ src, url: data?.signedUrl ?? null });
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return direct ?? (signed && signed.src === src ? signed.url : null);
}
