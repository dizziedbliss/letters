import React from 'react';
import type { PartialBlock } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import '@blocknote/ariakit/style.css';
import './letter-body.css';

/** A letter body, rendered read-only by BlockNote (the same engine that edits it). Lazy-loaded. */
const LetterBody: React.FC<{ doc: unknown[] }> = ({ doc }) => {
  const editor = useCreateBlockNote({
    initialContent: doc.length ? (doc as PartialBlock[]) : undefined,
  });
  return <BlockNoteView editor={editor} editable={false} theme="dark" className="letter-body" />;
};

export default LetterBody;
