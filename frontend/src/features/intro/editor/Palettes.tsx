import React, { useRef, useState } from 'react';
import type { Background, Banner, IntroDoc, Sticker } from '../doc';
import { uploadMedia } from '../../../lib/media';
import { GifPicker } from '../../media/GifPicker';
import { Chip, Row } from './ui';

type NewSticker = Pick<Sticker, 'kind' | 'value'> & { width?: number };

const PRESETS: { value: 'dark' | 'paper' | 'purple'; label: string; swatch: string }[] = [
  { value: 'dark', label: 'DARK', swatch: '#151515' },
  { value: 'paper', label: 'PAPER', swatch: '#e6e7eb' },
  { value: 'purple', label: 'PURPLE', swatch: '#6100D8' },
];

const sectionTitle = 'font-mono text-[10px] tracking-[0.22em] text-white/45 uppercase mb-2';

/** Background: presets, any colour, or an uploaded image. */
export const PagePanel: React.FC<{
  doc: IntroDoc;
  setBackground: (b: Background) => void;
  setBanner: (b: Banner | null, key?: string) => void;
  onError: (m: string) => void;
}> = ({ doc, setBackground, setBanner, onError }) => {
  const bg = doc.background;
  const banner = doc.banner ?? null;
  const file = useRef<HTMLInputElement>(null);
  const bannerFile = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [gifFor, setGifFor] = useState<'background' | 'banner' | null>(null);
  const [bannerLink, setBannerLink] = useState('');

  const putBanner = (src: string) => setBanner({ src, height: banner?.height ?? 'md', focus: banner?.focus ?? 50 });

  const uploadBanner = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      putBanner(await uploadMedia(f, 'intro'));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'upload failed');
    } finally {
      setUploading(false);
    }
  };

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      setBackground({ kind: 'image', value: await uploadMedia(f, 'intro') });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className={sectionTitle}>Background</p>
      <Row label="Preset">
        {PRESETS.map((p) => (
          <Chip key={p.value} active={bg.kind === 'preset' && bg.value === p.value} onClick={() => setBackground({ kind: 'preset', value: p.value })}>
            <span className="inline-block w-3 h-3 rounded-full mr-1.5 align-middle border border-white/30" style={{ background: p.swatch }} />
            {p.label}
          </Chip>
        ))}
      </Row>
      <Row label="Custom">
        <label
          className={`relative h-10 px-3 rounded-xl font-mono text-xs flex items-center gap-1.5 cursor-pointer ${
            bg.kind === 'color' ? 'bg-brand-cyan text-black' : 'bg-white/8 text-white/85'
          }`}
        >
          <span
            className="w-3 h-3 rounded-full border border-white/30"
            style={{ background: bg.kind === 'color' ? bg.value : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
          />
          ANY COLOUR
          <input
            type="color"
            value={bg.kind === 'color' ? bg.value : '#ff8fb1'}
            onChange={(e) => setBackground({ kind: 'color', value: e.target.value })}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <Chip active={bg.kind === 'image'} onClick={() => file.current?.click()}>
          {uploading ? 'UPLOADING…' : bg.kind === 'image' ? 'CHANGE IMAGE' : 'IMAGE'}
        </Chip>
        <Chip onClick={() => setGifFor('background')}>GIF</Chip>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
      </Row>

      <div className="h-px bg-white/10 !my-5" />
      <p className={sectionTitle}>Banner (optional)</p>
      <Row label="Image">
        <Chip onClick={() => bannerFile.current?.click()}>{uploading ? 'UPLOADING…' : 'UPLOAD'}</Chip>
        <Chip onClick={() => setGifFor('banner')}>GIF</Chip>
        {banner && <Chip onClick={() => setBanner(null)}><span className="text-rose-300">REMOVE</span></Chip>}
        <input ref={bannerFile} type="file" accept="image/*" hidden onChange={(e) => uploadBanner(e.target.files?.[0])} />
      </Row>
      <div className="flex gap-2 pl-16">
        <input
          value={bannerLink}
          onChange={(e) => setBannerLink(e.target.value)}
          placeholder="or paste an image link"
          className="flex-1 min-w-0 h-10 bg-white/8 rounded-xl px-3 outline-none font-body text-base text-white placeholder:text-white/30"
        />
        <Chip
          disabled={!/^https?:\/\//.test(bannerLink.trim())}
          onClick={() => {
            putBanner(bannerLink.trim());
            setBannerLink('');
          }}
        >
          SET
        </Chip>
      </div>
      {banner && (
        <>
          <Row label="Height">
            {(['sm', 'md', 'lg'] as const).map((h) => (
              <Chip key={h} active={banner.height === h} onClick={() => setBanner({ ...banner, height: h })}>
                {h === 'sm' ? 'SLIM' : h === 'md' ? 'MEDIUM' : 'TALL'}
              </Chip>
            ))}
          </Row>
          <Row label="Focus">
            <input
              type="range"
              min={0}
              max={100}
              value={banner.focus}
              onChange={(e) => setBanner({ ...banner, focus: Number(e.target.value) }, 'banner-focus')}
              className="w-44 accent-[#00D8FF]"
              aria-label="which part of the banner shows"
            />
            <span className="font-mono text-[10px] text-white/40">{banner.focus < 34 ? 'TOP' : banner.focus > 66 ? 'BOTTOM' : 'MIDDLE'}</span>
          </Row>
        </>
      )}

      {gifFor && (
        <GifPicker
          only="gifs"
          onClose={() => setGifFor(null)}
          onPick={(g) => {
            if (gifFor === 'background') setBackground({ kind: 'image', value: g.url });
            else putBanner(g.url);
            setGifFor(null);
          }}
        />
      )}
    </div>
  );
};

/** Stickers: KLIPY search, an uploaded image, or a pasted image/GIF link. */
export const StickerPalette: React.FC<{ onAdd: (s: NewSticker) => void; onError: (m: string) => void }> = ({ onAdd, onError }) => {
  const file = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const [klipyOpen, setKlipyOpen] = useState(false);

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      onAdd({ kind: 'image', value: await uploadMedia(f, 'intro'), width: 140 });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setKlipyOpen(true)}
        className="w-full h-12 rounded-2xl bg-brand-purple hover:shadow-[0_0_20px_rgba(97,0,216,0.6)] font-mono text-[11px] tracking-[0.2em] text-white cursor-pointer"
      >
        SEARCH STICKERS & GIFS ✦
      </button>
      <div>
        <p className={sectionTitle}>Your own</p>
        <div className="flex gap-2">
          <Chip onClick={() => file.current?.click()}>{uploading ? 'UPLOADING…' : 'UPLOAD IMAGE / GIF'}</Chip>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
        </div>
        <div className="flex gap-2 mt-2">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="or paste an image / GIF link"
            className="flex-1 min-w-0 h-10 bg-white/8 rounded-xl px-3 outline-none font-body text-base text-white placeholder:text-white/30"
          />
          <Chip
            disabled={!/^https?:\/\//.test(link.trim())}
            onClick={() => {
              onAdd({ kind: 'image', value: link.trim(), width: 140 });
              setLink('');
            }}
          >
            ADD
          </Chip>
        </div>
      </div>

      {klipyOpen && (
        <GifPicker
          initialKind="stickers"
          onClose={() => setKlipyOpen(false)}
          onPick={(item) => {
            onAdd({ kind: 'image', value: item.url, width: Math.min(160, Math.max(80, Math.round(item.width * 0.6))) });
            setKlipyOpen(false);
          }}
        />
      )}
    </div>
  );
};
