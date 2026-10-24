import React, { useEffect } from 'react';
import type { PartialBlock } from '@blocknote/core';
import { FormattingToolbar, FormattingToolbarController, getFormattingToolbarItems, useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import '@blocknote/ariakit/style.css';
import './letter-body.css';
import { letterSchema } from './schema';
import { ensureLetterFonts } from './fonts';
import { FontSelect, GlowPicker, InkPicker, LooksSelect, SizeSelect } from './ToolbarExtras';
import { resolveMedia, uploadMedia } from '../../lib/media';

interface LetterEditorProps {
  initial: unknown[];
  onChange: (doc: unknown[]) => void;
}

/** The Notion-style letter body editor: `/` for blocks, select text for the toolbar. Lazy-loaded. */
const LetterEditor: React.FC<LetterEditorProps> = ({ initial, onChange }) => {
  useEffect(ensureLetterFonts, []);

  const editor = useCreateBlockNote({
    schema: letterSchema,
    initialContent: initial.length ? (initial as PartialBlock<typeof letterSchema.blockSchema>[]) : undefined,
    uploadFile: (file) => uploadMedia(file, 'letters'),
    resolveFileUrl: resolveMedia,
    placeholders: { emptyDocument: "write anything... type '/' for headings, images, lists" },
  });

  return (
    <BlockNoteView
      editor={editor}
      theme="dark"
      formattingToolbar={false}
      onChange={() => onChange(editor.document)}
      className="letter-body letter-editor"
    >
      <FormattingToolbarController
        formattingToolbar={() => (
          <FormattingToolbar>
            <LooksSelect key="looks" />
            {getFormattingToolbarItems().filter((item) => !String(item.key).toLowerCase().includes('nest'))}
            <FontSelect key="font" />
            <SizeSelect key="size" />
            <InkPicker key="ink" />
            <GlowPicker key="glow" />
          </FormattingToolbar>
        )}
      />
    </BlockNoteView>
  );
};

export default LetterEditor;
