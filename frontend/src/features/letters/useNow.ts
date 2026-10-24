import { useEffect, useState } from 'react';

/**
 * Current time, refreshed every `ms` (drives countdowns).
 * Pass null to stop ticking (nothing on screen is counting down), and it also
 * pauses while the tab is hidden, so a phone in a pocket isn't re-rendering every second.
 */
export function useNow(ms: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (ms === null) return;
    let t: number | undefined;
    const start = () => {
      clearInterval(t);
      if (document.hidden) return;
      setNow(Date.now()); // catch up straight away after coming back
      t = window.setInterval(() => setNow(Date.now()), ms);
    };
    start();
    document.addEventListener('visibilitychange', start);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', start);
    };
  }, [ms]);
  return now;
}
