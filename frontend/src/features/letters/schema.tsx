import { BlockNoteSchema, defaultStyleSpecs } from '@blocknote/core';
import { createReactStyleSpec } from '@blocknote/react';

// Extra inline styles on top of BlockNote's defaults, so formatting isn't stuck to presets:
// any text colour, any highlight colour, a font, and a size. Editor and reader share this schema.

const Ink = createReactStyleSpec(
  { type: 'ink', propSchema: 'string' },
  { render: ({ value, contentRef }) => <span ref={contentRef} style={{ color: value }} /> }
);

const Glow = createReactStyleSpec(
  { type: 'glow', propSchema: 'string' },
  {
    render: ({ value, contentRef }) => (
      <span ref={contentRef} style={{ backgroundColor: value, borderRadius: 4, padding: '0 2px' }} />
    ),
  }
);

const Font = createReactStyleSpec(
  { type: 'font', propSchema: 'string' },
  { render: ({ value, contentRef }) => <span ref={contentRef} style={{ fontFamily: value }} /> }
);

const Size = createReactStyleSpec(
  { type: 'size', propSchema: 'string' },
  { render: ({ value, contentRef }) => <span ref={contentRef} style={{ fontSize: value, lineHeight: 1.3 }} /> }
);

export const letterStyleSpecs = { ...defaultStyleSpecs, ink: Ink, glow: Glow, font: Font, size: Size };

export const letterSchema = BlockNoteSchema.create({ styleSpecs: letterStyleSpecs });
