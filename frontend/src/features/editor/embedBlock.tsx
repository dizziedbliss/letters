import { createReactBlockSpec } from '@blocknote/react';
import { EmbedView } from './EmbedView';

/** Embed block shared by letters and the intro page: YouTube, Spotify, or a link card. */
export const EmbedBlock = createReactBlockSpec(
  { type: 'embed', propSchema: { url: { default: '' } }, content: 'none' },
  { render: ({ block, editor }) => <EmbedView block={block} editor={editor} /> }
);
