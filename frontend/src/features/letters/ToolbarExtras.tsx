import React from 'react';
import { useActiveStyles, useBlockNoteEditor, useComponentsContext, usePortalElement } from '@blocknote/react';
import type { letterSchema } from './schema';
import { LETTER_FONTS, LETTER_SIZES } from './fonts';

type LetterEditor = ReturnType<typeof useBlockNoteEditor<typeof letterSchema.blockSchema, typeof letterSchema.inlineContentSchema, typeof letterSchema.styleSchema>>;

const useLetterEditor = () =>
  useBlockNoteEditor<typeof letterSchema.blockSchema, typeof letterSchema.inlineContentSchema, typeof letterSchema.styleSchema>();

const clearCustom = (editor: LetterEditor) => {
  const active = editor.getActiveStyles();
  const remove: Record<string, unknown> = {};
  for (const k of ['font', 'size', 'ink', 'glow'] as const) if (k in active) remove[k] = active[k as keyof typeof active];
  if (Object.keys(remove).length) editor.removeStyles(remove as never);
};

/** Named looks: one tap applies a combo of styles to the selection. */
const LOOKS: { name: string; apply: Record<string, string | boolean> }[] = [
  { name: 'Handwritten', apply: { font: '"Caveat", cursive', size: '24px' } },
  { name: 'Shout', apply: { font: '"Anton", sans-serif', size: '32px' } },
  { name: 'Love note', apply: { font: '"Pacifico", cursive', ink: '#ff8fb1' } },
  { name: 'Whisper', apply: { size: '14px', ink: '#9a9aa5', italic: true } },
  { name: 'Typewriter', apply: { font: '"Courier Prime", monospace' } },
  { name: 'Highlighter', apply: { glow: 'rgba(0, 216, 255, 0.35)' } },
  { name: 'Purple glow', apply: { ink: '#b388ff', glow: 'rgba(97, 0, 216, 0.35)' } },
];

export const LooksSelect: React.FC = () => {
  const editor = useLetterEditor();
  const Components = useComponentsContext()!;
  const portalElement = usePortalElement();
  if (!editor.isEditable) return null;
  return (
    <Components.FormattingToolbar.Select
      className="bn-select letter-looks"
      portalElement={portalElement}
      items={[
        { text: 'Looks ✦', icon: null, isSelected: true, onClick: () => {} },
        ...LOOKS.map((l) => ({
          text: l.name,
          icon: null,
          isSelected: false,
          onClick: () => {
            clearCustom(editor);
            editor.addStyles(l.apply as never);
          },
        })),
        { text: 'Clear looks', icon: null, isSelected: false, onClick: () => clearCustom(editor) },
      ]}
    />
  );
};

export const FontSelect: React.FC = () => {
  const editor = useLetterEditor();
  const Components = useComponentsContext()!;
  const portalElement = usePortalElement();
  const active = useActiveStyles(editor) as { font?: string };
  if (!editor.isEditable) return null;
  return (
    <Components.FormattingToolbar.Select
      className="bn-select"
      portalElement={portalElement}
      items={[
        {
          text: 'Default font',
          icon: null,
          isSelected: !active.font,
          onClick: () => active.font && editor.removeStyles({ font: active.font } as never),
        },
        ...LETTER_FONTS.map((f) => ({
          text: f.label,
          icon: <span style={{ fontFamily: f.family }}>Aa</span>,
          isSelected: active.font === f.family,
          onClick: () => editor.addStyles({ font: f.family } as never),
        })),
      ]}
    />
  );
};

export const SizeSelect: React.FC = () => {
  const editor = useLetterEditor();
  const Components = useComponentsContext()!;
  const portalElement = usePortalElement();
  const active = useActiveStyles(editor) as { size?: string };
  if (!editor.isEditable) return null;
  return (
    <Components.FormattingToolbar.Select
      className="bn-select"
      portalElement={portalElement}
      items={LETTER_SIZES.map((s) => ({
        text: s.label,
        icon: null,
        isSelected: (active.size ?? null) === s.value,
        onClick: () => {
          if (s.value) editor.addStyles({ size: s.value } as never);
          else if (active.size) editor.removeStyles({ size: active.size } as never);
        },
      }))}
    />
  );
};

/** "Any colour" for text (ink) or highlight (glow): a native colour picker living in the toolbar. */
const ColourPicker: React.FC<{ kind: 'ink' | 'glow'; label: string; glyph: React.ReactNode }> = ({ kind, label, glyph }) => {
  const editor = useLetterEditor();
  const Components = useComponentsContext()!;
  const active = useActiveStyles(editor) as Record<string, string | undefined>;
  const current = active[kind];
  if (!editor.isEditable) return null;
  return (
    <Components.FormattingToolbar.Button
      mainTooltip={label}
      label={label}
      isSelected={!!current}
      onClick={() => {}}
      icon={
        <label className="relative flex items-center gap-1 cursor-pointer">
          {glyph}
          <span className="w-3 h-3 rounded-full border border-white/40" style={{ background: current ?? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} />
          <input
            type="color"
            aria-label={label}
            value={current?.startsWith('#') ? current : kind === 'ink' ? '#ff8fb1' : '#00d8ff'}
            onChange={(e) => editor.addStyles({ [kind]: kind === 'glow' ? `${e.target.value}59` : e.target.value } as never)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      }
    />
  );
};

export const InkPicker: React.FC = () => <ColourPicker kind="ink" label="Any text colour" glyph={<span className="font-bold">A</span>} />;
export const GlowPicker: React.FC = () => (
  <ColourPicker kind="glow" label="Any highlight colour" glyph={<span className="px-0.5 rounded bg-white/25 font-bold">A</span>} />
);
