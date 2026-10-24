import { useEffect, useState } from 'react';
import { resolveMedia } from '../../lib/media';

/** Resolve an image `src` ("storage:", "asset:" or a URL) to something an <img> can load. */
export function useMediaUrl(src: string | undefined) {
  const direct = src && /^(https?:|data:|blob:|\/)/.test(src) ? src : null;
  const [resolved, setResolved] = useState<{ src: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!src || direct) return;
    let cancelled = false;
    resolveMedia(src)
      .then((url) => !cancelled && setResolved({ src, url }))
      .catch(() => !cancelled && setResolved({ src, url: null }));
    return () => {
      cancelled = true;
    };
  }, [src, direct]);

  return direct ?? (resolved && resolved.src === src ? resolved.url : null);
}
