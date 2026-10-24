-- Drafts: a letter is only for the writer until they hit Send.
-- The reader's index and open_letter() ignore unsent letters entirely (real locks, again).
-- Run in Supabase: SQL Editor > New query (after 0006).

alter table public.letters add column if not exists published_at timestamptz;

-- Letters written before drafts existed were already visible, so they count as sent
update public.letters set published_at = created_at where published_at is null;

-- letter_index(): same as 0005, minus drafts
create or replace function public.letter_index()
returns table (
  id          bigint,
  title       text,   -- null while a sealed letter is unopened
  sealed      boolean,
  section     text,
  group_name  text,
  group_quota int,    -- null = unlimited
  group_period text,  -- 'day' | 'week' | 'month'
  group_used  int,    -- opens used this period
  created_at  timestamptz,  -- when it was sent
  opened_at   timestamptz,
  locked      boolean,
  lock_reason text,   -- 'date' | 'after' | 'manual' | 'quota' | null
  unlock_at   timestamptz,
  after_title text    -- for 'after': which letter to read first (null if that one is sealed)
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    case when l.sealed and o.opened_at is null then null else l.title end,
    l.sealed,
    l.section,
    g.name,
    us.quota,
    us.period,
    us.used,
    l.published_at,
    o.opened_at,
    lk.locked,
    lk.reason,
    lk.unlock_at,
    case when lk.reason = 'after' then
      (select case when a.sealed then null else a.title end
       from public.letters a where a.id = (l.rule ->> 'letter_id')::bigint and a.published_at is not null)
    end
  from public.letters l
  left join public.letter_groups g on g.id = l.group_id
  left join public.letter_opens o on o.letter_id = l.id and o.reader_id = auth.uid()
  cross join lateral public.letter_lock(l, auth.uid()) lk
  left join lateral public.letter_group_usage(l.group_id, auth.uid()) us on true
  where auth.uid() is not null
    and l.author_id is distinct from auth.uid()
    and l.published_at is not null
  order by l.published_at desc;
$$;

revoke all on function public.letter_index() from public, anon;
grant execute on function public.letter_index() to authenticated;

-- open_letter(): same as 0005, minus drafts
create or replace function public.open_letter(p_id bigint)
returns table (id bigint, title text, greeting text, doc jsonb, opened_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  me  uuid := auth.uid();
  l   public.letters;
  lk  record;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select * into l from public.letters
  where letters.id = p_id and author_id is distinct from me and published_at is not null;
  if l.id is null then
    raise exception 'letter not found' using errcode = 'P0002';
  end if;

  select * into lk from public.letter_lock(l, me);
  if lk.locked then
    raise exception 'locked: %', lk.reason using errcode = 'P0001', hint = coalesce(lk.unlock_at::text, '');
  end if;

  insert into public.letter_opens (reader_id, letter_id) values (me, l.id)
  on conflict do nothing;

  return query
  select l.id, l.title, l.greeting, coalesce(b.doc, '[]'::jsonb), o.opened_at
  from public.letter_opens o
  left join public.letter_bodies b on b.letter_id = l.id
  where o.letter_id = l.id and o.reader_id = me;
end;
$$;

revoke all on function public.open_letter(bigint) from public, anon;
grant execute on function public.open_letter(bigint) to authenticated;
