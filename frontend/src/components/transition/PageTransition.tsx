import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTransitionContext, WIPE, type WipeLabel } from './context';
import { preloadRoute } from '../../routes';

type Phase = 'idle' | 'in' | 'hold' | 'out';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const BAND_MS = WIPE.in - WIPE.stagger * 2;
const EASE_IN = 'cubic-bezier(0.2, 0.8, 0.2, 1)'; // decelerate onto the screen
const EASE_OUT = 'cubic-bezier(0.6, 0, 0.2, 1)'; // snap off it

// Back to front. Each band is a slanted panel wider than the screen.
const BANDS = ['bg-ink', 'bg-brand-purple', 'bg-paper'];

const bandAnimation = (phase: Phase, i: number) => {
  if (phase === 'hold') return 'none';
  if (phase === 'in') return `wipe-in ${BAND_MS}ms ${EASE_IN} ${i * WIPE.stagger}ms both`;
  // leave front-first, so the layers peel away
  return `wipe-out ${BAND_MS}ms ${EASE_OUT} ${(BANDS.length - 1 - i) * WIPE.stagger}ms both`;
};

const Wipe: React.FC<{ phase: Phase; label: WipeLabel }> = ({ phase, label }) => {
  const textDelay = phase === 'hold' ? 80 : WIPE.stagger * 2 + 260;
  const barMs = phase === 'hold' ? WIPE.bootHold : WIPE.in + WIPE.hold;

  return (
    <div aria-hidden="true" className="fixed inset-0 z-50 overflow-hidden pointer-events-auto">
      {BANDS.map((bg, i) => (
        <div
          key={bg}
          className={`absolute inset-y-0 left-[-30vw] w-[160vw] ${bg}`}
          style={{
            clipPath: 'polygon(15% 0, 100% 0, 85% 100%, 0 100%)',
            animation: bandAnimation(phase, i),
          }}
        >
          {i === BANDS.length - 1 && (
            <>
              {/* blueprint grid + accent slab on the front panel */}
              <div
                className="absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(17,17,20,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,20,0.08) 1px, transparent 1px)',
                  backgroundSize: '36px 36px',
                }}
              />
              <div
                className="absolute inset-y-0 left-[77%] w-[9vw] bg-brand-purple"
                style={{ clipPath: 'polygon(40% 0, 100% 0, 60% 100%, 0 100%)' }}
              />
              <svg
                className="absolute top-[18%] left-[72%] w-[60vmin] h-[60vmin]"
                viewBox="0 0 100 100"
                fill="none"
              >
                <circle cx="50" cy="50" r="46" stroke="rgba(17,17,20,0.25)" strokeWidth="0.4" strokeDasharray="1 2" />
                <g style={{ transformOrigin: '50px 50px', animation: 'ring-spin 3s linear infinite' }}>
                  <circle cx="50" cy="50" r="38" stroke="#00D8FF" strokeWidth="1.2" strokeDasharray="20 220" />
                </g>
              </svg>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(86vw,760px)] text-ink">
                <p className="font-mono text-[11px] sm:text-xs tracking-[0.3em] text-ink/70">
                  // {label.code ?? '00'} &nbsp;—&nbsp; NOW LOADING
                </p>
                <h2
                  className="font-display uppercase leading-[0.9] mt-3 break-words"
                  style={{
                    fontSize: 'clamp(64px, 19vw, 168px)',
                    animation: `wipe-text 420ms ${EASE_IN} ${textDelay}ms both`,
                  }}
                >
                  {label.label}
                </h2>
                <div className="mt-4 h-[5px] w-full bg-ink/10 overflow-hidden">
                  <div
                    className="h-full w-full bg-brand-purple origin-left"
                    style={{ animation: `wipe-bar ${barMs}ms linear both` }}
                  />
                </div>
                <p className="mt-3 font-mono text-[10px] tracking-[0.25em] text-ink/50 flex justify-between">
                  <span>SYS // LETTERS</span>
                  <span>SECURE LINK</span>
                </p>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

/** Owns the full-screen wipe. Lives above the routes, so it survives the page change. */
export const PageTransitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [state, setState] = useState<{ phase: Phase; label: WipeLabel }>({ phase: 'idle', label: { label: '' } });
  const busy = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const sweepOut = useCallback(() => {
    setState((s) => ({ ...s, phase: 'out' }));
    later(WIPE.out, () => {
      busy.current = false;
      setState((s) => ({ ...s, phase: 'idle' }));
    });
  }, []);

  const go = useCallback(
    (to: string, label: WipeLabel) => {
      if (busy.current) return;
      preloadRoute(to); // fetch the next page while the bands cover the screen
      if (reducedMotion()) {
        navigate(to);
        return;
      }
      busy.current = true;
      setState({ phase: 'in', label });
      later(WIPE.in + WIPE.hold, () => {
        navigate(to);
        sweepOut();
      });
    },
    [navigate, sweepOut]
  );

  const reveal = useCallback(
    (label: WipeLabel) => {
      if (busy.current || reducedMotion()) return;
      busy.current = true;
      setState({ phase: 'hold', label });
      later(WIPE.bootHold, sweepOut);
    },
    [sweepOut]
  );

  const api = useMemo(() => ({ go, reveal, isBusy: () => busy.current }), [go, reveal]);

  return (
    <PageTransitionContext.Provider value={api}>
      {children}
      {state.phase !== 'idle' && <Wipe phase={state.phase} label={state.label} />}
    </PageTransitionContext.Provider>
  );
};

export default PageTransitionProvider;
