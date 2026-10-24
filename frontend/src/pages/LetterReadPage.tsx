import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LockedError, openLetter, otherName, type OpenedLetter } from '../utils/api';
import { lockText } from '../features/letters/lock';
import { useNow } from '../features/letters/useNow';
import { LetterBanner } from '../features/letters/LetterBanner';

// BlockNote is big; only load it when a letter is actually being read
const LetterBody = lazy(() => import('../features/letters/LetterBody'));

type State =
  | { kind: 'loading' }
  | { kind: 'open'; letter: OpenedLetter }
  | { kind: 'locked'; error: LockedError }
  | { kind: 'error' };

/** One letter: title, optional greeting, and the formatted body. Opening it is what counts toward the quota. */
export const LetterReadPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [writer, setWriter] = useState<string | null>(null);
  const now = useNow(1000);

  useEffect(() => {
    let cancelled = false;
    // Safe to call twice (StrictMode): a second open is a free re-read
    openLetter(Number(id))
      .then((letter) => !cancelled && setState({ kind: 'open', letter }))
      .catch((err) => !cancelled && setState(err instanceof LockedError ? { kind: 'locked', error: err } : { kind: 'error' }));
    otherName().then((n) => !cancelled && setWriter(n)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="relative w-full min-h-dvh bg-[#151515] text-white overflow-x-hidden selection:bg-brand-cyan selection:text-black">
      <div className="px-6 pt-6">
        <button
          type="button"
          onClick={() => navigate('/lettersPage')}
          className="text-white/50 hover:text-white transition-colors duration-200 text-sm font-body cursor-pointer flex items-center gap-1.5"
        >
          <span>&larr;</span>
          <span>All letters</span>
        </button>
      </div>

      <main className="max-w-[640px] mx-auto px-6 pt-10 pb-20">
        {state.kind === 'loading' && <p className="font-body italic text-white/40">opening...</p>}

        {state.kind === 'error' && <p className="font-body italic text-rose-300 text-lg">couldn't open this one, try again?</p>}

        {state.kind === 'locked' && (
          <div className="animate-fade-in">
            <p className="font-mono text-[11px] tracking-[0.3em] text-white/45">LOCKED</p>
            <h1 className="font-body italic text-3xl mt-2">not yet, sorry :&lt;</h1>
            <p className="font-body text-lg text-white/60 mt-3">
              {lockText(
                {
                  lockReason: state.error.reason,
                  unlockAt: state.error.unlockAt,
                  afterTitle: null,
                } as Parameters<typeof lockText>[0],
                writer,
                now
              )}
            </p>
          </div>
        )}

        {state.kind === 'open' && (
          <article className="animate-fade-in">
            {state.letter.banner && (
              <div className="-mx-2 sm:mx-0 mb-8">
                <LetterBanner banner={state.letter.banner} />
              </div>
            )}
            <h1 className="font-heading font-medium text-4xl sm:text-5xl tracking-tight leading-tight break-words">
              {state.letter.title}
            </h1>
            {state.letter.greeting && (
              <p className="font-body italic text-2xl text-white/80 mt-6">{state.letter.greeting}</p>
            )}
            <div className="mt-6 -mx-[3px]">
              <Suspense fallback={<p className="font-body italic text-white/40">...</p>}>
                <LetterBody doc={state.letter.doc} />
              </Suspense>
            </div>
            {writer && <p className="mt-10 font-body italic text-white/50 text-lg">&mdash; {writer}</p>}
          </article>
        )}
      </main>
    </div>
  );
};

export default LetterReadPage;
