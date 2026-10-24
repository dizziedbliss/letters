import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { klipy, klipyEnabled, type KlipyItem, type KlipyKind } from '../../lib/klipy';
import { uploadMedia } from '../../lib/media';
import { currentUserId } from '../../utils/api';

export type MediaTab = 'upload' | 'link' | 'gifs' | 'stickers';

export interface PickedMedia {
  src: string; // "storage:<path>" for uploads, otherwise a URL
  width?: number;
  height?: number;
  from: MediaTab;
}

interface MediaPickerProps {
  title: string;
  tabs: MediaTab[];
  initialTab?: MediaTab;
  folder: 'letters' | 'intro'; // where uploads go (letters/ images stay locked with their letter)
  onPick: (m: PickedMedia) => void;
  onClose: () => void;
}

const TAB_LABEL: Record<MediaTab, string> = { upload: 'UPLOAD', link: 'LINK', gifs: 'GIFS', stickers: 'STICKERS' };

/** One picker for every image on the site: upload, paste a link, or search KLIPY. Rendered into <body>. */
export const MediaPicker: React.FC<MediaPickerProps> = ({ title, tabs, initialTab, folder, onPick, onClose }) => {
  const [tab, setTab] = useState<MediaTab>(initialTab ?? tabs[0]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60 cursor-default" onClick={onClose} />
      <div className="relative w-full sm:w-[560px] h-[80dvh] sm:h-[620px] flex flex-col bg-[#19191c] text-white rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="font-display uppercase text-2xl tracking-wide">{title}</h2>
          <button type="button" onClick={onClose} className="font-mono text-xs text-white/50 hover:text-white cursor-pointer">
            CLOSE
          </button>
        </div>
        {tabs.length > 1 && (
          <div className="flex gap-1.5 px-5 pt-3">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`h-8 px-4 rounded-full font-mono text-[11px] tracking-wider cursor-pointer ${tab === t ? 'bg-brand-cyan text-black' : 'bg-white/[0.07] text-white/70 hover:bg-white/12'}`}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 min-h-0 flex flex-col px-5 pt-4 pb-4">
          {tab === 'upload' && <UploadTab folder={folder} onPick={onPick} />}
          {tab === 'link' && <LinkTab onPick={onPick} />}
          {(tab === 'gifs' || tab === 'stickers') && <KlipyTab kind={tab} onPick={onPick} />}
        </div>
      </div>
    </div>,
    document.body
  );
};

const UploadTab: React.FC<{ folder: MediaPickerProps['folder']; onPick: (m: PickedMedia) => void }> = ({ folder, onPick }) => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onPick({ src: await uploadMedia(file, folder), from: 'upload' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'upload failed');
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        upload(e.dataTransfer.files[0]);
      }}
      disabled={busy}
      className={`flex-1 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
        over ? 'border-brand-cyan bg-brand-cyan/10' : 'border-white/15 hover:border-white/35 hover:bg-white/[0.03]'
      }`}
    >
      <span className="w-14 h-14 rounded-2xl bg-brand-purple flex items-center justify-center text-2xl">{busy ? '…' : '↑'}</span>
      <span className="font-heading text-xl">{busy ? 'uploading...' : 'choose a photo or GIF'}</span>
      <span className="font-body text-white/45">{busy ? 'shrinking it first so it loads fast' : 'or drop it here · photos get resized, GIFs stay animated'}</span>
      {error && <span className="font-body text-rose-300">{error}</span>}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
    </button>
  );
};

const LinkTab: React.FC<{ onPick: (m: PickedMedia) => void }> = ({ onPick }) => {
  const [url, setUrl] = useState('');
  const [ok, setOk] = useState<boolean | null>(null);
  const valid = /^https?:\/\/\S+/.test(url.trim());
  return (
    <div className="flex-1 flex flex-col gap-4">
      <input
        autoFocus
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setOk(null);
        }}
        placeholder="paste an image or GIF link"
        className="h-12 rounded-xl bg-white/[0.07] px-4 outline-none font-body text-lg placeholder:text-white/30 focus:bg-white/10"
      />
      <div className="flex-1 min-h-0 rounded-2xl bg-white/[0.03] flex items-center justify-center overflow-hidden">
        {valid ? (
          <img src={url.trim()} alt="" className="max-w-full max-h-full object-contain" onLoad={() => setOk(true)} onError={() => setOk(false)} />
        ) : (
          <span className="font-body italic text-white/30">preview shows up here</span>
        )}
      </div>
      {ok === false && <p className="font-body text-rose-300">that link doesn't look like an image</p>}
      <button
        type="button"
        disabled={!valid || ok === false}
        onClick={() => onPick({ src: url.trim(), from: 'link' })}
        className="h-12 rounded-2xl bg-brand-cyan text-black font-mono text-[11px] tracking-[0.2em] font-bold disabled:opacity-30 cursor-pointer"
      >
        USE THIS
      </button>
    </div>
  );
};

const KlipyTab: React.FC<{ kind: KlipyKind; onPick: (m: PickedMedia) => void }> = ({ kind, onPick }) => {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<KlipyItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customer = useRef('anon');

  useEffect(() => {
    currentUserId().then((id) => (customer.current = id ?? 'anon'));
  }, []);

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

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={kind === 'gifs' ? 'search GIFs...' : 'search stickers...'}
        className="h-11 rounded-xl bg-white/[0.07] px-4 outline-none font-body text-lg placeholder:text-white/30 focus:bg-white/10"
      />
      <div className="flex-1 min-h-0 overflow-y-auto mt-3">
        {!klipyEnabled() && <p className="font-body text-white/50 py-8 text-center">add VITE_KLIPY_KEY to frontend/.env to search</p>}
        {error && <p className="font-body text-rose-300 py-4">{error}</p>}
        <div className="columns-3 gap-2 [&>*]:mb-2">
          {items.map((it) => (
            <button
              key={`${it.id}-${it.url}`}
              type="button"
              onClick={() => onPick({ src: it.url, width: it.width, height: it.height, from: kind })}
              title={it.title}
              className={`block w-full rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-brand-cyan ${kind === 'stickers' ? 'bg-white/[0.04] p-1' : 'bg-white/5'}`}
            >
              <img src={it.preview} alt={it.title} loading="lazy" className="block w-full h-auto" />
            </button>
          ))}
        </div>
        {loading && !items.length && <p className="font-body italic text-white/40 py-8 text-center">loading...</p>}
        {!loading && !items.length && klipyEnabled() && !error && <p className="font-body italic text-white/40 py-8 text-center">nothing found :&lt;</p>}
        {hasNext && (
          <button type="button" onClick={more} disabled={loading} className="w-full h-10 mt-1 rounded-xl bg-white/[0.06] font-mono text-[11px] tracking-wider text-white/70 cursor-pointer disabled:opacity-40">
            {loading ? 'LOADING…' : 'MORE'}
          </button>
        )}
      </div>
      <p className="pt-2 font-mono text-[10px] tracking-[0.2em] text-white/35">POWERED BY KLIPY</p>
    </div>
  );
};

export default MediaPicker;
