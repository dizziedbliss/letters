import React from 'react';
import { useActiveStyles, useBlockNoteEditor, useComponentsContext, usePortalElement } from '@blocknote/react';
import type { letterSchema } from './schema';
import { LETTER_FONTS, LETTER_SIZES } from './fonts';

type SelectItem = { text: string; icon: React.ReactNode; isSelected: boolean; onClick: () => void };

// BlockNote's Select crashes when no item is selected, e.g. a 38px heading (not one of our sizes)
// or a selection mixing sizes. Show it as "Custom" instead.
const withFallback = (items: SelectItem[]): SelectItem[] =>
  items.some((i) => i.isSelected) ? items : [{ text: 'Custom', icon: null, isSelected: true, onClick: () => {} }, ...items];

const useLetterEditor = () =>
  useBlockNoteEditor<typeof letterSchema.blockSchema, typeof letterSchema.inlineContentSchema, typeof letterSchema.styleSchema>();

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
      items={withFallback([
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
      ])}
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
      items={withFallback(LETTER_SIZES.map((s) => ({
        text: s.label,
        icon: null,
        isSelected: (active.size ?? null) === s.value,
        onClick: () => {
          if (s.value) editor.addStyles({ size: s.value } as never);
          else if (active.size) editor.removeStyles({ size: active.size } as never);
        },
      })))}
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
