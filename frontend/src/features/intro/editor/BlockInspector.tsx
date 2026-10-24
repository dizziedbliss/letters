import React from 'react';
import type { Align, Block, IntroDoc } from '../doc';
import { SWATCHES } from '../styles';
import { Chip, Row, TextInput } from './ui';
import { patchBlock } from './blockOps';

type Update = (fn: (d: IntroDoc) => IntroDoc, key?: string) => void;

const ALIGNS: Align[] = ['left', 'center', 'right'];
const ALIGN_ICON: Record<Align, string> = { left: '⇤', center: '↔', right: '⇥' };

interface BlockInspectorProps {
  block: Block;
  index: number;
  count: number;
  update: Update;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/** The toolbar docked at the bottom while a block is selected: styles + move/duplicate/delete. */
export const BlockInspector: React.FC<BlockInspectorProps> = ({ block, index, count, update, onMove, onDuplicate, onDelete }) => {
  const set = (patch: Record<string, unknown>, key?: string) => update(patchBlock(block.id, patch), key);
  const p = block.props as Record<string, unknown>;
  const isButton = block.type === 'button';

  const alignRow = (
    <Row label="Align">
      {ALIGNS.map((a) => (
        <Chip key={a} label={`align ${a}`} active={(p.align ?? (block.type === 'image' ? 'center' : 'left')) === a} onClick={() => set({ align: a })}>
          {ALIGN_ICON[a]}
        </Chip>
      ))}
    </Row>
  );

  const colorRow = (
    <Row label="Colour">
      {SWATCHES.map((c) => (
        <button
          key={c ?? 'auto'}
          type="button"
          aria-label={c ? `colour ${c}` : 'default colour'}
          onClick={() => set({ color: c })}
          className={`shrink-0 w-9 h-9 rounded-full border-2 cursor-pointer ${p.color === c ? 'border-brand-cyan' : 'border-white/15'}`}
          style={{ background: c ?? 'conic-gradient(#fff 0 50%, #151515 0)' }}
        />
      ))}
    </Row>
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-[#1c1c1f]/95 backdrop-blur text-white border-t border-white/10 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2.5 animate-fade-in">
      {block.type === 'heading' && (
        <>
          <Row label="Size">
            <Chip active={(p.size ?? 'lg') === 'lg'} onClick={() => set({ size: 'lg' })}>L</Chip>
            <Chip active={p.size === 'xl'} onClick={() => set({ size: 'xl' })}>XL</Chip>
          </Row>
          {alignRow}
          {colorRow}
        </>
      )}

      {block.type === 'text' && (
        <>
          <Row label="Size">
            {(['sm', 'md', 'lg'] as const).map((s) => (
              <Chip key={s} active={(p.size ?? 'md') === s} onClick={() => set({ size: s })}>
                {s.toUpperCase()}
              </Chip>
            ))}
            <Chip label="italic" active={!!p.italic} onClick={() => set({ italic: !p.italic })}>
              <span className="font-body italic text-sm">I</span>
            </Chip>
          </Row>
          {alignRow}
          {colorRow}
        </>
      )}

      {block.type === 'image' && (
        <>
          <TextInput label="Image or GIF link" value={block.props.src} onChange={(v) => set({ src: v.trim() }, `src:${block.id}`)} placeholder="https://..." />
          <Row label="Width">
            <input
              type="range"
              min={15}
              max={100}
              value={Math.round((block.props.width ?? 1) * 100)}
              onChange={(e) => set({ width: Number(e.target.value) / 100 }, `width:${block.id}`)}
              className="w-44 accent-[#00D8FF]"
            />
            <Chip active={!!block.props.rounded} onClick={() => set({ rounded: !block.props.rounded })}>ROUND</Chip>
          </Row>
          {alignRow}
        </>
      )}

      {block.type === 'embed' && (
        <TextInput label="YouTube or Spotify link" value={block.props.url} onChange={(v) => set({ url: v.trim() }, `url:${block.id}`)} placeholder="https://youtu.be/..." />
      )}

      {isButton && (
        <>
          <TextInput label="Button text" value={block.props.label} onChange={(v) => set({ label: v }, `label:${block.id}`)} placeholder="This :3" />
          <Row label="Style">
            {(['cyan', 'purple', 'white', 'ink'] as const).map((c) => (
              <Chip key={c} active={(block.props.color ?? 'cyan') === c} onClick={() => set({ color: c })}>
                {c.toUpperCase()}
              </Chip>
            ))}
          </Row>
          {alignRow}
        </>
      )}

      <Row label="Block">
        <Chip label="move up" disabled={index === 0} onClick={() => onMove(-1)}>↑</Chip>
        <Chip label="move down" disabled={index === count - 1} onClick={() => onMove(1)}>↓</Chip>
        {!isButton && <Chip onClick={onDuplicate}>COPY</Chip>}
        {isButton ? (
          <span className="font-mono text-[10px] text-white/40 pl-1">always here (it opens the letters)</span>
        ) : (
          <Chip onClick={onDelete}>
            <span className="text-rose-300">DELETE</span>
          </Chip>
        )}
      </Row>
    </div>
  );
};

export default BlockInspector;
