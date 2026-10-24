import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageTransition } from '../components/transition/context';
import { lettersApi, logout as apiLogout, isAuthError, type Letter } from '../utils/api';

type Draft = { id: number | null; title: string; body: string };

const NEW_DRAFT: Draft = { id: null, title: '', body: '' };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const WritePage: React.FC = () => {
  const navigate = useNavigate();
  const { go } = usePageTransition();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [draft, setDraft] = useState<Draft>(NEW_DRAFT);
  const [saved, setSaved] = useState<Draft>(NEW_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false); // mobile: list <-> editor
  const titleRef = useRef<HTMLInputElement>(null);

  const dirty = draft.title !== saved.title || draft.body !== saved.body;

  const handleApiError = useCallback(
    (err: unknown) => {
      if (isAuthError(err)) {
        navigate('/', { replace: true });
        return;
      }
      setStatus(err instanceof Error ? err.message : 'something went wrong');
    },
    [navigate]
  );

  useEffect(() => {
    lettersApi
      .mine()
      .then(setLetters)
      .catch(handleApiError)
      .finally(() => setLoading(false));
  }, [handleApiError]);

  // Warn before closing the tab with unsaved writing
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const confirmDiscard = () => !dirty || window.confirm('Discard unsaved changes?');

  const open = (letter: Letter | null) => {
    if (!confirmDiscard()) return;
    const next = letter ? { id: letter.id, title: letter.title, body: letter.body } : NEW_DRAFT;
    setDraft(next);
    setSaved(next);
    setStatus(null);
    setEditorOpen(true);
    if (!letter) setTimeout(() => titleRef.current?.focus(), 0);
  };

  const save = async () => {
    if (saving) return;
    if (!draft.title.trim()) {
      setStatus('give your letter a title first :3');
      titleRef.current?.focus();
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const letter =
        draft.id === null
          ? await lettersApi.create(draft.title, draft.body)
          : await lettersApi.update(draft.id, draft.title, draft.body);
      const next = { id: letter.id, title: letter.title, body: letter.body };
      setDraft(next);
      setSaved(next);
      setLetters((prev) => [letter, ...prev.filter((l) => l.id !== letter.id)]);
      setStatus('saved <3');
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (draft.id === null) {
      setDraft(NEW_DRAFT);
      setSaved(NEW_DRAFT);
      setEditorOpen(false);
      return;
    }
    if (!window.confirm(`Delete "${saved.title}"? This can't be undone.`)) return;
    try {
      await lettersApi.remove(draft.id);
      setLetters((prev) => prev.filter((l) => l.id !== draft.id));
      setDraft(NEW_DRAFT);
      setSaved(NEW_DRAFT);
      setEditorOpen(false);
    } catch (err) {
      handleApiError(err);
    }
  };

  const logout = async () => {
    if (!confirmDiscard()) return;
    await apiLogout().catch(() => {});
    navigate('/', { replace: true });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  };

  const btn =
    'px-4 py-1.5 rounded-full text-sm font-body font-semibold transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div
      onKeyDown={onKeyDown}
      className="min-h-dvh bg-[#151515] text-white md:flex selection:bg-brand-cyan selection:text-black"
    >
      {/* Sidebar: letter list */}
      <aside
        className={`${editorOpen ? 'hidden' : 'flex'} md:flex flex-col w-full md:w-[320px] md:h-dvh md:sticky md:top-0 border-r border-white/10 shrink-0`}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <h1 className="font-heading font-medium text-2xl">
            Your <span className="font-body italic font-normal">letters</span>
          </h1>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => confirmDiscard() && go('/home', { label: 'Home', code: '00' })}
              className="text-white/50 hover:text-white text-sm font-body transition-colors cursor-pointer"
            >
              home
            </button>
            <button
              type="button"
              onClick={logout}
              className="text-white/50 hover:text-white text-sm font-body transition-colors cursor-pointer"
            >
              log out
            </button>
          </div>
        </div>

        <div className="px-5 pb-4 space-y-2">
          <button
            type="button"
            onClick={() => confirmDiscard() && navigate('/write/intro')}
            className={`${btn} w-full bg-white/5 text-white/80 hover:bg-white/10`}
          >
            build their intro page
          </button>
          <button
            type="button"
            onClick={() => open(null)}
            className={`${btn} w-full bg-brand-cyan text-black hover:shadow-[0_0_20px_rgba(0,216,255,0.5)]`}
          >
            + new letter
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto px-3 pb-6 space-y-1">
          {loading && <li className="px-3 py-2 text-white/40 font-body italic">loading...</li>}
          {!loading && letters.length === 0 && (
            <li className="px-3 py-2 text-white/40 font-body italic">no letters yet, write the first one :3</li>
          )}
          {letters.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => open(l)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  draft.id === l.id ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="font-body text-lg leading-snug truncate">{l.title}</div>
                <div className="text-xs text-white/40 font-heading">{formatDate(l.updatedAt)}</div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Editor */}
      <main className={`${editorOpen ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0 p-5 sm:p-8 md:h-dvh`}>
        {!editorOpen && (
          <div className="hidden md:flex flex-1 items-center justify-center text-white/30 font-body italic text-xl">
            pick a letter or start a new one
          </div>
        )}

        {editorOpen && (
          <>
            <div className="flex items-center justify-between gap-3 mb-5">
              <button
                type="button"
                onClick={() => confirmDiscard() && setEditorOpen(false)}
                className="md:hidden text-white/50 hover:text-white text-sm font-body cursor-pointer"
              >
                &larr; all letters
              </button>
              <span className="text-sm font-body text-white/50 md:ml-0 ml-auto">
                {status ?? (dirty ? 'unsaved changes' : draft.id === null ? 'new letter' : '')}
              </span>
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={remove}
                  className={`${btn} bg-white/5 text-rose-300 hover:bg-rose-500/20`}
                >
                  {draft.id === null ? 'discard' : 'delete'}
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !dirty}
                  className={`${btn} bg-brand-cyan text-black hover:shadow-[0_0_20px_rgba(0,216,255,0.5)]`}
                >
                  {saving ? 'saving...' : 'save'}
                </button>
              </div>
            </div>

            <input
              ref={titleRef}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              maxLength={200}
              placeholder="title"
              className="w-full bg-transparent outline-none font-body italic text-3xl sm:text-4xl placeholder:text-white/25 mb-4"
            />
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="write your letter here..."
              className="flex-1 min-h-[50dvh] w-full resize-none bg-transparent outline-none font-body text-lg sm:text-[21px] leading-relaxed text-[#e8e8e8] placeholder:text-white/25"
            />
          </>
        )}
      </main>
    </div>
  );
};

export default WritePage;
