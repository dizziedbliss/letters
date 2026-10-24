import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthError, publishTheirPage, saveTheirDraft, theirBuilderState } from '../utils/api';
import { newId, parseDoc, starterDoc, themeFor, type IntroDoc } from '../features/intro/doc';
import { useDocHistory } from '../features/intro/editor/useDocHistory';
import { EditableCanvas } from '../features/intro/editor/EditableCanvas';
import { BlockInspector } from '../features/intro/editor/BlockInspector';
import { AddSheet, PageSheet, type AddableType } from '../features/intro/editor/Sheets';
import { NEW_BLOCKS, duplicateBlock, insertBlock, moveBlock, removeBlock } from '../features/intro/editor/blockOps';

const AUTOSAVE_MS = 800;

const topBtn =
  'h-9 px-3 rounded-full font-mono text-[11px] tracking-wider transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed';

/** Build the other person's intro page, right on the page itself. */
export const IntroBuilderPage: React.FC = () => {
  const navigate = useNavigate();
  const { doc, canUndo, canRedo, reset, update, undo, redo } = useDocHistory();
  const [name, setName] = useState<string | null>(null);
  const [savedDoc, setSavedDoc] = useState<IntroDoc | null>(null);
  const [publishedJson, setPublishedJson] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'add' | 'page' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const fail = (err: unknown) => {
    if (isAuthError(err)) navigate('/', { replace: true });
    else setStatus(err instanceof Error ? err.message : 'something went wrong');
  };

  // Load: resume the draft, else start from what's published, else a fresh starter page
  useEffect(() => {
    theirBuilderState()
      .then(({ name, draft, published, intro }) => {
        const start = parseDoc(draft) ?? parseDoc(published) ?? starterDoc(name);
        start.letters ??= { nickname: intro?.nickname || name || '', note: intro?.note ?? '' };
        setName(name);
        setSavedDoc(start);
        setPublishedJson(published ? JSON.stringify(parseDoc(published)) : null);
        reset(start);
      })
      .catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave the draft shortly after each change
  useEffect(() => {
    if (!doc || doc === savedDoc) return;
    const t = setTimeout(() => {
      saveTheirDraft(doc)
        .then(() => setSavedDoc(doc))
        .catch(fail);
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, savedDoc]);

  const unsaved = !!doc && doc !== savedDoc;
  const docJson = useMemo(() => (doc ? JSON.stringify(doc) : null), [doc]);
  const unpublished = docJson !== publishedJson;

  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  // Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, except while typing (the textarea has its own undo)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea');
      if (typing || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const publish = async () => {
    if (!doc || publishing) return;
    if (!window.confirm(`Publish this page for ${name ?? 'them'}? They'll see it straight away.`)) return;
    setPublishing(true);
    setStatus(null);
    try {
      await saveTheirDraft(doc);
      await publishTheirPage(doc);
      setSavedDoc(doc);
      setPublishedJson(JSON.stringify(doc));
      setStatus('published <3');
    } catch (err) {
      fail(err);
    } finally {
      setPublishing(false);
    }
  };

  const add = (type: AddableType) => {
    const block = NEW_BLOCKS[type]();
    update(insertBlock(block, selected));
    setSelected(block.id);
    setSheet(null);
  };

  const back = () => {
    if (unsaved && !window.confirm('Still saving, leave anyway?')) return;
    navigate('/write');
  };

  if (!doc) {
    return (
      <div className="min-h-dvh bg-[#151515] text-white/50 flex items-center justify-center font-body italic">
        {status ?? 'loading...'}
      </div>
    );
  }

  const theme = themeFor(doc.background);
  const index = doc.blocks.findIndex((b) => b.id === selected);
  const block = index >= 0 ? doc.blocks[index] : null;

  return (
    <div className="min-h-dvh" style={{ backgroundColor: theme.bg }}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-[#151515]/90 backdrop-blur text-white border-b border-white/10">
        <div className="max-w-3xl mx-auto h-14 px-3 flex items-center gap-1.5">
          <button type="button" onClick={back} className={`${topBtn} text-white/60 hover:text-white`} aria-label="Back">
            &larr;
          </button>
          <button type="button" onClick={undo} disabled={!canUndo} className={`${topBtn} bg-white/8 hover:bg-white/15`} aria-label="Undo">
            ↶
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} className={`${topBtn} bg-white/8 hover:bg-white/15`} aria-label="Redo">
            ↷
          </button>
          <span className="flex-1 min-w-0 truncate text-center font-mono text-[10px] tracking-wider text-white/50">
            {status ?? (unsaved ? 'SAVING…' : unpublished ? 'DRAFT SAVED' : 'LIVE')}
          </span>
          <button type="button" onClick={() => setSheet('page')} className={`${topBtn} bg-white/8 hover:bg-white/15`}>
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
        BUILDING {(name ?? 'their').toUpperCase()}&apos;S PAGE · TAP TO EDIT · DRAG ⠿ TO MOVE
      </p>

      <main className="pt-4 pb-72" onClick={() => setSelected(null)}>
        <EditableCanvas doc={doc} selectedId={selected} onSelect={setSelected} update={update} />

        <div className="flex justify-center mt-8">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSheet('add');
            }}
            className="h-12 px-6 rounded-full border-2 border-dashed font-mono text-xs tracking-[0.2em] cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: theme.strong, borderColor: theme.strong }}
          >
            + ADD BLOCK
          </button>
        </div>
      </main>

      {block && !sheet && (
        <BlockInspector
          block={block}
          index={index}
          count={doc.blocks.length}
          update={update}
          onMove={(dir) => update(moveBlock(index, index + dir))}
          onDuplicate={() => {
            const id = newId();
            update(duplicateBlock(block.id, id));
            setSelected(id);
          }}
          onDelete={() => {
            update(removeBlock(block.id));
            setSelected(null);
          }}
        />
      )}

      {sheet === 'add' && <AddSheet onAdd={add} onClose={() => setSheet(null)} />}
      {sheet === 'page' && <PageSheet doc={doc} update={update} onClose={() => setSheet(null)} />}
    </div>
  );
};

export default IntroBuilderPage;
