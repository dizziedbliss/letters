import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { letterStyleSpecs } from '../letters/schema';
import { LettersButtonView } from './LettersButtonView';
import { EmbedBlock } from '../editor/embedBlock';

/**
 * The way into the letters. Always on the page: it can be moved, relabelled,
 * recoloured and realigned, and the builder puts it back if it goes missing.
 */
const LettersButton = createReactBlockSpec(
  {
    type: 'lettersButton',
    propSchema: {
      label: { default: 'This :3' },
      color: { default: 'cyan', values: ['cyan', 'purple', 'white', 'ink'] as const },
      align: { default: 'left', values: ['left', 'center', 'right'] as const },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => <LettersButtonView block={block} editor={editor} />,
  }
);

export const introSchema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, lettersButton: LettersButton(), embed: EmbedBlock() },
  styleSpecs: letterStyleSpecs,
});
