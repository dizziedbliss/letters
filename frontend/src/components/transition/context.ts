import { createContext, useContext } from 'react';

export interface WipeLabel {
  label: string;
  code?: string;
}

export interface PageTransitionApi {
  /** Sweep the bands in, show the label, navigate underneath, sweep them out. */
  go: (to: string, label: WipeLabel) => void;
  /** Start fully covered (boot on a fresh load), then sweep out. */
  reveal: (label: WipeLabel) => void;
  /** True while a wipe is running (e.g. a page mounting under the sweep). */
  isBusy: () => boolean;
}

// One rhythm for every wipe, so the whole site feels like one machine
export const WIPE = {
  stagger: 90, // between bands
  in: 650,
  hold: 450,
  bootHold: 900,
  out: 650,
};

export const PageTransitionContext = createContext<PageTransitionApi | null>(null);

export function usePageTransition() {
  const ctx = useContext(PageTransitionContext);
  if (!ctx) throw new Error('usePageTransition must be used inside <PageTransitionProvider>');
  return ctx;
}
