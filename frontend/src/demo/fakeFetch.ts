// A pretend Supabase that lives in the browser, for `npm run demo`.
// supabase-js gets this as its `fetch`, so the app runs unchanged against fake data.
// It speaks just enough of PostgREST / GoTrue / Storage for this app, and mirrors
// the real lock rules from migration 0005. State persists in localStorage.

import { USERS, seed, type Tables } from './seed';

type Row = Record<string, unknown>;

const STORE_KEY = 'letters-demo-db-v1';

// ?reset-demo in the URL wipes the fake database back to the seed
if (new URLSearchParams(location.search).has('reset-demo')) localStorage.removeItem(STORE_KEY);

const db: Tables = (() => {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) return JSON.parse(saved) as Tables;
  } catch {
    // fall through to a fresh seed
  }
  return seed();
})();

const persist = () => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
  } catch {
    // quota exceeded etc: the demo just won't remember
  }
};

const PK: Record<string, string[]> = {
  profiles: ['id'],
  letters: ['id'],
  letter_bodies: ['letter_id'],
  letter_groups: ['id'],
  letter_opens: ['reader_id', 'letter_id'],
  intros: ['for_user'],
  intro_pages: ['for_user'],
  intro_drafts: ['for_user'],
};

// ---- tiny JWT so supabase-js treats the session as real -----------------------

