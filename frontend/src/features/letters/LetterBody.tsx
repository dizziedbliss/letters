import React, { useEffect } from 'react';
import type { PartialBlock } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import '@blocknote/ariakit/style.css';
import './letter-body.css';
import { letterSchema } from './schema';
import { ensureLetterFonts } from './fonts';
import { resolveMedia } from '../../lib/media';

/** A letter body, rendered read-only by BlockNote (the same engine that edits it). Lazy-loaded. */
const LetterBody: React.FC<{ doc: unknown[] }> = ({ doc }) => {
  useEffect(ensureLetterFonts, []);
  const editor = useCreateBlockNote({
    schema: letterSchema,
    initialContent: doc.length ? (doc as PartialBlock<typeof letterSchema.blockSchema>[]) : undefined,
    resolveFileUrl: resolveMedia,
  });
  return <BlockNoteView editor={editor} editable={false} theme="dark" className="letter-body" />;
};

export default LetterBody;
