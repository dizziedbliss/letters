import React, { useState } from 'react';
import { embedUrl, isUrl } from './embed';

/** A YouTube/Spotify player, or a tidy link card for anything else. Paste a link while editing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EmbedView: React.FC<{ block: any; editor: any }> = ({ block, editor }) => {
  const url: string = block.props.url;
  const [draft, setDraft] = useState('');

  if (!url) {
    if (!editor.isEditable) return null;
    return (
      <div className="w-full flex gap-2" contentEditable={false}>
        <input
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && isUrl(draft)) editor.updateBlock(block, { props: { url: draft.trim() } });
          }}
          placeholder="paste a YouTube, Spotify or any link, then Enter"
          className="flex-1 min-w-0 h-11 rounded-xl bg-white/[0.07] px-4 outline-none font-body text-base text-white placeholder:text-white/35"
        />
        <button
          type="button"
          disabled={!isUrl(draft)}
          onClick={() => editor.updateBlock(block, { props: { url: draft.trim() } })}
          className="h-11 px-4 rounded-xl bg-brand-cyan text-black font-mono text-[11px] tracking-wider font-bold disabled:opacity-30 cursor-pointer"
        >
          EMBED
        </button>
      </div>
    );
  }

  const player = embedUrl(url);
  if (player) {
    const spotify = player.includes('spotify.com');
    return (
      <div className="w-full" contentEditable={false}>
        <iframe
          src={player}
          title="embedded player"
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
          className="w-full rounded-xl border-0"
          style={spotify ? { height: 152 } : { aspectRatio: '16 / 9' }}
        />
      </div>
    );
  }

  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // keep the raw text
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      contentEditable={false}
      className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 no-underline hover:bg-white/[0.09]"
    >
      <span className="w-9 h-9 shrink-0 rounded-lg bg-brand-purple/60 flex items-center justify-center text-white">↗</span>
      <span className="min-w-0">
        <span className="block font-body text-base truncate" style={{ color: 'var(--bn-colors-editor-text)' }}>
          {host}
        </span>
        <span className="block font-mono text-[10px] text-white/40 truncate">{url}</span>
      </span>
    </a>
  );
};

export default EmbedView;
