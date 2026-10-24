import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { klipy, klipyEnabled, type KlipyItem, type KlipyKind } from '../../lib/klipy';
import { currentUserId } from '../../utils/api';

interface GifPickerProps {
  initialKind?: KlipyKind;
  /** Hide the GIF/sticker tabs and only offer one kind. */
  only?: KlipyKind;
  onPick: (item: KlipyItem, kind: KlipyKind) => void;
  onClose: () => void;
}

/**
 * Search KLIPY for GIFs or stickers. Rendered into <body> so it escapes scaled
 * containers (the intro page is CSS-scaled, which would trap a fixed overlay).
 */
export const GifPicker: React.FC<GifPickerProps> = ({ initialKind = 'gifs', only, onPick, onClose }) => {
  const [kind, setKind] = useState<KlipyKind>(only ?? initialKind);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<KlipyItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customer = useRef('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    currentUserId().then((id) => (customer.current = id ?? 'anon'));
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Search as you type (debounced); page 1 on every new query/kind
  useEffect(() => {
    if (!klipyEnabled()) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      klipy(kind, query, 1, customer.current)
        .then((r) => {
          if (cancelled) return;
          setItems(r.items);
          setHasNext(r.hasNext);
          setPage(1);
          setError(null);
        })
        .catch((e) => !cancelled && setError(e.message))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [kind, query]);

  const more = () => {
    setLoading(true);
    klipy(kind, query, page + 1, customer.current)
      .then((r) => {
        setItems((prev) => [...prev, ...r.items]);
        setHasNext(r.hasNext);
        setPage((p) => p + 1);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-label="Pick a GIF">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60 cursor-default" onClick={onClose} />
      <div className="relative w-full sm:w-[560px] max-h-[85dvh] flex flex-col bg-[#19191c] text-white rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl animate-fade-in">
        <div className="px-4 pt-4 pb-3 space-y-3">
          <div className="flex items-center gap-2">
            <input
              ref={input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={kind === 'gifs' ? 'search GIFs...' : 'search stickers...'}
              className="flex-1 min-w-0 h-11 rounded-xl bg-white/[0.07] px-4 outline-none font-body text-lg placeholder:text-white/30 focus:bg-white/10"
            />
            <button type="button" onClick={onClose} className="h-11 px-3 font-mono text-xs text-white/50 hover:text-white cursor-pointer">
              CLOSE
            </button>
          </div>
          {!only && (
            <div className="flex gap-1.5">
              {(['gifs', 'stickers'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`h-8 px-4 rounded-full font-mono text-[11px] tracking-wider cursor-pointer ${
                    kind === k ? 'bg-brand-cyan text-black' : 'bg-white/[0.07] text-white/70'
                  }`}
                >
                  {k.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {!klipyEnabled() && <p className="font-body text-white/50 py-8 text-center">add VITE_KLIPY_KEY to frontend/.env to search GIFs</p>}
          {error && <p className="font-body text-rose-300 py-4">{error}</p>}
          <div className="columns-3 gap-2 [&>*]:mb-2">
            {items.map((it) => (
              <button
                key={`${it.id}-${it.url}`}
                type="button"
                onClick={() => onPick(it, kind)}
                title={it.title}
                className={`block w-full rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-brand-cyan ${kind === 'stickers' ? 'bg-white/[0.04] p-1' : 'bg-white/5'}`}
              >
                <img src={it.preview} alt={it.title} loading="lazy" className="block w-full h-auto" />
              </button>
            ))}
          </div>
          {!loading && !items.length && klipyEnabled() && !error && <p className="font-body italic text-white/40 py-8 text-center">nothing found :&lt;</p>}
          {hasNext && (
            <button type="button" onClick={more} disabled={loading} className="w-full h-10 mt-1 rounded-xl bg-white/[0.06] font-mono text-[11px] tracking-wider text-white/70 cursor-pointer disabled:opacity-40">
              {loading ? 'LOADING…' : 'MORE'}
            </button>
          )}
          {loading && !items.length && <p className="font-body italic text-white/40 py-8 text-center">loading...</p>}
        </div>

        <p className="px-4 py-2.5 border-t border-white/5 font-mono text-[10px] tracking-[0.2em] text-white/35">POWERED BY KLIPY</p>
      </div>
    </div>,
    document.body
  );
};

export default GifPicker;
