import React, { useContext } from 'react';
import { LettersButtonContext } from './introContext';

const COLORS = {
  cyan: 'bg-brand-cyan text-black',
  purple: 'bg-brand-purple text-white',
  white: 'bg-white text-black',
  ink: 'bg-ink text-white',
} as const;
type ButtonColor = keyof typeof COLORS;
const ALIGN = { left: 'justify-start', center: 'justify-center', right: 'justify-end' } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LettersButtonView: React.FC<{ block: any; editor: any }> = ({ block, editor }) => {
  const onOpen = useContext(LettersButtonContext);
  const { label, color, align } = block.props as { label: string; color: ButtonColor; align: keyof typeof ALIGN };
  const set = (props: Record<string, string>) => editor.updateBlock(block, { props });
  const pill = `inline-flex items-center justify-center px-6 py-2 rounded-full font-body text-lg font-semibold tracking-wide ${COLORS[color]}`;

  if (!editor.isEditable) {
    return (
      <div className={`flex w-full ${ALIGN[align]}`}>
        <button type="button" onClick={onOpen} className={`${pill} transition-transform hover:scale-105 active:scale-95 cursor-pointer`}>
          {label || 'open :3'}
        </button>
      </div>
    );
  }

  // Editing: the label is typed right on the button; colour and alignment sit just under it
  return (
    <div className={`flex w-full flex-col gap-2 ${align === 'center' ? 'items-center' : align === 'right' ? 'items-end' : 'items-start'}`} contentEditable={false}>
      <input
        value={label}
        onChange={(e) => set({ label: e.target.value })}
        onKeyDown={(e) => e.stopPropagation()}
        size={Math.max(6, label.length + 1)}
        aria-label="button text"
        className={`${pill} text-center outline-dashed outline-2 outline-offset-4 outline-white/30 focus:outline-brand-cyan`}
      />
      <div className="flex items-center gap-1.5 font-mono text-[10px]">
        {(Object.keys(COLORS) as ButtonColor[]).map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`button colour ${c}`}
            onClick={() => set({ color: c })}
            className={`w-5 h-5 rounded-full border-2 cursor-pointer ${COLORS[c].split(' ')[0]} ${c === color ? 'border-brand-cyan' : 'border-white/20'}`}
          />
        ))}
        <span className="mx-1 opacity-30">|</span>
        {(['left', 'center', 'right'] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => set({ align: a })}
            className={`px-1.5 py-0.5 rounded cursor-pointer ${a === align ? 'bg-brand-cyan text-black' : 'bg-white/10 opacity-70'}`}
          >
            {a === 'left' ? '⇤' : a === 'center' ? '↔' : '⇥'}
          </button>
        ))}
        <span className="ml-1 opacity-40">opens the letters · always here</span>
      </div>
    </div>
  );
};


export default LettersButtonView;
