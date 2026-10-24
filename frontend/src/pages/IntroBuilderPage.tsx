import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthError, publishTheirPage, saveTheirDraft, theirBuilderState } from '../utils/api';
import { CONTENT_Z, DESIGN_WIDTH, MAX_SCALE, stickersBottom, ensureLettersButton, type Banner, lettersButtonBlock, newId, parseDoc, starterDoc, themeFor, type ContentBlock, type IntroDoc, type Sticker } from '../features/intro/doc';
import { useDocHistory } from '../features/intro/editor/useDocHistory';
import { useDesignScale } from '../features/intro/useDesignScale';
import { StickerLayer } from '../features/intro/stickers/StickerLayer';
import { PagePanel, StickerPalette } from '../features/intro/editor/Palettes';
import { Sheet } from '../features/intro/editor/ui';
import { useMediaUrl } from '../features/intro/useMediaUrl';
import { BannerView } from '../features/intro/BannerView';
import { useToast } from '../components/common/Toast';
import type { IntroEditor } from '../features/intro/IntroBody';

const IntroBody = lazy(() => import('../features/intro/IntroBody'));

const AUTOSAVE_MS = 900;
const topBtn = 'h-9 px-3 rounded-full font-mono text-[11px] tracking-wider transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed';

/**
 * Build the other person's landing page: Notion-style content (same editor as letters),
 * free stickers on top, a background, and the always-present letters button.
 * Text edits are undone by the editor itself; stickers/background by our own history.
 */
