import React from 'react';

export type QuickAction = 'image' | 'gif' | 'embed' | 'heading' | 'quote' | 'list' | 'divider' | 'banner' | 'sticker' | 'background';

const GROUPS: { label: string; actions: { key: QuickAction; text: string }[] }[] = [
  {
    label: 'Add',
    actions: [
      { key: 'image', text: 'IMAGE' },
      { key: 'gif', text: 'GIF' },
      { key: 'embed', text: 'SONG / VIDEO' },
    ],
  },
  {
    label: 'Text',
    actions: [
      { key: 'heading', text: 'HEADING' },
      { key: 'quote', text: 'QUOTE' },
      { key: 'list', text: 'LIST' },
      { key: 'divider', text: 'LINE' },
    ],
  },
  {
    label: 'Look',
    actions: [
      { key: 'banner', text: 'BANNER' },
      { key: 'sticker', text: 'STICKER' },
      { key: 'background', text: 'BACKGROUND' },
    ],
  },
];

/** Always-visible shortcuts so nobody has to remember "/" commands. Scrolls sideways on phones. */
export const QuickBar: React.FC<{ onAction: (a: QuickAction) => void; hasBanner: boolean }> = ({ onAction, hasBanner }) => (
  <div className="sticky top-14 z-20 bg-[#151515]/85 backdrop-blur border-b border-white/5">
    <div className="flex items-center gap-4 px-4 h-12 overflow-x-auto no-scrollbar">
      {GROUPS.map((g) => (
        <div key={g.label} className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-[9px] tracking-[0.2em] text-white/30 mr-0.5">{g.label.toUpperCase()}</span>
          {g.actions.map((a) => (
            <button
              key={a.key}
              type="button"
              // keep the editor's cursor where it is while clicking
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onAction(a.key)}
              className="h-8 px-3 rounded-full bg-white/[0.07] hover:bg-white/15 text-white/85 font-mono text-[10px] tracking-wider whitespace-nowrap cursor-pointer"
            >
              {a.key === 'banner' && hasBanner ? 'CHANGE BANNER' : a.text}
            </button>
          ))}
        </div>
      ))}
    </div>
  </div>
);

export default QuickBar;
