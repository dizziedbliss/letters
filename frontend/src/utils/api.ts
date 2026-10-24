// Data layer: talks to Supabase directly, row-level security decides who sees what.
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { IntroDoc } from '../features/intro/doc';

export interface Letter {
  id: number;
  title: string;
  body: string;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
}

// PostgREST aliases (camelCase) so the rest of the app never sees snake_case
const COLS = 'id, title, body, authorId:author_id, createdAt:created_at, updatedAt:updated_at';

/** True when the error means "you're not (or no longer) signed in". */
export const isAuthError = (err: unknown) => {
  const e = err as Partial<PostgrestError> & { status?: number };
  return e?.status === 401 || e?.code === 'PGRST301' || e?.code === 'PGRST303';
};

// ---- session ---------------------------------------------------------------

const accountEmails = (import.meta.env.VITE_ACCOUNT_EMAILS ?? '')
  .split(',')
  .map((e: string) => e.trim())
  .filter(Boolean);

/**
 * The secret code is each person's password. The one field on the landing page
 * tries both accounts, so there's still just "type the code".
 */
export async function login(code: string): Promise<boolean> {
  for (const email of accountEmails) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: code });
    if (!error) return true;
  }
  return false;
}

export const logout = () => supabase.auth.signOut();

/** Save this browser's timezone on my profile, so letter quotas reset on my Monday. */
export async function syncTimezone(): Promise<void> {
  const id = await currentUserId();
  if (!id) return;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  await supabase.from('profiles').update({ timezone }).eq('id', id).neq('timezone', timezone);
  // a null timezone doesn't match neq, so fill that case too
  await supabase.from('profiles').update({ timezone }).eq('id', id).is('timezone', null);
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Display name of whoever is signed in, or null. */
export async function myName(): Promise<string | null> {
  const id = await currentUserId();
  if (!id) return null;
  const { data } = await supabase.from('profiles').select('display_name').eq('id', id).maybeSingle();
  return data?.display_name ?? null;
}

// ---- reading (her "more?" button, and his) ---------------------------------

// ---- letters index (reader side; bodies only ever come through open_letter) -----

export type LockReason = 'date' | 'after' | 'manual' | 'quota';

export interface IndexLetter {
  id: number;
  title: string | null; // null while a sealed letter is unopened
  sealed: boolean;
  section: 'random' | 'open_when';
  groupName: string | null;
  groupQuota: number | null; // null = unlimited
  groupPeriod: 'day' | 'week' | 'month' | null;
  groupUsed: number | null;
  createdAt: string;
  openedAt: string | null;
  locked: boolean;
  lockReason: LockReason | null;
  unlockAt: string | null;
  afterTitle: string | null;
}

/** Letters written for me, with sealed titles and secrets hidden until opened. */
export async function letterIndex(): Promise<IndexLetter[]> {
  const { data, error } = await supabase.rpc('letter_index');
  if (error) throw error;
  return ((data ?? []) as Record<string, never>[]).map((r) => ({
    id: r.id,
    title: r.title,
    sealed: r.sealed,
    section: r.section,
    groupName: r.group_name,
    groupQuota: r.group_quota,
    groupPeriod: r.group_period,
    groupUsed: r.group_used,
    createdAt: r.created_at,
    openedAt: r.opened_at,
    locked: r.locked,
    lockReason: r.lock_reason,
    unlockAt: r.unlock_at,
    afterTitle: r.after_title,
  }));
}

export interface OpenedLetter {
  id: number;
  title: string;
  greeting: string;
  doc: unknown[];
  openedAt: string;
}

/** Thrown when the database refuses to open a letter yet. */
export class LockedError extends Error {
  reason: LockReason;
  unlockAt: string | null;
  constructor(reason: LockReason, unlockAt: string | null) {
    super(`locked: ${reason}`);
    this.reason = reason;
    this.unlockAt = unlockAt;
  }
}

/** Open (or re-read) a letter. Counts toward the quota the first time only. */
export async function openLetter(id: number): Promise<OpenedLetter> {
  const { data, error } = await supabase.rpc('open_letter', { p_id: id });
  if (error) {
    const m = /^locked: (\w+)/.exec(error.message);
    if (m) throw new LockedError(m[1] as LockReason, error.hint || null);
    throw error;
  }
  const row = (data as Record<string, never>[])[0];
  return { id: row.id, title: row.title, greeting: row.greeting, doc: row.doc ?? [], openedAt: row.opened_at };
}

/** id -> display name for the two accounts. */
export async function profileNames(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('profiles').select('id, display_name');
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.display_name]));
}

