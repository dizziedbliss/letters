import React, { useEffect } from 'react';
import type { PartialBlock } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import '@blocknote/ariakit/style.css';
import './letter-body.css';
import { letterSchema } from './schema';
import { ensureLetterFonts } from './fonts';
import { RichToolbar } from './RichToolbar';
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
      <RichToolbar />
    </BlockNoteView>
  );
};

export default LetterEditor;
