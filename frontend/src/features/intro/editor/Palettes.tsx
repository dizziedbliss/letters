import React, { useRef, useState } from 'react';
import type { Background, IntroDoc, Sticker } from '../doc';
import { DOODLES, EMOJI } from '../stickers/doodles';
import { uploadMedia } from '../../../lib/media';
import { Chip, Row } from './ui';

type NewSticker = Pick<Sticker, 'kind' | 'value'> & { width?: number };

const PRESETS: { value: 'dark' | 'paper' | 'purple'; label: string; swatch: string }[] = [
  { value: 'dark', label: 'DARK', swatch: '#151515' },
  { value: 'paper', label: 'PAPER', swatch: '#e6e7eb' },
  { value: 'purple', label: 'PURPLE', swatch: '#6100D8' },
];

const sectionTitle = 'font-mono text-[10px] tracking-[0.22em] text-white/45 uppercase mb-2';

/** Background: presets, any colour, or an uploaded image. */
export const PagePanel: React.FC<{ doc: IntroDoc; setBackground: (b: Background) => void; onError: (m: string) => void }> = ({
  doc,
  setBackground,
  onError,
}) => {
  const bg = doc.background;
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
      </Row>
    </div>
  );
};

/** Stickers: emoji, doodles, an uploaded image, or a pasted image/GIF link. */
export const StickerPalette: React.FC<{ onAdd: (s: NewSticker) => void; onError: (m: string) => void }> = ({ onAdd, onError }) => {
  const file = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const [uploading, setUploading] = useState(false);

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
      <div>
        <p className={sectionTitle}>Emoji</p>
        <div className="grid grid-cols-8 gap-1">
          {EMOJI.map((e) => (
            <button key={e} type="button" onClick={() => onAdd({ kind: 'emoji', value: e })} className="aspect-square rounded-lg text-2xl hover:bg-white/10 cursor-pointer">
              {e}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className={sectionTitle}>Doodles</p>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(DOODLES).map(([name, svg]) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              onClick={() => onAdd({ kind: 'doodle', value: name, width: 90 })}
              className="aspect-square rounded-xl bg-white/[0.06] hover:bg-white/12 p-3 cursor-pointer flex items-center justify-center [&>svg]:w-full [&>svg]:h-auto"
            >
              {svg}
            </button>
          ))}
        </div>
      </div>
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
    </div>
  );
};
