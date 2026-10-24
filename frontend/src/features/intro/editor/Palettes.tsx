import React, { useState } from 'react';
import type { Background, IntroDoc, Sticker } from '../doc';
import { MediaPicker } from '../../media/MediaPicker';
import { Chip, Row } from './ui';

type NewSticker = Pick<Sticker, 'kind' | 'value'> & { width?: number };

const PRESETS: { value: 'dark' | 'paper' | 'purple'; label: string; swatch: string }[] = [
  { value: 'dark', label: 'DARK', swatch: '#151515' },
  { value: 'paper', label: 'PAPER', swatch: '#e6e7eb' },
  { value: 'purple', label: 'PURPLE', swatch: '#6100D8' },
];

const sectionTitle = 'font-mono text-[10px] tracking-[0.22em] text-white/45 uppercase mb-2';

/** Background: a preset, any colour, or an image (upload, GIF or link). */
export const PagePanel: React.FC<{ doc: IntroDoc; setBackground: (b: Background) => void }> = ({ doc, setBackground }) => {
  const bg = doc.background;
  const [picking, setPicking] = useState(false);

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
        <Chip active={bg.kind === 'image'} onClick={() => setPicking(true)}>
          {bg.kind === 'image' ? 'CHANGE IMAGE' : 'IMAGE'}
        </Chip>
      </Row>
      {picking && (
        <MediaPicker
          title="Background"
          tabs={['upload', 'gifs', 'link']}
          folder="intro"
          onClose={() => setPicking(false)}
          onPick={(m) => {
            setBackground({ kind: 'image', value: m.src });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
};

/** Stickers: one button, then search KLIPY, upload, or paste a link. */
export const StickerPalette: React.FC<{ onAdd: (s: NewSticker) => void }> = ({ onAdd }) => {
  const [picking, setPicking] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="w-full h-12 rounded-2xl bg-brand-purple hover:shadow-[0_0_20px_rgba(97,0,216,0.6)] font-mono text-[11px] tracking-[0.2em] text-white cursor-pointer"
      >
        + ADD STICKER
      </button>
      <p className="font-body text-sm text-white/40 mt-2">drag it anywhere on the page · corner to resize · top handle to rotate</p>
      {picking && (
        <MediaPicker
          title="Add a sticker"
          tabs={['stickers', 'gifs', 'upload', 'link']}
          folder="intro"
          onClose={() => setPicking(false)}
          onPick={(m) => {
            onAdd({ kind: 'image', value: m.src, width: m.width ? Math.min(160, Math.max(80, Math.round(m.width * 0.6))) : 140 });
            setPicking(false);
          }}
        />
      )}
    </>
  );
};
