import React, { useEffect } from 'react';
import type { BlockNoteEditor, PartialBlock } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import '@blocknote/ariakit/style.css';
import '../letters/letter-body.css';
import './intro-body.css';
import { introSchema } from './introSchema';
import { ensureLetterFonts } from '../letters/fonts';
import { SlashMenu } from '../editor/SlashMenu';
import { RichToolbar } from '../letters/RichToolbar';
import { resolveMedia, uploadMedia } from '../../lib/media';
import type { ContentBlock } from './doc';

export type IntroEditor = BlockNoteEditor<typeof introSchema.blockSchema, typeof introSchema.inlineContentSchema, typeof introSchema.styleSchema>;

interface IntroBodyProps {
  content: ContentBlock[];
  editable: boolean;
  /** Default text colour for the page background. */
  ink: string;
  onChange?: (content: ContentBlock[]) => void;
  onReady?: (editor: IntroEditor) => void;
  onFocus?: () => void;
}

/** The intro page's content, rendered (or edited) by BlockNote. Lazy-loaded. */
const IntroBody: React.FC<IntroBodyProps> = ({ content, editable, ink, onChange, onReady, onFocus }) => {
  useEffect(ensureLetterFonts, []);

  const editor = useCreateBlockNote({
    schema: introSchema,
    initialContent: content as PartialBlock<typeof introSchema.blockSchema>[],
    uploadFile: (file) => uploadMedia(file, 'intro'),
    resolveFileUrl: resolveMedia,
    placeholders: { emptyDocument: "type anything... '/' for headings, images, lists" },
  });

  useEffect(() => {
    onReady?.(editor);
  }, [editor, onReady]);

  return (
    <div className={`letter-body intro-body ${editable ? 'is-editing' : ''}`} style={{ '--page-ink': ink } as React.CSSProperties} onFocus={onFocus}>
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme="dark"
        formattingToolbar={false}
        sideMenu={editable}
        slashMenu={false}
        onChange={() => onChange?.(editor.document as ContentBlock[])}
      >
        {editable && <RichToolbar />}
        {editable && <SlashMenu folder="intro" />}
      </BlockNoteView>
    </div>
  );
};

export default IntroBody;
