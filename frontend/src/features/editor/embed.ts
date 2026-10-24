/** YouTube / Spotify links -> embeddable player URL, or null if we don't know the site. */
export function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      const id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'open.spotify.com') {
      const m = u.pathname.match(/^\/(?:intl-\w+\/)?(track|album|playlist|episode|artist|show)\/(\w+)/);
      return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
    }
  } catch {
    // not a URL
  }
  return null;
}

export const isUrl = (s: string) => /^https?:\/\/\S+\.\S+/.test(s.trim());