// ---- intro pages ("Hello, ___"), each written by the other person ----------

export interface Intro {
  nickname: string;
  intro: string;
  aside: string;
  note: string;
}

const INTRO_COLS = 'nickname, intro, aside, note';

/** The other person's display name (the one who writes my letters). */
export async function otherName(): Promise<string | null> {
  const other = await otherUserId();
  if (!other) return null;
  return (await profileNames())[other] ?? null;
}

/** The other account's id (there are exactly two). */
async function otherUserId(): Promise<string | null> {
  const me = await currentUserId();
  const { data, error } = await supabase.from('profiles').select('id').neq('id', me ?? '').limit(1);
  if (error) throw error;
  return data?.[0]?.id ?? null;
}

/** My intro page, as the other person wrote it. Null if they haven't yet. */
export async function myIntro(): Promise<Intro | null> {
  const me = await currentUserId();
  if (!me) return null;
  const { data, error } = await supabase.from('intros').select(INTRO_COLS).eq('for_user', me).maybeSingle();
  if (error) throw error;
  return data;
}

// ---- intro page builder docs -------------------------------------------------

/** My published intro page doc (raw JSON; run it through parseDoc). Null if not published yet. */
export async function myIntroPage(): Promise<unknown | null> {
  const me = await currentUserId();
  if (!me) return null;
  const { data, error } = await supabase.from('intro_pages').select('doc').eq('for_user', me).maybeSingle();
  if (error) throw error;
  return data?.doc ?? null;
}

/** Everything the builder needs about the page I'm building for the other person. */
export async function theirBuilderState(): Promise<{
  name: string | null;
  draft: unknown | null;
  published: unknown | null;
  intro: Intro | null;
}> {
  const other = await otherUserId();
  if (!other) return { name: null, draft: null, published: null, intro: null };
  const [draft, published, intro, names] = await Promise.all([
    supabase.from('intro_drafts').select('doc').eq('for_user', other).maybeSingle(),
    supabase.from('intro_pages').select('doc').eq('for_user', other).maybeSingle(),
    supabase.from('intros').select(INTRO_COLS).eq('for_user', other).maybeSingle(),
    profileNames(),
  ]);
  for (const r of [draft, published, intro]) if (r.error) throw r.error;
  return {
    name: names[other] ?? null,
    draft: draft.data?.doc ?? null,
    published: published.data?.doc ?? null,
    intro: intro.data,
  };
}

/** Autosave: only I (the builder) can ever read this draft. */
export async function saveTheirDraft(doc: IntroDoc): Promise<void> {
  const other = await otherUserId();
  if (!other) throw new Error('no one to build for yet');
  const { error } = await supabase
    .from('intro_drafts')
    .upsert({ for_user: other, doc, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Make the doc their live page, along with the letters-page nickname and note. */
export async function publishTheirPage(doc: IntroDoc): Promise<void> {
  const other = await otherUserId();
  if (!other) throw new Error('no one to build for yet');
  const { error } = await supabase
    .from('intro_pages')
    .upsert({ for_user: other, doc, published_at: new Date().toISOString() });
  if (error) throw error;
  if (doc.letters) {
    const { error: e2 } = await supabase
      .from('intros')
      .upsert({ for_user: other, nickname: doc.letters.nickname, note: doc.letters.note });
    if (e2) throw e2;
  }
}

// ---- writing ---------------------------------------------------------------

export const lettersApi = {
  mine: async (): Promise<Letter[]> => {
    const userId = await currentUserId();
    if (!userId) throw Object.assign(new Error('not signed in'), { status: 401 });
    const { data, error } = await supabase
      .from('letters')
      .select(COLS)
      .eq('author_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as Letter[];
  },

  create: async (title: string, body: string): Promise<Letter> => {
    const { data, error } = await supabase.from('letters').insert({ title, body }).select(COLS).single();
    if (error) throw error;
    return data as unknown as Letter;
  },

  update: async (id: number, title: string, body: string): Promise<Letter> => {
    const { data, error } = await supabase
      .from('letters')
      .update({ title, body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(COLS)
      .single();
    if (error) throw error;
    return data as unknown as Letter;
  },

  remove: async (id: number): Promise<void> => {
    const { error } = await supabase.from('letters').delete().eq('id', id);
    if (error) throw error;
  },
};
