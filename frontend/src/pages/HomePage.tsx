import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, myName } from '../utils/api';
import { useParallax } from '../hooks/useParallax';
import { Petals } from '../components/hub/Petals';
import { markBootSeen, shouldBoot } from '../components/hub/boot';
import { usePageTransition, WIPE } from '../components/transition/context';
import { DoorTile } from '../components/hub/DoorTile';
import { preloadAllWhenIdle } from '../routes';
import { IconLetter, IconWrite, IconStar, IconPuzzle, IconPin, IconUs } from '../components/hub/icons';

// Placeholder names/notes: each door gets its own copy as we build its page.
const DOORS = [
  { label: 'Letters', code: '01', note: 'READ // OPEN', icon: <IconLetter />, to: '/letters', tilt: -1.2 },
  { label: 'Write', code: '02', note: 'WRITE // SEND', icon: <IconWrite />, to: '/write', tilt: 0.9 },
  { label: 'Favourites', code: '03', note: 'ARCHIVE', icon: <IconStar />, tilt: 0.8, locked: true },
  { label: 'Games', code: '04', note: 'TRAINING', icon: <IconPuzzle />, tilt: -0.9, locked: true },
  { label: 'Scrapbook', code: '05', note: 'BOARD', icon: <IconPin />, tilt: -0.6, locked: true },
  { label: 'Us', code: '06', note: 'STATUS', icon: <IconUs />, tilt: 1.1, locked: true },
] as const;

/** Depth = how many px a layer drifts at full tilt. Bigger = closer to the viewer. */
const layer = (depth: number): React.CSSProperties => ({
  transform: `translate3d(calc(var(--px, 0) * ${depth}px), calc(var(--py, 0) * ${depth}px), 0)`,
  willChange: 'transform',
});

const timeNow = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const sceneRef = useRef<HTMLDivElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const { go, reveal, isBusy } = usePageTransition();

  // Arriving through a wipe (login, back from a page) already looks like a boot.
  // Otherwise (a refresh) start covered once per tab and sweep away.
  const [arrivedMidWipe] = useState(isBusy);
  const [boot] = useState(() => !arrivedMidWipe && shouldBoot());
  const [name, setName] = useState<string | null>(null);
  const [clock, setClock] = useState(timeNow);

  // Live coordinate readout follows the parallax without re-rendering
  const onFrame = useCallback((x: number, y: number) => {
    if (coordRef.current) {
      coordRef.current.textContent = `X:${(5 + x * 3).toFixed(1)} Y:${(6 + y * 3).toFixed(1)}`;
    }
  }, []);
  useParallax(sceneRef, onFrame);

  useEffect(() => {
    markBootSeen();
    if (boot) reveal({ label: 'Welcome', code: '00' });
  }, [boot, reveal]);

  useEffect(() => {
    myName().then(setName).catch(() => {});
    preloadAllWhenIdle(); // the doors' pages are small; have them ready before a tap
    const tick = setInterval(() => setClock(timeNow()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const signOut = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div
      ref={sceneRef}
      className="relative min-h-dvh overflow-hidden bg-paper text-ink selection:bg-brand-cyan selection:text-black"
      style={{ '--t0': boot ? `${WIPE.bootHold + 150}ms` : arrivedMidWipe ? '200ms' : '0ms' } as React.CSSProperties}
    >
      {/* ---- scene layers (back to front) ---- */}
      <div aria-hidden="true" className="absolute inset-[-40px] pointer-events-none" style={layer(6)}>
        <div
          className="w-full h-full opacity-60"
          style={{
            backgroundImage:
              'linear-gradient(rgba(17,17,20,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,20,0.08) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />
      </div>

      <div aria-hidden="true" className="absolute inset-[-40px] pointer-events-none" style={layer(14)}>
        <div className="w-full h-full bg-brand-purple" style={{ clipPath: 'polygon(48% 0, 100% 0, 100% 58%)' }} />
      </div>

      <div aria-hidden="true" className="absolute inset-y-0 left-0 pointer-events-none" style={layer(22)}>
        <span
          className="block h-full font-display uppercase text-ink/[0.07] select-none leading-none"
          style={{ writingMode: 'vertical-rl', fontSize: 'min(34vh, 38vw)' }}
        >
          Goated
        </span>
      </div>

      <svg
        aria-hidden="true"
        className="absolute -top-[8vmin] -right-[28vmin] w-[120vmin] h-[120vmin] pointer-events-none"
        style={layer(30)}
        viewBox="0 0 100 100"
        fill="none"
      >
        <circle cx="50" cy="50" r="47" stroke="rgba(255,255,255,0.45)" strokeWidth="0.35" />
        <circle cx="50" cy="50" r="36" stroke="rgba(17,17,20,0.35)" strokeWidth="0.3" strokeDasharray="1.2 2.4" />
        <g style={{ transformOrigin: '50px 50px', animation: 'ring-spin 70s linear infinite' }}>
          <circle cx="50" cy="50" r="41" stroke="#00D8FF" strokeWidth="0.7" strokeDasharray="14 60" />
          <circle cx="50" cy="50" r="26" stroke="rgba(255,255,255,0.6)" strokeWidth="0.4" strokeDasharray="3 5" />
        </g>
      </svg>

      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={layer(46)}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <polygon points="70,8 74,34 69,30" fill="#00D8FF" />
        <polygon points="86,40 92,52 84,48" fill="#111114" opacity="0.85" />
        <polygon points="8,62 28,70 10,72" fill="#6100D8" opacity="0.8" />
        <polygon points="62,80 66,96 60,92" fill="#111114" opacity="0.7" />
      </svg>

      <Petals />

      {/* ---- foreground ---- */}
      <div className="relative z-10 min-h-dvh max-w-5xl mx-auto px-5 sm:px-8 py-5 flex flex-col justify-between">
        <header
          className="flex items-center justify-between font-mono text-[11px] tracking-[0.18em]"
          style={{ animation: 'fade-up 0.5s var(--ease-snap) both', animationDelay: 'var(--t0)' }}
        >
          <span>LETTERS // HOME</span>
          <span className="flex items-center gap-4">
            <span>LOCAL {clock}</span>
            <button
              type="button"
              onClick={signOut}
              className="underline underline-offset-4 decoration-ink/40 hover:decoration-ink cursor-pointer"
            >
              LOG OUT
            </button>
          </span>
        </header>

        <section
          className="py-10 sm:py-14"
          style={{ animation: 'fade-up 0.7s var(--ease-snap) both', animationDelay: 'calc(var(--t0) + 120ms)' }}
        >
          <p className="font-mono text-[11px] tracking-[0.3em] text-ink/60">WELCOME BACK //</p>
          <h1 className="font-body italic font-normal text-[44px] sm:text-6xl leading-[1.05] mt-2 break-words">
            {name ?? ' '}
          </h1>
          <p className="font-mono text-[11px] mt-4 text-ink/60 tracking-wider">
            SESSION ACTIVE &nbsp;·&nbsp; <span ref={coordRef}>X:5.0 Y:6.0</span>
          </p>
        </section>

        <nav aria-label="Sections" className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 pb-4">
          {DOORS.map((d, i) => (
            <DoorTile
              key={d.label}
              label={d.label}
              code={d.code}
              note={d.note}
              icon={d.icon}
              tilt={d.tilt}
              index={i}
              locked={'locked' in d && d.locked}
              onOpen={'to' in d ? () => go(d.to, { label: d.label, code: d.code }) : undefined}
            />
          ))}
        </nav>
      </div>

    </div>
  );
};

export default HomePage;
