import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageTransition } from '../components/transition/context';
import { groupsApi, isAuthError, lettersApi, logout as apiLogout, otherName, threadsApi, type LetterGroup, type MyLetter } from '../utils/api';
import { LetterSettings } from '../features/letters/write/LetterSettings';
import { GroupsSheet } from '../features/letters/write/GroupsSheet';
import { useToast } from '../components/common/Toast';
import { useConfirm } from '../components/common/useConfirm';
import { MediaPicker } from '../features/media/MediaPicker';
import { LetterBanner } from '../features/letters/LetterBanner';
import { DEFAULT_LOOK, type Banner, type LetterLook } from '../features/letters/banner';
import { LetterCanvas } from '../features/letters/LetterCanvas';
import { PageBackgroundImage } from '../features/letters/PageBackground';
import { QuickBar, type QuickAction } from '../features/letters/write/QuickBar';
import { insertAtCursor } from '../features/letters/write/insert';
import type { LetterEditorInstance } from '../features/letters/LetterEditor';
import { StickerLayer } from '../features/intro/stickers/StickerLayer';
import { PagePanel } from '../features/intro/editor/Palettes';
import { Sheet } from '../features/intro/editor/ui';
import { DESIGN_WIDTH, newId, themeFor, type Sticker } from '../features/intro/doc';
import type { MediaTab } from '../features/media/MediaPicker';

// BlockNote is big; load it only once a letter is open for editing
const LetterThread = lazy(() => import('../features/letters/thread/LetterThread'));
const LetterEditor = lazy(() => import('../features/letters/LetterEditor'));

const SAVE_MS = 800;
const SECTIONS = [
  { key: 'random', title: 'Random' },
  { key: 'open_when', title: "Open when you're…" },
] as const;

const RULE_BADGE = { date: 'DATE', after: 'AFTER', manual: 'BY ME' } as const;

