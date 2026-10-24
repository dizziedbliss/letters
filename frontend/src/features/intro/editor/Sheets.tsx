import React from 'react';
import type { Background, IntroDoc } from '../doc';
import { Chip, Row, Sheet, TextInput } from './ui';

type Update = (fn: (d: IntroDoc) => IntroDoc, key?: string) => void;

const ADDABLE = [
  { type: 'heading', label: 'Heading', hint: 'big "Hello, ___" style title' },
  { type: 'text', label: 'Text', hint: 'paragraphs, notes, anything' },
  { type: 'image', label: 'Image / GIF', hint: 'paste a link (uploads come next)' },
  { type: 'embed', label: 'Song / video', hint: 'YouTube or Spotify link' },
] as const;

export type AddableType = (typeof ADDABLE)[number]['type'];

export const AddSheet: React.FC<{ onAdd: (type: AddableType) => void; onClose: () => void }> = ({ onAdd, onClose }) => (
  <Sheet title="Add a block" onClose={onClose}>
    <div className="grid grid-cols-2 gap-2.5">
      {ADDABLE.map((a) => (
        <button
          key={a.type}
          type="button"
          onClick={() => onAdd(a.type)}
          className="text-left rounded-2xl bg-white/6 hover:bg-white/12 p-4 cursor-pointer transition-colors border-l-4 border-brand-purple"
        >
          <span className="block font-display uppercase text-xl tracking-wide">{a.label}</span>
          <span className="block font-body text-sm text-white/55 mt-1">{a.hint}</span>
        </button>
      ))}
    </div>
  </Sheet>
);

const PRESETS: { value: 'dark' | 'paper' | 'purple'; label: string; swatch: string }[] = [
  { value: 'dark', label: 'DARK', swatch: '#151515' },
  { value: 'paper', label: 'PAPER', swatch: '#e6e7eb' },
  { value: 'purple', label: 'PURPLE', swatch: '#6100D8' },
];

export const PageSheet: React.FC<{ doc: IntroDoc; update: Update; onClose: () => void }> = ({ doc, update, onClose }) => {
  const setBg = (background: Background, key?: string) => update((d) => ({ ...d, background }), key);
  const letters = doc.letters ?? { nickname: '', note: '' };
  const setLetters = (patch: Partial<typeof letters>, key: string) =>
    update((d) => ({ ...d, letters: { ...letters, ...d.letters, ...patch } }), key);
  const bg = doc.background;

  return (
    <Sheet title="Page" onClose={onClose}>
      <div className="space-y-4">
        <Row label="Back">
          {PRESETS.map((p) => (
            <Chip key={p.value} active={bg.kind === 'preset' && bg.value === p.value} onClick={() => setBg({ kind: 'preset', value: p.value })}>
              <span className="inline-block w-3 h-3 rounded-full mr-1.5 align-middle border border-white/30" style={{ background: p.swatch }} />
              {p.label}
            </Chip>
          ))}
          <label
            className={`relative h-10 px-3 rounded-xl font-mono text-xs flex items-center gap-1.5 cursor-pointer ${
              bg.kind === 'color' ? 'bg-brand-cyan text-black' : 'bg-white/8 text-white/85'
            }`}
          >
            <span className="w-3 h-3 rounded-full border border-white/30" style={{ background: bg.kind === 'color' ? bg.value : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} />
            ANY
            <input
              type="color"
              value={bg.kind === 'color' ? bg.value : '#ff8fb1'}
              onChange={(e) => setBg({ kind: 'color', value: e.target.value }, 'bg-color')}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
        </Row>
        <p className="font-body text-sm text-white/40 -mt-1 pl-16">background images arrive with uploads, next stage</p>

        <div className="h-px bg-white/10" />
        <p className="font-mono text-[10px] tracking-[0.2em] text-white/40">THE LETTERS PAGE (after they press the button)</p>
        <TextInput label="Hello, ___" value={letters.nickname} onChange={(v) => setLetters({ nickname: v }, 'letters-nick')} placeholder="nickname" />
        <TextInput label="Note before the first letter" value={letters.note} onChange={(v) => setLetters({ note: v }, 'letters-note')} placeholder="shown before they press more?" multiline />
      </div>
    </Sheet>
  );
};
