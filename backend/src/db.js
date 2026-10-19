import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example)');
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const COLS = 'id, title, body, createdAt:created_at, updatedAt:updated_at';

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export const letters = {
  all: async () =>
    unwrap(await supabase.from('letters').select(COLS).order('updated_at', { ascending: false })),

  get: async (id) =>
    unwrap(await supabase.from('letters').select(COLS).eq('id', id).maybeSingle()),

  // Random letter; pass excludeId so a shuffle doesn't repeat the one on screen
  random: async (excludeId) => {
    const skip = (q) => (excludeId ? q.neq('id', excludeId) : q);
    const { count, error } = await skip(
      supabase.from('letters').select('id', { count: 'exact', head: true })
    );
    if (error) throw error;
    if (!count) return null;
    const offset = Math.floor(Math.random() * count);
    const rows = unwrap(await skip(supabase.from('letters').select(COLS)).order('id').range(offset, offset));
    return rows[0] ?? null;
  },

  create: async (title, body) =>
    unwrap(await supabase.from('letters').insert({ title, body }).select(COLS).single()),

  update: async (id, title, body) =>
    unwrap(
      await supabase
        .from('letters')
        .update({ title, body, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(COLS)
        .maybeSingle()
    ),

  remove: async (id) => {
    const rows = unwrap(await supabase.from('letters').delete().eq('id', id).select('id'));
    return rows.length > 0;
  },
};