/** Write letters for the other person: list by section, Notion-style editor, lock settings. */
export const WritePage: React.FC = () => {
  const navigate = useNavigate();
  const { go } = usePageTransition();
  const [letters, setLetters] = useState<MyLetter[] | null>(null);
  const [groups, setGroups] = useState<LetterGroup[]>([]);
  const [reader, setReader] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [body, setBody] = useState<{ id: number; doc: unknown[]; banner: Banner | null; look: LetterLook | null } | null>(null);
  const [bannerPicker, setBannerPicker] = useState(false);
  const [insertPicker, setInsertPicker] = useState<MediaTab | null>(null);
  const [stickerPicker, setStickerPicker] = useState(false);
  const [bgSheet, setBgSheet] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const editorRef = useRef<LetterEditorInstance | null>(null);
  const focusTitleFor = useRef<number | null>(null); // a just-created letter wants its title focused
  const [saveFlash, setSaveFlash] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showSettings, setShowSettings] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [unsaved, setUnsaved] = useState(0);
  const [unread, setUnread] = useState<Map<number, number>>(new Map());
  const { show: showToast, node: toastNode } = useToast();
  const { confirm, dialog } = useConfirm();

  // ---- debounced saving: one timer per thing being saved, flushed on switch/leave ----
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const jobs = useRef(new Map<string, () => Promise<unknown>>());
  const metaPatches = useRef(new Map<number, Partial<MyLetter>>());

  const fail = useCallback(
    (err: unknown) => {
      if (isAuthError(err)) navigate('/', { replace: true });
      else showToast(err instanceof Error ? `couldn't save: ${err.message}` : 'something went wrong, try again?', 'error');
    },
    [navigate, showToast]
  );

  const run = useCallback(
    (key: string) => {
      clearTimeout(timers.current.get(key));
      timers.current.delete(key);
      const job = jobs.current.get(key);
      jobs.current.delete(key);
      if (!job) return Promise.resolve();
      return job()
        .catch(fail)
        .finally(() => setUnsaved(jobs.current.size));
    },
    [fail]
  );

  const schedule = (key: string, job: () => Promise<unknown>, ms = SAVE_MS) => {
    clearTimeout(timers.current.get(key));
    jobs.current.set(key, job);
    timers.current.set(key, setTimeout(() => run(key), ms));
    setUnsaved(jobs.current.size);
  };

  const flushAll = useCallback(() => Promise.all([...jobs.current.keys()].map(run)), [run]);

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flushAll();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      flushAll();
    };
  }, [flushAll]);

  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  // ---- load ----
  useEffect(() => {
    Promise.all([lettersApi.mine(), groupsApi.mine()])
      .then(([l, g]) => {
        setLetters(l);
        setGroups(g);
        // opened from a reply notification: /write?letter=12
        const want = Number(new URLSearchParams(window.location.search).get('letter'));
        if (want && l.some((x) => x.id === want)) setSelectedId(want);
      })
      .catch(fail);
    otherName().then(setReader).catch(() => {});
    threadsApi.unread().then(setUnread).catch(() => {});
  }, [fail]);

  // load the body whenever a different letter is opened
  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    lettersApi
      .body(selectedId)
      .then(({ doc, banner, look }) => !cancelled && setBody({ id: selectedId, doc, banner, look }))
      .catch(fail);
    return () => {
      cancelled = true;
    };
  }, [selectedId, fail]);

  const selected = letters?.find((l) => l.id === selectedId) ?? null;

  useEffect(() => {
    if (body && focusTitleFor.current === body.id) {
      focusTitleFor.current = null;
      requestAnimationFrame(() => document.getElementById('letter-title')?.focus());
    }
  }, [body]);

  // ---- edits ----
  const patchLetter = (id: number, patch: Partial<MyLetter>, ms = SAVE_MS) => {
    if ('title' in patch || 'greeting' in patch) markEdited(id);
    setLetters((ls) => ls?.map((l) => (l.id === id ? { ...l, ...patch } : l)) ?? ls);
    metaPatches.current.set(id, { ...metaPatches.current.get(id), ...patch });
    schedule(
      `meta:${id}`,
      async () => {
        const p = metaPatches.current.get(id) ?? {};
        metaPatches.current.delete(id);
        if ('title' in p) p.title = p.title?.trim() || 'untitled';
        const saved = await lettersApi.updateMeta(id, p);
        // the database may move it to another group when the section changes
        setLetters((ls) => ls?.map((l) => (l.id === id ? { ...l, groupId: saved.groupId, updatedAt: saved.updatedAt } : l)) ?? ls);
      },
      ms
    );
  };

  // A sent letter that changes shows "edited" (the database decides for real; this is just the header)
  const markEdited = (id: number) =>
    setLetters((ls) => ls?.map((l) => (l.id === id && l.publishedAt && !l.editedAt ? { ...l, editedAt: new Date().toISOString() } : l)) ?? ls);

  const saveBody = (id: number, doc: unknown[]) => {
    markEdited(id);
    schedule(`body:${id}`, () => lettersApi.saveBody(id, doc));
  };

  const open = (id: number) => {
    flushAll();
    setUnread((u) => {
      if (!u.has(id)) return u;
      const next = new Map(u);
      next.delete(id);
      return next;
    });
    setBody(null);
    setSelectedId(id);
    setShowSettings(false);
  };

  const create = async (section: MyLetter['section']) => {
    try {
      const letter = await lettersApi.create(section);
      setLetters((ls) => [letter, ...(ls ?? [])]);
      focusTitleFor.current = letter.id;
      open(letter.id);
    } catch (err) {
      fail(err);
    }
  };

  const remove = async () => {
    if (!selected) return;
    const ok = await confirm({ title: `Delete "${selected.title || 'untitled'}"?`, body: "This can't be undone.", confirmLabel: 'Delete', cancelLabel: 'Keep it', danger: true });
    if (!ok) return;
    jobs.current.delete(`meta:${selected.id}`);
    jobs.current.delete(`body:${selected.id}`);
    try {
      await lettersApi.remove(selected.id);
      setLetters((ls) => ls?.filter((l) => l.id !== selected.id) ?? ls);
      setSelectedId(null);
      setBody(null);
    } catch (err) {
      fail(err);
    }
  };

  const unlock = async () => {
    if (!selected) return;
    const ok = await confirm({ title: `Unlock this for ${reader ?? 'them'}?`, body: "They can open it right away. It can't be locked again.", confirmLabel: 'Unlock' });
    if (!ok) return;
    try {
      await lettersApi.unlock(selected.id);
      setLetters((ls) => ls?.map((l) => (l.id === selected.id ? { ...l, unlockedByWriter: true } : l)) ?? ls);
      showToast(`unlocked ✓ ${reader ?? 'they'} can open it now`);
    } catch (err) {
      fail(err);
    }
  };

  const send = async () => {
    if (!selected) return;
    const ok = await confirm({ title: `Send to ${reader ?? 'them'}?`, body: `"${selected.title || 'untitled'}" shows up in their letters right away.`, confirmLabel: 'Send ♡' });
    if (!ok) return;
    flushAll();
    try {
      const publishedAt = await lettersApi.publish(selected.id);
      setLetters((ls) => ls?.map((l) => (l.id === selected.id ? { ...l, publishedAt } : l)) ?? ls);
      showToast(`sent ✓ it's in ${reader ?? 'their'}'s letters now`);
    } catch (err) {
      fail(err);
    }
  };

  const unsend = async () => {
    if (!selected || selected.openedAt) return;
    try {
      await lettersApi.unpublish(selected.id);
      setLetters((ls) => ls?.map((l) => (l.id === selected.id ? { ...l, publishedAt: null } : l)) ?? ls);
      showToast('back to drafts, only you can see it');
    } catch (err) {
      fail(err);
    }
  };

  const saveNow = async () => {
    setSaveFlash('saving');
    await flushAll();
    setSaveFlash('saved');
    setTimeout(() => setSaveFlash('idle'), 1800);
    showToast(selected?.publishedAt ? 'saved ✓ changes show up for them too' : 'draft saved ✓');
  };

  const look = body?.look ?? DEFAULT_LOOK;
  const setLook = (next: LetterLook) => {
    if (!body) return;
    const id = body.id;
    setBody({ ...body, look: next });
    markEdited(id);
    schedule(`look:${id}`, () => lettersApi.saveLook(id, next), 500);
  };
  const setStickers = (stickers: Sticker[]) => setLook({ ...look, stickers });

  const onEditorReady = useCallback((editor: LetterEditorInstance) => {
    editorRef.current = editor;
  }, []);

  const quick = (a: QuickAction) => {
    const editor = editorRef.current;
    if (a === 'banner') return setBannerPicker(true);
    if (a === 'sticker') return setStickerPicker(true);
    if (a === 'background') return setBgSheet(true);
    if (a === 'image' || a === 'gif') return setInsertPicker(a === 'image' ? 'upload' : 'gifs');
    if (!editor) return;
    if (a === 'embed') insertAtCursor(editor, { type: 'embed' });
    if (a === 'heading') insertAtCursor(editor, { type: 'heading', props: { level: 2 } });
    if (a === 'quote') insertAtCursor(editor, { type: 'quote' });
    if (a === 'list') insertAtCursor(editor, { type: 'bulletListItem' });
    if (a === 'divider') insertAtCursor(editor, { type: 'divider' });
  };

  const addSticker = (value: string, width?: number) => {
    const w = width ? Math.min(160, Math.max(80, Math.round(width * 0.6))) : 140;
    const sticker: Sticker = {
      id: newId(),
      kind: 'image',
      value,
      width: w,
      x: DESIGN_WIDTH - w - 16,
      y: 40 + (look.stickers.length % 5) * 30,
      rotation: -4,
      z: Math.max(0, ...look.stickers.map((st) => st.z)) + 1,
    };
    setStickers([...look.stickers, sticker]);
    setSelectedSticker(sticker.id);
  };

  const setBanner = (banner: Banner | null) => {
    if (!body) return;
    const id = body.id;
    setBody({ ...body, banner });
    markEdited(id);
    schedule(`banner:${id}`, () => lettersApi.saveBanner(id, banner), 400);
  };

  const logout = async () => {
    flushAll();
    await apiLogout().catch(() => {});
    navigate('/', { replace: true });
  };

  const navBtn = 'text-white/50 hover:text-white text-sm font-body transition-colors cursor-pointer';
  const settings = selected && (
    <LetterSettings
      letter={selected}
      letters={letters ?? []}
      groups={groups}
      reader={reader}
      onPatch={(p) => patchLetter(selected.id, p, 200)}
      onUnlock={unlock}
      onUnsend={unsend}
      onManageGroups={() => setShowGroups(true)}
    />
  );

  return (
    <div className="min-h-dvh bg-[#151515] text-white md:flex selection:bg-brand-cyan selection:text-black">
      {/* ---- letter list ---- */}
      <aside
        className={`${selected ? 'hidden' : 'flex'} md:flex flex-col w-full md:w-[300px] md:h-dvh md:sticky md:top-0 border-r border-white/10 shrink-0`}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-3">
          <h1 className="font-heading font-medium text-2xl">
            Write <span className="font-body italic font-normal">for {reader ?? '...'}</span>
          </h1>
          <div className="flex gap-4">
            <button type="button" onClick={() => (flushAll(), go('/home', { label: 'Home', code: '00' }))} className={navBtn}>
              home
            </button>
            <button type="button" onClick={logout} className={navBtn}>
              log out
            </button>
          </div>
        </div>

        <div className="px-5 pb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => (flushAll(), navigate('/write/intro'))}
            className="h-10 rounded-xl bg-white/[0.06] hover:bg-white/10 font-mono text-[10px] tracking-wider cursor-pointer"
          >
            THEIR PAGE ✎
          </button>
          <button
            type="button"
            onClick={() => setShowGroups(true)}
            className="h-10 rounded-xl bg-white/[0.06] hover:bg-white/10 font-mono text-[10px] tracking-wider cursor-pointer"
          >
            LIMITS ⚙
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-8">
          {!letters && <p className="px-3 py-2 text-white/40 font-body italic">loading...</p>}
          {letters &&
            SECTIONS.map((sec) => {
              const list = letters.filter((l) => l.section === sec.key);
              return (
                <section key={sec.key} className="mt-4">
                  <div className="flex items-center justify-between px-2 mb-1.5">
                    <h2 className={sec.key === 'random' ? 'font-display uppercase text-lg tracking-wide' : 'font-body italic text-xl'}>{sec.title}</h2>
                    <button
                      type="button"
                      onClick={() => create(sec.key)}
                      className="h-8 px-3 rounded-full bg-brand-cyan text-black font-mono text-[10px] tracking-wider font-bold cursor-pointer hover:shadow-[0_0_14px_rgba(0,216,255,0.5)]"
                    >
                      + NEW
                    </button>
                  </div>
                  {!list.length && <p className="px-2 py-1 font-body italic text-sm text-white/35">nothing here yet</p>}
                  <ul className="space-y-1">
                    {list.map((l) => (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => open(l.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                            l.id === selectedId ? 'bg-white/10' : 'hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-body text-lg leading-snug truncate flex-1">{l.title || 'untitled'}</span>
                            <span className="shrink-0 flex gap-1 font-mono text-[9px] tracking-wider">
                              {unread.has(l.id) && <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white">NEW ♡</span>}
                              {l.sealed && <span className="px-1.5 py-0.5 rounded bg-brand-purple/40 text-white/90">SEALED</span>}
                              {l.rule && <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/70">{RULE_BADGE[l.rule.kind]}</span>}
                            </span>
                          </div>
                          <div
                            className={`font-mono text-[10px] tracking-wider mt-0.5 ${
                              !l.publishedAt ? 'text-amber-300/80' : l.openedAt ? 'text-brand-cyan' : 'text-white/35'
                            }`}
                          >
                            {!l.publishedAt
                              ? 'DRAFT · NOT SENT'
                              : l.openedAt
                                ? `READ ${new Date(l.openedAt).toLocaleDateString([], { day: 'numeric', month: 'short' }).toUpperCase()} ♡`
                                : 'SENT · NOT OPENED YET'}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
        </div>
      </aside>

      {/* ---- editor ---- */}
      <main className={`${selected ? 'flex' : 'hidden'} md:flex flex-1 min-w-0`}>
        {!selected ? (
          <div className="hidden md:flex flex-1 items-center justify-center text-white/30 font-body italic text-xl">
            pick a letter or start a new one
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <div className="sticky top-0 z-20 bg-[#151515]/90 backdrop-blur border-b border-white/5">
                <div className="max-w-[720px] mx-auto h-14 px-4 flex items-center gap-3">
                  <button type="button" onClick={() => (flushAll(), setSelectedId(null))} className={`md:hidden ${navBtn}`}>
                    &larr; letters
                  </button>
                  <span className="flex-1 min-w-0 truncate font-mono text-[10px] tracking-[0.2em] text-white/40">
                    {selected.publishedAt ? (selected.editedAt ? 'SENT · EDITED' : 'SENT') : 'DRAFT'} · {unsaved ? 'SAVING…' : 'SAVED'}
                  </span>
                  <button
                    type="button"
                    onClick={saveNow}
                    disabled={saveFlash === 'saving'}
                    className={`h-9 px-3 rounded-full font-mono text-[10px] tracking-wider cursor-pointer transition-colors ${
                      saveFlash === 'saved' ? 'bg-brand-cyan text-black' : 'bg-white/[0.08] text-white/85 hover:bg-white/15'
                    }`}
                  >
                    {saveFlash === 'saving' ? 'SAVING…' : saveFlash === 'saved' ? 'SAVED ✓' : 'SAVE'}
                  </button>
                  {!selected.publishedAt && (
                    <button
                      type="button"
                      onClick={send}
                      className="h-9 px-4 rounded-full bg-brand-cyan text-black font-mono text-[10px] tracking-wider font-bold cursor-pointer hover:shadow-[0_0_16px_rgba(0,216,255,0.5)]"
                    >
                      SEND ♡
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowSettings((s) => !s)}
                    className={`lg:hidden h-9 px-3 rounded-full font-mono text-[10px] tracking-wider cursor-pointer ${
                      showSettings ? 'bg-brand-cyan text-black' : 'bg-white/[0.08] text-white/80'
                    }`}
                  >
                    SETTINGS
                  </button>
                  <button type="button" onClick={remove} className="h-9 px-3 rounded-full bg-white/[0.06] text-rose-300 font-mono text-[10px] tracking-wider cursor-pointer">
                    DELETE
                  </button>
                </div>
              </div>

              <QuickBar onAction={quick} hasBanner={!!body?.banner} />

              {showSettings && <div className="lg:hidden max-w-[720px] mx-auto px-5 pt-5 pb-2 border-b border-white/5 bg-[#151515]">{settings}</div>}

              <div
                className="relative min-h-[calc(100dvh-104px)] pt-6 pb-24"
                style={{ backgroundColor: themeFor(look.background).bg }}
                onClick={() => setSelectedSticker(null)}
              >
                {themeFor(look.background).image && <PageBackgroundImage src={themeFor(look.background).image!} />}
                {body?.id === selected.id ? (
                  <LetterCanvas
                    stickers={look.stickers}
                    ready
                    overlay={({ scale, frameHeight }) => (
                      <StickerLayer
                        stickers={look.stickers}
                        scale={scale}
                        frameHeight={frameHeight}
                        snap
                        selectedId={selectedSticker}
                        onSelect={setSelectedSticker}
                        onChange={setStickers}
                      />
                    )}
                  >
                    {body.banner && (
                      <div className="mb-6">
                        <LetterBanner banner={body.banner} onChange={setBanner} onChangeImage={() => setBannerPicker(true)} onRemove={() => setBanner(null)} />
                      </div>
                    )}
                    <input
                      id="letter-title"
                      value={selected.title === 'untitled' ? '' : selected.title}
                      onChange={(e) => patchLetter(selected.id, { title: e.target.value })}
                      placeholder={selected.section === 'open_when' ? 'open when you’re… (e.g. sad)' : 'title (shows in the list)'}
                      maxLength={200}
                      className="w-full bg-transparent outline-none font-heading font-medium text-4xl tracking-tight placeholder:opacity-30"
                      style={{ color: themeFor(look.background).strong }}
                    />
                    <input
                      value={selected.greeting}
                      onChange={(e) => patchLetter(selected.id, { greeting: e.target.value })}
                      placeholder={`greeting (optional), e.g. hi ${reader?.toLowerCase() ?? 'you'},`}
                      maxLength={200}
                      className="w-full bg-transparent outline-none font-body italic text-2xl mt-4 placeholder:opacity-30"
                      style={{ color: themeFor(look.background).ink }}
                    />
                    <div className="mt-6 -ml-[42px]">
                      <Suspense fallback={<p className="pl-[42px] font-body italic opacity-40">loading editor...</p>}>
                        <LetterEditor
                          key={selected.id}
                          initial={body.doc}
                          ink={themeFor(look.background).ink}
                          onReady={onEditorReady}
                          onChange={(doc) => saveBody(selected.id, doc)}
                        />
                      </Suspense>
                    </div>
                  </LetterCanvas>
                ) : (
                  <p className="text-center font-body italic text-white/40">loading...</p>
                )}
                {selected.publishedAt && body?.id === selected.id && (
                  <div className="relative max-w-[480px] mx-auto px-4 mt-10" onClick={(e) => e.stopPropagation()}>
                    <Suspense fallback={null}>
                      <LetterThread letterId={selected.id} />
                    </Suspense>
                  </div>
                )}
              </div>
            </div>

            <aside className="hidden lg:block w-[320px] shrink-0 border-l border-white/10 h-dvh sticky top-0 overflow-y-auto px-5 py-6">
              <p className="font-display uppercase text-xl tracking-wide mb-5">Locks & settings</p>
              {settings}
            </aside>
          </>
        )}
      </main>

      {showGroups && <GroupsSheet groups={groups} onChange={setGroups} onClose={() => setShowGroups(false)} />}
      {bannerPicker && (
        <MediaPicker
          title="Letter banner"
          tabs={['upload', 'gifs', 'link']}
          folder="letters"
          onClose={() => setBannerPicker(false)}
          onPick={(m) => {
            setBanner({ src: m.src, height: body?.banner?.height ?? 'md', focus: body?.banner?.focus ?? 50 });
            setBannerPicker(false);
          }}
        />
      )}
      {insertPicker && (
        <MediaPicker
          title="Add an image"
          tabs={['upload', 'gifs', 'stickers', 'link']}
          initialTab={insertPicker}
          folder="letters"
          onClose={() => setInsertPicker(null)}
          onPick={(m) => {
            if (editorRef.current) insertAtCursor(editorRef.current, { type: 'image', props: { url: m.src, ...(m.width ? { previewWidth: Math.min(m.width, 360) } : {}) } });
            setInsertPicker(null);
          }}
        />
      )}
      {stickerPicker && (
        <MediaPicker
          title="Add a sticker"
          tabs={['stickers', 'gifs', 'upload', 'link']}
          folder="letters"
          onClose={() => setStickerPicker(false)}
          onPick={(m) => {
            addSticker(m.src, m.width);
            setStickerPicker(false);
          }}
        />
      )}
      {bgSheet && (
        <Sheet title="Background" onClose={() => setBgSheet(false)}>
          <PagePanel background={look.background} setBackground={(background) => setLook({ ...look, background })} folder="letters" />
        </Sheet>
      )}
      {toastNode}
      {dialog}
    </div>
  );
};

export default WritePage;
