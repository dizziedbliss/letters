import { lazy } from 'react';

// Each page is its own chunk, so the gate doesn't download the writer, the builder, etc.
// preloadRoute() starts fetching one early (e.g. while the wipe covers the screen),
// and lazy() reuses that same promise, so the page is usually ready by the time it mounts.

const loaders = {
  home: () => import('./pages/HomePage'),
  intro: () => import('./pages/SorryUpdating'),
  letters: () => import('./pages/LettersPage'),
  read: () => import('./pages/LetterReadPage'),
  builder: () => import('./pages/IntroBuilderPage'),
  write: () => import('./pages/WritePage'),
};

type Page = keyof typeof loaders;

const started = new Map<Page, ReturnType<(typeof loaders)[Page]>>();
const load = (page: Page) => {
  if (!started.has(page)) {
    const p = loaders[page]().catch((err) => {
      started.delete(page); // forget a failed fetch so the next try starts fresh
      throw err;
    });
    started.set(page, p);
  }
  return started.get(page)!;
};

export const pages = {
  home: lazy(() => load('home')),
  intro: lazy(() => load('intro')),
  letters: lazy(() => load('letters')),
  read: lazy(() => load('read')),
  builder: lazy(() => load('builder')),
  write: lazy(() => load('write')),
};

// Most specific first
const BY_PATH: [string, Page][] = [
  ['/letters/read', 'read'],
  ['/lettersPage', 'letters'],
  ['/letters', 'intro'],
  ['/write/intro', 'builder'],
  ['/write', 'write'],
  ['/home', 'home'],
];

/** Start downloading the page for a path. Safe to call any number of times. */
export function preloadRoute(path: string) {
  const hit = BY_PATH.find(([prefix]) => path.startsWith(prefix));
  if (hit) load(hit[1]).catch(() => {}); // a failed preload just means it loads on mount instead
}

/** Fetch every page once the browser is idle, so later doors open instantly. */
export function preloadAllWhenIdle() {
  const run = async () => {
    await Promise.allSettled((Object.keys(loaders) as Page[]).map(load));
    // Then the editor (BlockNote, the one big download), which every letter and intro page needs
    import('./features/letters/LetterBody').catch(() => {});
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2000);
}
