import type { IndexLetter } from '../../utils/api';

const PERIOD_WORD = { day: 'today', week: 'this week', month: 'this month' } as const;

/** "2d 4h", "3h 12m", "45s": short countdown text. */
export function shortDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** Why a letter is locked, in the site's voice. */
export function lockText(l: IndexLetter, writer: string | null, now: number): string {
  switch (l.lockReason) {
    case 'date':
      return l.unlockAt ? `opens in ${shortDuration(Date.parse(l.unlockAt) - now)}` : 'not yet';
    case 'after':
      return l.afterTitle ? `read “${l.afterTitle}” first` : 'read a sealed letter first';
    case 'manual':
      return `when ${writer ?? 'they'} unlock${writer ? 's' : ''} it`;
    case 'quota':
      return l.unlockAt
        ? `limit reached · next ${new Date(l.unlockAt).toLocaleDateString([], { weekday: 'short' })}`
        : 'limit reached';
    default:
      return '';
  }
}

/** "3 of 4 this week", or null for unlimited groups. */
export function usageText(l: Pick<IndexLetter, 'groupQuota' | 'groupUsed' | 'groupPeriod'>): string | null {
  if (l.groupQuota == null || l.groupPeriod == null) return null;
  return `${l.groupUsed ?? 0} of ${l.groupQuota} ${PERIOD_WORD[l.groupPeriod]}`;
}

/** "3 of 4 left this week": what opening one more would leave. */
export function leftText(l: Pick<IndexLetter, 'groupQuota' | 'groupUsed' | 'groupPeriod'>): string | null {
  if (l.groupQuota == null || l.groupPeriod == null) return null;
  return `${Math.max(0, l.groupQuota - (l.groupUsed ?? 0))} of ${l.groupQuota} left ${PERIOD_WORD[l.groupPeriod]}`;
}

/** A random element (or undefined for an empty list). */
export const pickRandom = <T>(list: T[]): T | undefined => list[Math.floor(Math.random() * list.length)];
