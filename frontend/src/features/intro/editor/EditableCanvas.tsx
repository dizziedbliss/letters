import React, { useLayoutEffect, useRef } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HEADING_PX, TEXT_PX, themeFor, type Block, type IntroDoc } from '../doc';
import { BlockView, MAX_SCALE, StickerView } from '../IntroRenderer';
import { textAlign } from '../styles';
import { useDesignScale } from '../useDesignScale';
import { moveBlock, patchBlock } from './blockOps';

type Update = (fn: (d: IntroDoc) => IntroDoc, key?: string) => void;

/** A textarea that grows with its content and is styled to look exactly like the rendered text. */
const AutoTextarea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
}> = ({ value, onChange, placeholder, className, style, autoFocus }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current!;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      autoFocus={autoFocus}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:opacity-40 ${className ?? ''}`}
      style={style}
    />
  );
};

/** Text and headings become editable in place when selected; everything else previews as-is. */
const InlineEditor: React.FC<{ block: Block; ink: string; strong: string; update: Update }> = ({ block, ink, strong, update }) => {
  const set = (patch: Record<string, unknown>) => update(patchBlock(block.id, patch), `type:${block.id}`);

  if (block.type === 'heading') {
    const { text, accent, size = 'lg', align = 'left', color } = block.props;
    const base = { fontSize: HEADING_PX[size], color: color ?? strong };
    return (
      <div className={`tracking-tight leading-tight mb-2 ${textAlign[align]}`}>
        <AutoTextarea value={text} onChange={(v) => set({ text: v })} placeholder="Hello, " className={`font-heading font-medium ${textAlign[align]}`} style={base} />
        <AutoTextarea value={accent ?? ''} onChange={(v) => set({ accent: v })} placeholder="name" className={`font-body italic ${textAlign[align]}`} style={base} autoFocus />
      </div>
    );
  }

  if (block.type === 'text') {
    const { text, size = 'md', italic, align = 'left', color } = block.props;
    return (
      <AutoTextarea
        value={text}
        onChange={(v) => set({ text: v })}
        placeholder="type here... (blank line = new paragraph)"
        autoFocus
        className={`font-body leading-relaxed ${italic ? 'italic' : ''} ${textAlign[align]}`}
        style={{ fontSize: TEXT_PX[size], color: color ?? ink }}
      />
    );
  }

  return <BlockView block={block} ink={ink} strong={strong} />;
};

const Placeholder: React.FC<{ block: Block }> = ({ block }) => {
  const empty =
    (block.type === 'image' && !block.props.src) ||
    (block.type === 'embed' && !block.props.url) ||
    (block.type === 'text' && !block.props.text.trim());
  if (!empty) return null;
  const label = block.type === 'image' ? 'image: paste a link below' : block.type === 'embed' ? 'song/video: paste a link below' : 'empty text';
  return (
    <div className="rounded-xl border border-dashed border-current/30 py-6 text-center font-mono text-[11px] tracking-widest opacity-60 uppercase">
      {label}
    </div>
  );
};

const SortableBlock: React.FC<{
  block: Block;
  selected: boolean;
  scale: number;
  ink: string;
  strong: string;
  onSelect: (id: string) => void;
  update: Update;
}> = ({ block, selected, scale, ink, strong, onSelect, update }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  // dnd-kit measures in screen px, but we live inside a scaled frame
  const t = transform ? { ...transform, x: transform.x / scale, y: transform.y / scale } : null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(t), transition, zIndex: isDragging ? 30 : undefined }}
      className={`relative ${isDragging ? 'opacity-80' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(block.id);
      }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        className="absolute -left-6 top-0 w-6 h-9 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing opacity-40 hover:opacity-90"
        style={{ color: strong }}
      >
        <svg viewBox="0 0 10 16" className="w-2.5 h-4" fill="currentColor">
          {[2, 8, 14].flatMap((y) => [<circle key={`a${y}`} cx="2.5" cy={y} r="1.3" />, <circle key={`b${y}`} cx="7.5" cy={y} r="1.3" />])}
        </svg>
      </button>
      <div
        className={`rounded-lg outline-offset-[6px] transition-[outline-color] ${
          selected ? 'outline-2 outline-dashed outline-brand-cyan' : 'outline-1 outline-dashed outline-transparent hover:outline-white/25'
        }`}
      >
        {selected ? <InlineEditor block={block} ink={ink} strong={strong} update={update} /> : <BlockView block={block} ink={ink} strong={strong} />}
        <Placeholder block={block} />
      </div>
    </div>
  );
};

interface EditableCanvasProps {
  doc: IntroDoc;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  update: Update;
}

/** The real page, scaled exactly like the reader sees it, but every block is tappable and draggable. */
export const EditableCanvas: React.FC<EditableCanvasProps> = ({ doc, selectedId, onSelect, update }) => {
  const { outerRef, frameRef, box, frameStyle } = useDesignScale(MAX_SCALE);
  const theme = themeFor(doc.background);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = doc.blocks.findIndex((b) => b.id === active.id);
    const to = doc.blocks.findIndex((b) => b.id === over.id);
    update(moveBlock(from, to));
  };

  return (
    <div ref={outerRef} className="relative w-full" style={{ height: box.height || undefined }} onClick={() => onSelect(null)}>
      <div ref={frameRef} className="absolute top-0 left-0 px-6 py-4 flex flex-col gap-6" style={frameStyle}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={doc.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {doc.blocks.map((b) => (
              <SortableBlock
                key={b.id}
                block={b}
                selected={b.id === selectedId}
                scale={box.scale}
                ink={theme.ink}
                strong={theme.strong}
                onSelect={onSelect}
                update={update}
              />
            ))}
          </SortableContext>
        </DndContext>
        {doc.stickers.map((s) => (
          <StickerView key={s.id} sticker={s} />
        ))}
      </div>
    </div>
  );
};

export default EditableCanvas;
