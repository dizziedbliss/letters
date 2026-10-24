import React, { useState } from 'react';
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core';
import { SuggestionMenuController, getDefaultReactSlashMenuItems, useBlockNoteEditor, type DefaultReactSuggestionItem } from '@blocknote/react';
import { GifPicker } from '../media/GifPicker';

// Things these pages don't need (files, audio, code...): keep the menu short and friendly
const HIDDEN = new Set(['Video', 'Audio', 'File', 'Code Block', 'Table', 'Page Break', 'Heading 4', 'Heading 5', 'Heading 6', 'Toggle Heading 1', 'Toggle Heading 2', 'Toggle Heading 3']);

const Icon: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className="font-mono text-[11px] font-bold tracking-tight">{children}</span>;

/** The "/" menu: BlockNote's basics minus the clutter, plus GIF (KLIPY) and Embed. */
export const SlashMenu: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = useBlockNoteEditor<any, any, any>();
  const [gifFor, setGifFor] = useState<string | null>(null); // block id the GIF goes after

  const items = (): DefaultReactSuggestionItem[] => [
    ...getDefaultReactSlashMenuItems(editor).filter((i) => !HIDDEN.has(i.title)),
    {
      title: 'GIF',
      subtext: 'Search GIFs and stickers',
      aliases: ['gif', 'giphy', 'klipy', 'sticker', 'meme'],
      group: 'Media',
      icon: <Icon>GIF</Icon>,
      onItemClick: () => setGifFor(editor.getTextCursorPosition().block.id),
    },
    {
      title: 'Embed',
      subtext: 'YouTube, Spotify or any link',
      aliases: ['youtube', 'spotify', 'link', 'video', 'song', 'music', 'embed'],
      group: 'Media',
      icon: <Icon>▶</Icon>,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'embed' }),
    },
  ];

  return (
    <>
      <SuggestionMenuController triggerCharacter="/" getItems={async (query) => filterSuggestionItems(items(), query)} />
      {gifFor && (
        <GifPicker
          onClose={() => setGifFor(null)}
          onPick={(gif) => {
            const at = editor.getBlock(gifFor);
            const image = { type: 'image', props: { url: gif.url, previewWidth: Math.min(gif.width, 360) } };
            // fill the empty line the "/" was typed on, otherwise add after it
            if (at && Array.isArray(at.content) && at.content.length === 0) editor.updateBlock(at, image);
            else if (at) editor.insertBlocks([image], at, 'after');
            setGifFor(null);
          }}
        />
      )}
    </>
  );
};

export default SlashMenu;
