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

type LetterRow = {
  id: number;
  title: string;
  body: string;
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

const fromRow = (r: LetterRow): Letter => ({
  id: r.id,
  title: r.title,
  body: r.body,
  authorId: r.author_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

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

/** Next unread letter written by the other person, or null when they're all read. */
export async function nextLetter(): Promise<Letter | null> {
  const { data, error } = await supabase.rpc('next_letter');
  if (error) throw error;
  const rows = (data ?? []) as LetterRow[];
  return rows.length ? fromRow(rows[0]) : null;
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
