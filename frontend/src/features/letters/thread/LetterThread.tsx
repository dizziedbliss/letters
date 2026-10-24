import React, { useCallback, useEffect, useRef, useState } from 'react';
import { currentUserId, profileNames, threadsApi, type Reply, type Thread } from '../../../utils/api';
import { MediaPicker, type PickedMedia } from '../../media/MediaPicker';
import { useConfirm } from '../../../components/common/useConfirm';
import { ReactionBar } from './ReactionBar';
import { chipsFor } from './reactions';

const POLL_MS = 15000; // while the thread is on screen

const when = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

/**
 * The conversation under a sent letter: reactions on the letter, then replies (text, GIFs,
 * stickers), each with its own reactions. A dark card, so it reads on any page background.
 */
export const LetterThread: React.FC<{ letterId: number }> = ({ letterId }) => {
  const [thread, setThread] = useState<Thread | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [picker, setPicker] = useState<'gifs' | 'stickers' | null>(null);
  const [failed, setFailed] = useState(false);
  const { confirm, dialog } = useConfirm();
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    threadsApi
      .get(letterId)
      .then((t) => {
        setThread(t);
        setFailed(false);
        threadsApi.markSeen(letterId).catch(() => {});
      })
      .catch(() => setFailed(true));
  }, [letterId]);

  useEffect(() => {
    load();
    currentUserId().then(setMe).catch(() => {});
    profileNames().then(setNames).catch(() => {});
    const poll = window.setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const toggle = async (replyId: number | null, emoji: string) => {
    if (!thread || !me) return;
    // show it straight away; the database has the final word
    const mineIdx = thread.reactions.findIndex((r) => r.replyId === replyId && r.userId === me && r.emoji === emoji);
    setThread({
      ...thread,
      reactions: mineIdx >= 0 ? thread.reactions.filter((_, i) => i !== mineIdx) : [...thread.reactions, { replyId, userId: me, emoji }],
    });
    try {
      await threadsApi.toggleReaction(letterId, replyId, emoji);
    } catch {
      load();
    }
  };

  const send = async (kind: Reply['kind'], body: string | null, media: PickedMedia | null) => {
    setSending(true);
    try {
      const reply = await threadsApi.reply(letterId, kind, body, media && { url: media.src, width: media.width, height: media.height });
      setThread((t) => (t ? { ...t, replies: [...t.replies, reply] } : t));
      if (kind === 'text') setText('');
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: number) => {
    if (!(await confirm({ title: 'Delete this reply?', confirmLabel: 'Delete', danger: true }))) return;
    setThread((t) => (t ? { ...t, replies: t.replies.filter((r) => r.id !== id) } : t));
    threadsApi.deleteReply(id).catch(load);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (body && !sending) send('text', body, null);
  };

  return (
    <section className="rounded-3xl bg-[#151515]/90 backdrop-blur-md text-white p-4 sm:p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] space-y-4">
      {thread && <ReactionBar chips={chipsFor(thread.reactions, null, me)} onToggle={(e) => toggle(null, e)} label="REACT" />}

      {thread && thread.replies.length > 0 && (
        <ol className="space-y-3">
          {thread.replies.map((r, i) => {
            const mine = r.authorId === me;
            const firstOfRun = i === 0 || thread.replies[i - 1].authorId !== r.authorId;
            return (
              <li key={r.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {firstOfRun && (
                  <span className="font-mono text-[10px] tracking-[0.18em] text-white/40 mb-1 px-1">
                    {(names[r.authorId] ?? (mine ? 'you' : 'them')).toUpperCase()}
                  </span>
                )}
                <div className={`group relative max-w-[85%] ${mine ? 'pl-6' : 'pr-6'}`}>
                  {r.kind === 'text' ? (
                    <p
                      className={`px-3.5 py-2 rounded-2xl font-body text-[17px] leading-snug whitespace-pre-wrap break-words ${
                        mine ? 'bg-brand-purple rounded-br-md' : 'bg-white/[0.1] rounded-bl-md'
                      }`}
                    >
                      {r.body}
                    </p>
                  ) : (
                    <img
                      src={r.media?.url}
                      alt={r.kind === 'gif' ? 'GIF' : 'sticker'}
                      loading="lazy"
                      width={r.media?.width}
                      height={r.media?.height}
                      className={`h-auto ${r.kind === 'sticker' ? 'w-32' : 'w-56 rounded-2xl'}`}
                    />
                  )}
                  {mine && (
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      aria-label="Delete reply"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full font-mono text-[10px] text-white/30 hover:text-rose-300 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className={`mt-1 flex items-center gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                  <span className="font-mono text-[9px] tracking-wider text-white/30 px-1">{when(r.createdAt)}</span>
                  <ReactionBar chips={chipsFor(thread.reactions, r.id, me)} onToggle={(e) => toggle(r.id, e)} align={mine ? 'end' : 'start'} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div ref={endRef} />

      {failed && <p className="font-body text-sm text-rose-300">couldn't reach the thread, check your connection?</p>}

      <form onSubmit={submit} className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
          }}
          rows={1}
          maxLength={2000}
          placeholder="reply..."
          className="flex-1 min-w-0 max-h-32 resize-none rounded-2xl bg-white/[0.08] px-3.5 py-2.5 font-body text-[17px] placeholder:text-white/35 outline-none focus:bg-white/[0.12] [field-sizing:content]"
        />
        <button type="button" onClick={() => setPicker('gifs')} className="h-11 px-2.5 rounded-xl bg-white/[0.08] font-mono text-[10px] tracking-wider text-white/75 hover:bg-white/[0.14] cursor-pointer">
          GIF
        </button>
        <button type="button" onClick={() => setPicker('stickers')} aria-label="Sticker" className="h-11 w-11 rounded-xl bg-white/[0.08] text-lg hover:bg-white/[0.14] cursor-pointer">
          ✿
        </button>
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Send"
          className="h-11 w-11 rounded-xl bg-brand-cyan text-black flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4 fill-none stroke-current stroke-[2.5]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </form>

      {picker && (
        <MediaPicker
          title={picker === 'gifs' ? 'Reply with a GIF' : 'Reply with a sticker'}
          tabs={[picker]}
          folder="letters"
          onPick={(m) => {
            setPicker(null);
            send(picker === 'gifs' ? 'gif' : 'sticker', null, m);
          }}
          onClose={() => setPicker(null)}
        />
      )}
      {dialog}
    </section>
  );
};

export default LetterThread;