const b64url = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function sessionFor(user: (typeof USERS)[number]) {
  const exp = Math.floor(Date.now() / 1000) + 7 * 86400;
  const access_token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: user.id, exp, role: 'authenticated', aud: 'authenticated', email: user.email })}.demo`;
  return {
    access_token,
    refresh_token: `demo-refresh-${user.id}`,
    token_type: 'bearer',
    expires_in: 7 * 86400,
    expires_at: exp,
    user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: {}, user_metadata: {}, created_at: new Date(0).toISOString() },
  };
}

function currentUser(req: Request): string | null {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return USERS.some((u) => u.id === payload.sub) ? payload.sub : null;
  } catch {
    return null;
  }
}

// ---- responses -----------------------------------------------------------------

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const pgError = (status: number, message: string, code = 'P0001', hint: string | null = null) =>
  json({ code, message, hint, details: null }, status);

// ---- the lock rules (mirror of letter_lock / letter_group_usage in SQL) -------

function periodStart(period: string, now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  if (period === 'month') d.setDate(1);
  return d;
}

function nextReset(period: string): Date {
  const s = periodStart(period);
  if (period === 'day') s.setDate(s.getDate() + 1);
  if (period === 'week') s.setDate(s.getDate() + 7);
  if (period === 'month') s.setMonth(s.getMonth() + 1);
  return s;
}

function usage(groupId: unknown, reader: string) {
  const g = db.letter_groups.find((x) => x.id === groupId);
  if (!g) return null;
  const since = periodStart(g.period as string).getTime();
  const used = db.letter_opens.filter((o) => {
    if (o.reader_id !== reader || Date.parse(o.opened_at as string) < since) return false;
    return db.letters.find((l) => l.id === o.letter_id)?.group_id === g.id;
  }).length;
  return { quota: g.quota as number | null, period: g.period as string, used, next: nextReset(g.period as string).toISOString() };
}

const opened = (letterId: unknown, reader: string) =>
  db.letter_opens.find((o) => o.letter_id === letterId && o.reader_id === reader);

function lockOf(l: Row, reader: string): { locked: boolean; reason: string | null; unlockAt: string | null } {
  if (opened(l.id, reader)) return { locked: false, reason: null, unlockAt: null };
  const rule = l.rule as Row | null;
  if (rule?.kind === 'date' && Date.now() < Date.parse(rule.at as string)) return { locked: true, reason: 'date', unlockAt: rule.at as string };
  if (rule?.kind === 'after' && !opened(rule.letter_id, reader)) return { locked: true, reason: 'after', unlockAt: null };
  if (rule?.kind === 'manual' && !l.unlocked_by_writer) return { locked: true, reason: 'manual', unlockAt: null };
  const u = usage(l.group_id, reader);
  if (u && u.quota != null && u.used >= u.quota) return { locked: true, reason: 'quota', unlockAt: u.next };
  return { locked: false, reason: null, unlockAt: null };
}

function rpc(name: string, args: Row, me: string | null): Response {
  if (!me) return pgError(401, 'not signed in', '28000');

  if (name === 'letter_index') {
    const rows = db.letters
      .filter((l) => l.author_id !== me)
      .sort((a, b) => Date.parse(b.created_at as string) - Date.parse(a.created_at as string))
      .map((l) => {
        const o = opened(l.id, me);
        const lk = lockOf(l, me);
        const u = usage(l.group_id, me);
        const rule = l.rule as Row | null;
        const after = lk.reason === 'after' ? db.letters.find((a) => a.id === rule?.letter_id) : null;
        return {
          id: l.id,
          title: l.sealed && !o ? null : l.title,
          sealed: l.sealed,
          section: l.section,
          group_name: db.letter_groups.find((g) => g.id === l.group_id)?.name ?? null,
          group_quota: u?.quota ?? null,
          group_period: u?.period ?? null,
          group_used: u?.used ?? null,
          created_at: l.created_at,
          opened_at: o?.opened_at ?? null,
          locked: lk.locked,
          lock_reason: lk.reason,
          unlock_at: lk.unlockAt,
          after_title: after ? (after.sealed ? null : after.title) : null,
        };
      });
    return json(rows);
  }

  if (name === 'open_letter') {
    const l = db.letters.find((x) => x.id === args.p_id && x.author_id !== me);
    if (!l) return pgError(400, 'letter not found', 'P0002');
    const lk = lockOf(l, me);
    if (lk.locked) return pgError(400, `locked: ${lk.reason}`, 'P0001', lk.unlockAt ?? '');
    let o = opened(l.id, me);
    if (!o) {
      o = { reader_id: me, letter_id: l.id, opened_at: new Date().toISOString() };
      db.letter_opens.push(o);
      persist();
    }
    const body = db.letter_bodies.find((b) => b.letter_id === l.id);
    return json([{ id: l.id, title: l.title, greeting: l.greeting, doc: body?.doc ?? [], opened_at: o.opened_at }]);
  }

  if (name === 'unlock_letter') {
    const l = db.letters.find((x) => x.id === args.p_id && x.author_id === me);
    if (l) {
      l.unlocked_by_writer = true;
      persist();
    }
    return json(null, 204);
  }

  return pgError(404, `function ${name} not found`, 'PGRST202');
}

// ---- row-level security, roughly as the real policies --------------------------

function canSee(table: string, r: Row, me: string): boolean {
  switch (table) {
    case 'letters':
      return r.author_id === me;
    case 'letter_bodies':
      return db.letters.find((l) => l.id === r.letter_id)?.author_id === me;
    case 'letter_opens':
      return r.reader_id === me || db.letters.find((l) => l.id === r.letter_id)?.author_id === me;
    case 'intro_drafts':
      return r.for_user !== me;
    default:
      return true;
  }
}

function canWrite(table: string, r: Row, me: string): boolean {
  switch (table) {
    case 'letters':
      return r.author_id === me;
    case 'letter_bodies':
      return db.letters.find((l) => l.id === r.letter_id)?.author_id === me;
    case 'letter_groups':
      return r.owner_id === me;
    case 'profiles':
      return r.id === me;
    case 'intros':
    case 'intro_pages':
    case 'intro_drafts':
      return r.for_user !== me;
    default:
      return false;
  }
}

// ---- PostgREST query bits ----------------------------------------------------------

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function matches(r: Row, params: URLSearchParams): boolean {
  for (const [key, raw] of params) {
    if (RESERVED.has(key)) continue;
    const dot = raw.indexOf('.');
    const op = raw.slice(0, dot);
    const val = raw.slice(dot + 1);
    const cell = r[key];
    if (op === 'eq' && String(cell) !== val) return false;
    if (op === 'neq' && (cell == null || String(cell) === val)) return false; // SQL: null never matches neq
    if (op === 'is' && val === 'null' && cell != null) return false;
    if (op === 'in' && !val.replace(/^\(|\)$/g, '').split(',').includes(String(cell))) return false;
  }
  return true;
}

/** "id, title, authorId:author_id" -> picks/renames columns. "*" keeps everything. */
function project(rows: Row[], select: string | null): Row[] {
  if (!select || select.trim() === '*') return rows;
  const cols = select.split(',').map((c) => c.trim()).filter(Boolean).map((c) => {
    const [alias, col] = c.includes(':') ? c.split(':') : [c, c];
    return { alias: alias.trim(), col: col.trim() };
  });
  return rows.map((r) => Object.fromEntries(cols.map(({ alias, col }) => [alias, r[col] ?? null])));
}

function sortRows(rows: Row[], order: string | null): Row[] {
  if (!order) return rows;
  const [col, dir] = order.split('.');
  return [...rows].sort((a, b) => {
    const x = a[col] as string | number;
    const y = b[col] as string | number;
    const c = x < y ? -1 : x > y ? 1 : 0;
    return dir === 'desc' ? -c : c;
  });
}

const pkOf = (table: string, r: Row) => (PK[table] ?? ['id']).map((k) => String(r[k])).join('|');

function withDefaults(table: string, r: Row, me: string): Row {
  const now = new Date().toISOString();
  if (table === 'letters') {
    const nextId = Math.max(0, ...db.letters.map((l) => l.id as number)) + 1;
    const section = (r.section as string) ?? 'random';
    const group = db.letter_groups.find((g) => g.owner_id === (r.author_id ?? me) && g.default_for === section);
    return {
      id: nextId, author_id: me, title: '', body: '', section, sealed: false, greeting: '', rule: null,
      unlocked_by_writer: false, group_id: group?.id ?? null, created_at: now, updated_at: now, ...r,
    };
  }
  if (table === 'letter_groups') {
    const nextId = Math.max(0, ...db.letter_groups.map((g) => g.id as number)) + 1;
    return { id: nextId, owner_id: me, quota: null, period: 'week', default_for: null, created_at: now, ...r };
  }
  if (table === 'letter_bodies') return { doc: [], updated_at: now, ...r };
  if (table === 'intro_pages') return { updated_by: me, published_at: now, ...r };
  if (table === 'intro_drafts') return { updated_at: now, ...r };
  return r;
}

async function rest(req: Request, url: URL, table: string, me: string | null): Promise<Response> {
  if (!me) return pgError(401, 'JWT expired', 'PGRST301');
  const rows = db[table];
  if (!rows) return pgError(404, `relation "${table}" does not exist`, '42P01');

  const params = url.searchParams;
  const wantsObject = (req.headers.get('accept') ?? '').includes('vnd.pgrst.object');
  const prefer = req.headers.get('prefer') ?? '';
  const returnRows = prefer.includes('return=representation') || params.has('select');

  const respond = (out: Row[], status = 200) => {
    const shaped = project(out, params.get('select'));
    if (!returnRows && req.method !== 'GET') return json(undefined, status === 200 ? 204 : status);
    if (wantsObject) {
      if (shaped.length !== 1) return pgError(406, 'JSON object requested, multiple (or no) rows returned', 'PGRST116');
      return json(shaped[0], status);
    }
    return json(shaped, status);
  };

  if (req.method === 'GET' || req.method === 'HEAD') {
    let out = rows.filter((r) => canSee(table, r, me) && matches(r, params));
    out = sortRows(out, params.get('order'));
    const limit = params.get('limit');
    if (limit) out = out.slice(0, Number(limit));
    return respond(out);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const incoming: Row[] = Array.isArray(body) ? body : [body];
    const upsert = prefer.includes('resolution=merge-duplicates');
    const out: Row[] = [];
    for (const raw of incoming) {
      const existing = upsert ? rows.find((r) => pkOf(table, r) === pkOf(table, { ...raw })) : undefined;
      if (existing) {
        const merged = { ...existing, ...raw };
        if (!canWrite(table, merged, me)) return pgError(403, `new row violates row-level security policy for table "${table}"`, '42501');
        Object.assign(existing, raw);
        out.push(existing);
      } else {
        const row = withDefaults(table, raw, me);
        if (!canWrite(table, row, me)) return pgError(403, `new row violates row-level security policy for table "${table}"`, '42501');
        rows.push(row);
        out.push(row);
      }
    }
    persist();
    return respond(out, 201);
  }

  if (req.method === 'PATCH') {
    const patch = await req.json();
    const out = rows.filter((r) => canSee(table, r, me) && canWrite(table, r, me) && matches(r, params));
    for (const r of out) Object.assign(r, patch);
    if (table === 'letters' && 'section' in patch) {
      // mirror the trigger: follow the new section's default group
      for (const r of out) {
        const g = db.letter_groups.find((x) => x.owner_id === r.author_id && x.default_for === r.section);
        if (g) r.group_id = g.id;
      }
    }
    persist();
    return respond(out);
  }

  if (req.method === 'DELETE') {
    const out = rows.filter((r) => canSee(table, r, me) && canWrite(table, r, me) && matches(r, params));
    db[table] = rows.filter((r) => !out.includes(r));
    if (table === 'letters') {
      const ids = new Set(out.map((r) => r.id));
      db.letter_bodies = db.letter_bodies.filter((b) => !ids.has(b.letter_id));
      db.letter_opens = db.letter_opens.filter((o) => !ids.has(o.letter_id));
    }
    persist();
    return respond(out);
  }

  return pgError(405, 'method not allowed');
}

// ---- storage: keep uploads as data URLs in memory -----------------------------------

const media = new Map<string, string>();

async function storage(req: Request, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/storage\/v1\/object\//, '');
  if (req.method === 'POST' && path.startsWith('sign/')) {
    const key = decodeURIComponent(path.replace(/^sign\/[^/]+\//, ''));
    const dataUrl = media.get(key);
    return json({ signedURL: dataUrl ?? '/favicon.svg' });
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    const key = decodeURIComponent(path.replace(/^[^/]+\//, ''));
    const blob = await req.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.readAsDataURL(blob);
    });
    media.set(key, dataUrl);
    return json({ Key: path, Id: crypto.randomUUID() });
  }
  return json({ message: 'not found' }, 404);
}

// ---- router ----------------------------------------------------------------------------

export const fakeFetch: typeof fetch = async (input, init) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  const me = currentUser(req);
  await new Promise((r) => setTimeout(r, 120)); // feel like a network

  if (url.pathname === '/auth/v1/token') {
    const body = await req.json().catch(() => ({}));
    if (url.searchParams.get('grant_type') === 'refresh_token') {
      const user = USERS.find((u) => body.refresh_token === `demo-refresh-${u.id}`);
      return user ? json(sessionFor(user)) : json({ error: 'invalid_grant' }, 400);
    }
    const user = USERS.find((u) => u.email === body.email && u.password === body.password);
    return user ? json(sessionFor(user)) : json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
  }
  if (url.pathname === '/auth/v1/user') {
    const user = USERS.find((u) => u.id === me);
    return user ? json(sessionFor(user).user) : json({ message: 'invalid JWT' }, 401);
  }
  if (url.pathname === '/auth/v1/logout') return json(undefined, 204);

  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const args = await req.json().catch(() => ({}));
    return rpc(url.pathname.slice('/rest/v1/rpc/'.length), args, me);
  }
  if (url.pathname.startsWith('/rest/v1/')) return rest(req, url, url.pathname.slice('/rest/v1/'.length), me);
  if (url.pathname.startsWith('/storage/v1/object/')) return storage(req, url);

  return json({ message: `demo: no fake for ${url.pathname}` }, 404);
};
