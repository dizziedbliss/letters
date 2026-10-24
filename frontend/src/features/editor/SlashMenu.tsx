import React, { useState } from 'react';
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core';
import { SuggestionMenuController, getDefaultReactSlashMenuItems, useBlockNoteEditor, type DefaultReactSuggestionItem } from '@blocknote/react';
import { MediaPicker, type MediaTab, type PickedMedia } from '../media/MediaPicker';

// Things these pages don't need (files, audio, code...): keep the menu short and friendly
const HIDDEN = new Set(['Image', 'Video', 'Audio', 'File', 'Code Block', 'Table', 'Page Break', 'Heading 4', 'Heading 5', 'Heading 6', 'Toggle Heading 1', 'Toggle Heading 2', 'Toggle Heading 3']);

const Icon: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className="font-mono text-[11px] font-bold tracking-tight">{children}</span>;

/** The "/" menu: BlockNote's basics minus the clutter, plus GIF (KLIPY) and Embed. */
export const SlashMenu: React.FC<{ folder: 'letters' | 'intro' }> = ({ folder }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = useBlockNoteEditor<any, any, any>();
  // which block the picked image goes after, and which picker tab to open on
  const [picker, setPicker] = useState<{ at: string; tab: MediaTab } | null>(null);
  const openPicker = (tab: MediaTab) => setPicker({ at: editor.getTextCursorPosition().block.id, tab });

  const items = (): DefaultReactSuggestionItem[] => [
    ...getDefaultReactSlashMenuItems(editor).filter((i) => !HIDDEN.has(i.title)),
    {
      title: 'Image',
      subtext: 'Upload a photo or paste a link',
      aliases: ['image', 'photo', 'picture', 'img', 'upload', 'pic'],
      group: 'Media',
      icon: <Icon>IMG</Icon>,
      onItemClick: () => openPicker('upload'),
    },
    {
      title: 'GIF',
      subtext: 'Search GIFs and stickers',
      aliases: ['gif', 'giphy', 'klipy', 'sticker', 'meme'],
      group: 'Media',
      icon: <Icon>GIF</Icon>,
      onItemClick: () => openPicker('gifs'),
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
      {picker && (
        <MediaPicker
          title="Add an image"
          tabs={['upload', 'gifs', 'stickers', 'link']}
          initialTab={picker.tab}
          folder={folder}
          onClose={() => setPicker(null)}
          onPick={(m: PickedMedia) => {
            const at = editor.getBlock(picker.at);
            const image = { type: 'image', props: { url: m.src, ...(m.width ? { previewWidth: Math.min(m.width, 360) } : {}) } };
            // fill the empty line the "/" was typed on, otherwise add after it
            if (at && Array.isArray(at.content) && at.content.length === 0) editor.updateBlock(at, image);
            else if (at) editor.insertBlocks([image], at, 'after');
            setPicker(null);
          }}
        />
      )}
    </>
  );
};

export default SlashMenu;
