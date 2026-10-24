import React, { useEffect } from 'react';
import type { BlockNoteEditor, PartialBlock } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import '@blocknote/ariakit/style.css';
import './letter-body.css';
import { letterSchema } from './schema';
import { ensureLetterFonts } from './fonts';
import { SlashMenu } from '../editor/SlashMenu';
import { RichToolbar } from './RichToolbar';
import { resolveMedia, uploadMedia } from '../../lib/media';

export type LetterEditorInstance = BlockNoteEditor<typeof letterSchema.blockSchema, typeof letterSchema.inlineContentSchema, typeof letterSchema.styleSchema>;

interface LetterEditorProps {
  initial: unknown[];
  onChange: (doc: unknown[]) => void;
  /** Text colour for the letter's background. */
  ink?: string;
  /** Hands the editor to the quick-insert bar. */
  onReady?: (editor: LetterEditorInstance) => void;
}

/** The Notion-style letter body editor: `/` for blocks, select text for the toolbar. Lazy-loaded. */
const LetterEditor: React.FC<LetterEditorProps> = ({ initial, onChange, ink, onReady }) => {
  useEffect(ensureLetterFonts, []);

  const editor = useCreateBlockNote({
    schema: letterSchema,
    initialContent: initial.length ? (initial as PartialBlock<typeof letterSchema.blockSchema>[]) : undefined,
    uploadFile: (file) => uploadMedia(file, 'letters'),
    resolveFileUrl: resolveMedia,
    placeholders: { emptyDocument: "write anything... type '/' for headings, images, lists" },
  });

  useEffect(() => {
    onReady?.(editor);
  }, [editor, onReady]);

  return (
    <div className="letter-body letter-editor" style={{ '--page-ink': ink ?? '#e8e8e8' } as React.CSSProperties}>
    <BlockNoteView
      editor={editor}
      theme="dark"
      formattingToolbar={false}
      slashMenu={false}
      onChange={() => onChange(editor.document)}
    >
      <RichToolbar />
      <SlashMenu folder="letters" />
    </BlockNoteView>
    </div>
  );
};

export default LetterEditor;
