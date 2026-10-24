import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageTransition } from '../components/transition/context';
import { groupsApi, isAuthError, lettersApi, logout as apiLogout, otherName, type LetterGroup, type MyLetter } from '../utils/api';
import { LetterSettings } from '../features/letters/write/LetterSettings';
import { GroupsSheet } from '../features/letters/write/GroupsSheet';

// BlockNote is big; load it only once a letter is open for editing
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
  const [body, setBody] = useState<{ id: number; doc: unknown[] } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [unsaved, setUnsaved] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ---- debounced saving: one timer per thing being saved, flushed on switch/leave ----
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const jobs = useRef(new Map<string, () => Promise<unknown>>());
  const metaPatches = useRef(new Map<number, Partial<MyLetter>>());

  const fail = useCallback(
    (err: unknown) => {
      if (isAuthError(err)) navigate('/', { replace: true });
      else setError(err instanceof Error ? err.message : 'something went wrong');
    },
    [navigate]
  );

  const run = useCallback(
    (key: string) => {
      clearTimeout(timers.current.get(key));
      timers.current.delete(key);
      const job = jobs.current.get(key);
      jobs.current.delete(key);
      if (!job) return;
      job()
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

  const flushAll = useCallback(() => [...jobs.current.keys()].forEach(run), [run]);

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
      })
      .catch(fail);
    otherName().then(setReader).catch(() => {});
  }, [fail]);

  // load the body whenever a different letter is opened
  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    lettersApi
      .body(selectedId)
      .then((doc) => !cancelled && setBody({ id: selectedId, doc }))
      .catch(fail);
    return () => {
      cancelled = true;
    };
  }, [selectedId, fail]);

  const selected = letters?.find((l) => l.id === selectedId) ?? null;

  // ---- edits ----
  const patchLetter = (id: number, patch: Partial<MyLetter>, ms = SAVE_MS) => {
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

  const saveBody = (id: number, doc: unknown[]) => schedule(`body:${id}`, () => lettersApi.saveBody(id, doc));

  const open = (id: number) => {
    flushAll();
    setBody(null);
    setSelectedId(id);
    setShowSettings(false);
  };

  const create = async (section: MyLetter['section']) => {
    try {
      const letter = await lettersApi.create(section);
      setLetters((ls) => [letter, ...(ls ?? [])]);
      open(letter.id);
      setTimeout(() => document.getElementById('letter-title')?.focus(), 50);
    } catch (err) {
      fail(err);
    }
  };

  const remove = async () => {
    if (!selected || !window.confirm(`Delete "${selected.title}"? This can't be undone.`)) return;
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
    try {
      await lettersApi.unlock(selected.id);
      setLetters((ls) => ls?.map((l) => (l.id === selected.id ? { ...l, unlockedByWriter: true } : l)) ?? ls);
    } catch (err) {
      fail(err);
    }
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
                              {l.sealed && <span className="px-1.5 py-0.5 rounded bg-brand-purple/40 text-white/90">SEALED</span>}
                              {l.rule && <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/70">{RULE_BADGE[l.rule.kind]}</span>}
                            </span>
                          </div>
                          <div className={`font-mono text-[10px] tracking-wider mt-0.5 ${l.openedAt ? 'text-brand-cyan' : 'text-white/35'}`}>
                            {l.openedAt
                              ? `READ ${new Date(l.openedAt).toLocaleDateString([], { day: 'numeric', month: 'short' }).toUpperCase()} ♡`
                              : 'NOT OPENED YET'}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          {error && <p className="px-3 mt-4 font-body text-rose-300">{error}</p>}
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
                  <span className="flex-1 font-mono text-[10px] tracking-[0.2em] text-white/40">
                    {unsaved ? 'SAVING…' : 'SAVED'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSettings((s) => !s)}
                    className={`lg:hidden h-9 px-3 rounded-full font-mono text-[10px] tracking-wider cursor-pointer ${
                      showSettings ? 'bg-brand-cyan text-black' : 'bg-white/[0.08] text-white/80'
                    }`}
                  >
                    LOCKS & SETTINGS
                  </button>
                  <button type="button" onClick={remove} className="h-9 px-3 rounded-full bg-white/[0.06] text-rose-300 font-mono text-[10px] tracking-wider cursor-pointer">
                    DELETE
                  </button>
                </div>
              </div>

              {showSettings && <div className="lg:hidden max-w-[720px] mx-auto px-5 pt-5 pb-2 border-b border-white/5">{settings}</div>}

              <div className="max-w-[720px] mx-auto px-5 pt-8 pb-24">
                <input
                  id="letter-title"
                  value={selected.title === 'untitled' ? '' : selected.title}
                  onChange={(e) => patchLetter(selected.id, { title: e.target.value })}
                  placeholder={selected.section === 'open_when' ? 'open when you’re… (e.g. sad)' : 'title (shows in the list)'}
                  maxLength={200}
                  className="w-full bg-transparent outline-none font-heading font-medium text-4xl tracking-tight placeholder:text-white/20"
                />
                <input
                  value={selected.greeting}
                  onChange={(e) => patchLetter(selected.id, { greeting: e.target.value })}
                  placeholder="greeting (optional), e.g. hey stinky,"
                  maxLength={200}
                  className="w-full bg-transparent outline-none font-body italic text-2xl text-white/80 mt-4 placeholder:text-white/20"
                />
                <div className="mt-6 -ml-[42px]">
                  {body?.id === selected.id ? (
                    <Suspense fallback={<p className="pl-[42px] font-body italic text-white/40">loading editor...</p>}>
                      <LetterEditor key={selected.id} initial={body.doc} onChange={(doc) => saveBody(selected.id, doc)} />
                    </Suspense>
                  ) : (
                    <p className="pl-[42px] font-body italic text-white/40">loading...</p>
                  )}
                </div>
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
    </div>
  );
};

export default WritePage;
