import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageTransition } from '../components/transition/context';
import { letterIndex, otherName, type IndexLetter } from '../utils/api';
import { LetterCard } from '../features/letters/LetterCard';
import { pickRandom, usageText } from '../features/letters/lock';
import { useNow } from '../features/letters/useNow';

/** The letters index: Random (unread shuffle, then read below) and "Open when you're ___". */
export const LettersPage: React.FC = () => {
  const navigate = useNavigate();
  const { go } = usePageTransition();
  const [letters, setLetters] = useState<IndexLetter[] | null>(null);
  const [writer, setWriter] = useState<string | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const now = useNow(1000);

  const load = useCallback(() => {
    letterIndex()
      .then(setLetters)
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
    otherName().then(setWriter).catch(() => {});
  }, [load]);

  // When a countdown runs out, ask the database again (it's the one that decides)
  const nextUnlock = useMemo(
    () =>
      Math.min(
        ...(letters ?? []).filter((l) => l.locked && l.unlockAt).map((l) => Date.parse(l.unlockAt!)),
        Infinity
      ),
    [letters]
  );
  useEffect(() => {
    if (now >= nextUnlock) load();
  }, [now, nextUnlock, load]);

  const random = (letters ?? []).filter((l) => l.section === 'random');
  const unread = random.filter((l) => !l.openedAt);
  const read = random
    .filter((l) => l.openedAt)
    .sort((a, b) => Date.parse(b.openedAt!) - Date.parse(a.openedAt!));
  const openWhen = (letters ?? []).filter((l) => l.section === 'open_when');
  const shufflable = unread.filter((l) => !l.locked);

  const open = (l: IndexLetter) => {
    go(`/letters/read/${l.id}`, { label: l.title ?? 'Sealed', code: '✉' });
  };

  // First tap on an unread letter that costs a quota slot just arms it
  const tap = (l: IndexLetter) => {
    if (l.locked) return;
    if (!l.openedAt && l.groupQuota != null && armed !== l.id) {
      setArmed(l.id);
      return;
    }
    setArmed(null);
    open(l);
  };

  const shuffle = () => {
    const pick = pickRandom(shufflable);
    if (pick) open(pick);
  };

  const sectionUsage = (list: IndexLetter[]) => {
    const withQuota = list.find((l) => l.groupQuota != null);
    return withQuota ? usageText(withQuota) : null;
  };

  return (
    <div
      className="relative w-full min-h-dvh bg-[#151515] text-white overflow-x-hidden selection:bg-brand-cyan selection:text-black"
      onClick={() => setArmed(null)}
    >
      <div className="flex items-center justify-between px-6 pt-6">
        <button
          type="button"
          onClick={() => navigate('/letters')}
          className="text-white/50 hover:text-white transition-colors duration-200 text-sm font-body cursor-pointer flex items-center gap-1.5"
        >
          <span>&larr;</span>
          <span>Back</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/write')}
          className="text-white/50 hover:text-white transition-colors duration-200 text-sm font-body cursor-pointer"
        >
          write a letter &rarr;
        </button>
      </div>

      <main className="max-w-[560px] mx-auto px-6 pt-10 pb-16" onClick={(e) => e.stopPropagation()}>
        <p className="font-mono text-[11px] tracking-[0.3em] text-white/45">LETTERS // FROM {(writer ?? '...').toUpperCase()}</p>
        <h1 className="font-heading font-medium text-4xl sm:text-5xl tracking-tight mt-2">
          Letters <span className="font-body italic font-normal">for you</span>
        </h1>

        {error && <p className="font-body italic text-rose-300 text-lg mt-8">couldn't load the letters, try again?</p>}
        {!letters && !error && <p className="font-body italic text-white/40 mt-8">loading...</p>}

        {letters && (
          <>
            {/* ---- Random ---- */}
            <section className="mt-10">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="font-display uppercase text-2xl tracking-wide">Random</h2>
                {sectionUsage(random) && (
                  <span className="font-mono text-[11px] tracking-wider text-white/45">{sectionUsage(random)}</span>
                )}
              </div>

              <button
                type="button"
                onClick={shuffle}
                disabled={!shufflable.length && unread.length > 0}
                className={`w-full rounded-2xl px-5 py-4 font-body text-lg font-semibold tracking-wide transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed ${
                  shufflable.length
                    ? 'bg-brand-cyan text-black hover:shadow-[0_0_24px_rgba(0,216,255,0.5)]'
                    : unread.length
                      ? 'bg-white/[0.06] text-white/45'
                      : 'bg-rose-500 text-white'
                }`}
              >
                {shufflable.length
                  ? `shuffle a letter ✦ (${shufflable.length} waiting)`
                  : unread.length
                    ? 'all locked for now :<'
                    : 'uhm sorry- me still writing down- sabar karo'}
              </button>

              {unread.length > 0 && (
                <div className="mt-4 space-y-2.5">
                  {unread.map((l) => (
                    <LetterCard key={l.id} letter={l} writer={writer} now={now} armed={armed === l.id} onTap={tap} />
                  ))}
                </div>
              )}

              {read.length > 0 && (
                <>
                  <p className="font-mono text-[11px] tracking-[0.25em] text-white/35 mt-8 mb-3">ALREADY READ</p>
                  <div className="space-y-2">
                    {read.map((l) => (
                      <LetterCard key={l.id} letter={l} writer={writer} now={now} armed={false} compact onTap={tap} />
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* ---- Open when you're ___ (only if any exist) ---- */}
            {openWhen.length > 0 && (
              <section className="mt-14">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
                  <h2 className="font-body italic text-3xl">Open when you're…</h2>
                  {sectionUsage(openWhen) && (
                    <span className="font-mono text-[11px] tracking-wider text-white/45">{sectionUsage(openWhen)}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {openWhen.map((l) => (
                    <LetterCard key={l.id} letter={l} writer={writer} now={now} armed={armed === l.id} compact onTap={tap} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default LettersPage;