export const IntroBuilderPage: React.FC = () => {
  const navigate = useNavigate();
  const { show: showToast, node: toastNode } = useToast();
  const history = useDocHistory(); // background + stickers (content lives in the editor)
  const doc = history.doc;
  const [name, setName] = useState<string | null>(null);
  const [initialContent, setInitialContent] = useState<ContentBlock[] | null>(null);
  const [content, setContent] = useState<ContentBlock[]>([]);
  const editorRef = useRef<IntroEditor | null>(null);
  const lastArea = useRef<'text' | 'page'>('text');
  const [savedJson, setSavedJson] = useState<string | null>(null);
  const [publishedJson, setPublishedJson] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [sheet, setSheet] = useState<'page' | 'stickers' | null>(null);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [snap, setSnap] = useState(true);
  const [grid, setGrid] = useState(false);
  const { outerRef, frameRef, box, frameStyle } = useDesignScale(MAX_SCALE, !!doc && !!initialContent);

  const fail = useCallback(
    (err: unknown) => {
      if (isAuthError(err)) navigate('/', { replace: true });
      else showToast(err instanceof Error ? err.message : 'something went wrong', 'error');
    },
    [navigate, showToast]
  );

  // ---- load: resume the draft, else what's published, else a starter page (v1 pages convert) ----
  useEffect(() => {
    theirBuilderState()
      .then(({ name, draft, published }) => {
        const start = parseDoc(draft) ?? parseDoc(published) ?? starterDoc(name);
        setName(name);
        setContent(start.content);
        setInitialContent(start.content);
        setSavedJson(JSON.stringify(start));
        const pub = parseDoc(published);
        setPublishedJson(pub ? JSON.stringify(pub) : null);
        history.reset(start);
      })
      .catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The full doc as it would be saved
  const composed = useMemo<IntroDoc | null>(() => (doc ? { ...doc, content } : null), [doc, content]);
  const composedJson = useMemo(() => (composed ? JSON.stringify(composed) : null), [composed]);
  const unsaved = !!composedJson && composedJson !== savedJson;
  const unpublished = composedJson !== publishedJson;

  // ---- autosave ----
  useEffect(() => {
    if (!composed || !unsaved) return;
    const t = setTimeout(() => {
      saveTheirDraft(composed)
        .then(() => setSavedJson(JSON.stringify(composed)))
        .catch(fail);
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [composed, unsaved, fail]);

  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  // ---- edits ----
  const onContent = useCallback((next: ContentBlock[]) => {
    lastArea.current = 'text';
    setContent(next);
  }, []);

  const onReady = useCallback((editor: IntroEditor) => {
    editorRef.current = editor;
  }, []);

  const setStickers = (stickers: Sticker[], key?: string) => {
    lastArea.current = 'page';
    history.update((d) => ({ ...d, stickers }), key);
  };

  const addSticker = ({ kind, value, width }: Pick<Sticker, 'kind' | 'value'> & { width?: number }) => {
    if (!doc) return;
    const w = width ?? 120;
    // drop it in the middle of what's on screen
    const rect = frameRef.current?.getBoundingClientRect();
    const midY = rect ? (window.innerHeight / 2 - rect.top) / box.scale : 120;
    const sticker: Sticker = {
      id: newId(),
      kind,
      value,
      width: w,
      x: Math.round((DESIGN_WIDTH - w) / 2),
      y: Math.max(0, Math.round(midY - w / 2)),
      rotation: -4,
      z: Math.max(0, ...doc.stickers.map((s) => s.z)) + 1,
    };
    setStickers([...doc.stickers, sticker]);
    setSelectedSticker(sticker.id);
    setSheet(null);
  };

  const undo = () => (lastArea.current === 'text' && editorRef.current?.undo()) || history.undo();
  const redo = () => (lastArea.current === 'text' && editorRef.current?.redo()) || history.redo();

  const publish = async () => {
    if (!composed || publishing) return;
    if (!window.confirm(`Publish this page for ${name ?? 'them'}? They'll see it straight away.`)) return;
    let finalContent = composed.content;
    if (!finalContent.some((b) => b.type === 'lettersButton')) {
      // the letters button can't go missing: put it back before publishing
      editorRef.current?.insertBlocks([lettersButtonBlock() as never], editorRef.current.document[editorRef.current.document.length - 1], 'after');
      finalContent = ensureLettersButton(finalContent);
      showToast('the letters button is always on the page, put it back at the end');
    }
    const final = { ...composed, content: finalContent };
    setPublishing(true);
    try {
      await saveTheirDraft(final);
      await publishTheirPage(final);
      setSavedJson(JSON.stringify(final));
      setPublishedJson(JSON.stringify(final));
      showToast(`published ✓ ${name ?? 'they'} can see it now`);
    } catch (err) {
      fail(err);
    } finally {
      setPublishing(false);
    }
  };

  const back = () => {
    if (unsaved && !window.confirm('Still saving, leave anyway?')) return;
    navigate('/write');
  };

  if (!doc || !initialContent) {
    return <div className="min-h-dvh bg-[#151515] text-white/50 flex items-center justify-center font-body italic">loading...</div>;
  }

  const theme = themeFor(doc.background);
  const setBackground = (background: IntroDoc['background']) => {
    lastArea.current = 'page';
    history.update((d) => ({ ...d, background }), background.kind === 'color' ? 'bg-color' : undefined);
  };

  const setBanner = (banner: Banner | null, key?: string) => {
    lastArea.current = 'page';
    history.update((d) => ({ ...d, banner }), key);
  };

  const panels = (
    <>
      <PagePanel doc={doc} setBackground={setBackground} setBanner={setBanner} onError={(m) => showToast(m, 'error')} />
      <div className="h-px bg-white/10 my-5" />
      <p className="font-mono text-[10px] tracking-[0.22em] text-white/45 uppercase mb-3">Stickers</p>
      <StickerPalette onAdd={addSticker} onError={(m) => showToast(m, 'error')} />
    </>
  );

  return (
    <div className="min-h-dvh lg:flex" style={{ backgroundColor: theme.bg }}>
      {theme.image && <BackgroundImage src={theme.image} />}

      <div className="relative flex-1 min-w-0">
        {/* top bar */}
        <header className="sticky top-0 z-30 bg-[#151515]/90 backdrop-blur text-white border-b border-white/10">
          <div className="max-w-3xl mx-auto h-14 px-3 flex items-center gap-1.5">
            <button type="button" onClick={back} className={`${topBtn} text-white/60 hover:text-white`} aria-label="Back">
              &larr;
            </button>
            <button type="button" onClick={undo} className={`${topBtn} bg-white/8 hover:bg-white/15`} aria-label="Undo">
              ↶
            </button>
            <button type="button" onClick={redo} className={`${topBtn} bg-white/8 hover:bg-white/15`} aria-label="Redo">
              ↷
            </button>
            <span className="flex-1 min-w-0 truncate text-center font-mono text-[10px] tracking-wider text-white/50">
              {unsaved ? 'SAVING…' : unpublished ? 'DRAFT SAVED' : 'LIVE'}
            </span>
            <button
              type="button"
              onClick={() => setGrid((g) => !g)}
              aria-pressed={grid}
              className={`${topBtn} ${grid ? 'bg-brand-cyan text-black' : 'bg-white/8 hover:bg-white/15'}`}
              title="show grid"
            >
              #
            </button>
            <button
              type="button"
              onClick={() => setSnap((s) => !s)}
              aria-pressed={snap}
              className={`${topBtn} hidden sm:inline-flex items-center ${snap ? 'bg-brand-cyan text-black' : 'bg-white/8 hover:bg-white/15'}`}
              title="snap stickers to grid and guides"
            >
              SNAP
            </button>
            <button type="button" onClick={() => setSheet('stickers')} className={`${topBtn} lg:hidden bg-white/8 hover:bg-white/15`}>
              + ✿
            </button>
            <button type="button" onClick={() => setSheet('page')} className={`${topBtn} lg:hidden bg-white/8 hover:bg-white/15`}>
              PAGE
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={publishing || !unpublished}
              className={`${topBtn} bg-brand-cyan text-black font-bold hover:shadow-[0_0_16px_rgba(0,216,255,0.5)]`}
            >
              {publishing ? '…' : 'PUBLISH'}
            </button>
          </div>
        </header>

        <p className="text-center font-mono text-[10px] tracking-[0.2em] pt-4 opacity-60" style={{ color: theme.strong }}>
          BUILDING {(name ?? 'their').toUpperCase()}&apos;S PAGE · TYPE / FOR BLOCKS · DRAG STICKERS
        </p>

        <main className="relative pt-4 pb-40" onClick={() => setSelectedSticker(null)}>
          <div ref={outerRef} className="relative w-full" style={{ height: box.height || undefined }}>
            <div
              ref={frameRef}
              className="absolute top-0 left-0 px-6 py-4 outline outline-1 outline-dashed"
              style={{
                ...frameStyle,
                minHeight: Math.max(420, stickersBottom(doc)),
                outlineColor: theme.light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.12)',
                backgroundImage: grid
                  ? `linear-gradient(${theme.light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'} 1px, transparent 1px), linear-gradient(90deg, ${theme.light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'} 1px, transparent 1px)`
                  : undefined,
                backgroundSize: grid ? '16px 16px' : undefined,
              }}
            >
              {doc.banner && <BannerView banner={doc.banner} />}
              <div className="relative" style={{ zIndex: CONTENT_Z }}>
              <Suspense fallback={<p className="font-body italic opacity-50">loading editor...</p>}>
                <IntroBody
                  content={initialContent}
                  editable
                  ink={theme.ink}
                  onChange={onContent}
                  onReady={onReady}
                  onFocus={() => {
                    lastArea.current = 'text';
                    setSelectedSticker(null);
                  }}
                />
              </Suspense>
              </div>
              <StickerLayer
                stickers={doc.stickers}
                scale={box.scale}
                frameHeight={box.height / (box.scale || 1)}
                snap={snap}
                selectedId={selectedSticker}
                onSelect={setSelectedSticker}
                onChange={setStickers}
              />
            </div>
          </div>
        </main>
      </div>

      {/* laptop: everything in a roomy side panel */}
      <aside className="hidden lg:block w-[340px] shrink-0 h-dvh sticky top-0 overflow-y-auto bg-[#1c1c1f] text-white border-l border-white/10 px-5 py-6">
        <p className="font-display uppercase text-2xl tracking-wide mb-5">Page</p>
        {panels}
      </aside>

      {sheet === 'page' && (
        <Sheet title="Page" onClose={() => setSheet(null)}>
          <PagePanel doc={doc} setBackground={setBackground} setBanner={setBanner} onError={(m) => showToast(m, 'error')} />
        </Sheet>
      )}
      {sheet === 'stickers' && (
        <Sheet title="Stickers" onClose={() => setSheet(null)}>
          <StickerPalette onAdd={addSticker} onError={(m) => showToast(m, 'error')} />
        </Sheet>
      )}
      {toastNode}
    </div>
  );
};

/** Uploaded background image, dimmed so text stays readable. */
const BackgroundImage: React.FC<{ src: string }> = ({ src }) => {
  const url = useMediaUrl(src);
  if (!url) return null;
  return (
    <div className="fixed inset-0 bg-cover bg-center pointer-events-none" style={{ backgroundImage: `url(${url})` }}>
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
};

export default IntroBuilderPage;
