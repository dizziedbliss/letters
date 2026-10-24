-- Letters v2: index sections, sealed letters, unlock rules, quota groups, real locks.
-- Run in Supabase: SQL Editor > New query (after 0004).
--
-- How the lock is real: the reader can no longer select `letters` or `letter_bodies` at all.
-- They see the index through letter_index() (sealed titles, greetings and rules stay hidden)
-- and get a body only through open_letter(), which checks the rule and quota first.

-- 0. Each person's timezone (the browser fills it in), so "a week" means their Monday.
alter table public.profiles add column if not exists timezone text;

-- 1. Quota groups: "N opens per day/week/month", owned by the writer.
create table if not exists public.letter_groups (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name        text not null,
  quota       int check (quota is null or quota > 0), -- null = unlimited
  period      text not null default 'week' check (period in ('day', 'week', 'month')),
  default_for text check (default_for in ('random', 'open_when')),
  created_at  timestamptz not null default now(),
  unique (owner_id, default_for)
);

alter table public.letter_groups enable row level security;

drop policy if exists "groups readable by both" on public.letter_groups;
create policy "groups readable by both" on public.letter_groups
  for select to authenticated using (true);

drop policy if exists "manage own groups" on public.letter_groups;
create policy "manage own groups" on public.letter_groups
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Seeded defaults, changeable later: Random 4/week, Open when 2/week
insert into public.letter_groups (owner_id, name, quota, period, default_for)
select u.id, g.name, g.quota, 'week', g.kind
from auth.users u
cross join (values ('Random', 4, 'random'), ('Open when', 2, 'open_when')) as g (name, quota, kind)
on conflict (owner_id, default_for) do nothing;

-- 2. New letter fields
alter table public.letters
  add column if not exists section text not null default 'random' check (section in ('random', 'open_when')),
  add column if not exists group_id bigint references public.letter_groups (id) on delete set null,
  add column if not exists sealed boolean not null default false,
  add column if not exists greeting text not null default '',
  -- {"kind":"date","at":"<iso>"} | {"kind":"after","letter_id":<id>} | {"kind":"manual"} | null
  add column if not exists rule jsonb check (rule is null or rule ->> 'kind' in ('date', 'after', 'manual')),
  add column if not exists unlocked_by_writer boolean not null default false;

-- New letters land in the writer's default group for their section
create or replace function public.letters_default_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Moving sections: follow to the new section's default group,
  -- unless the writer had put the letter in a custom group
  if tg_op = 'UPDATE' and new.section <> old.section and new.group_id is not distinct from old.group_id
     and exists (select 1 from public.letter_groups
                 where id = old.group_id and default_for = old.section) then
    new.group_id := null;
  end if;

  if new.group_id is null then
    select id into new.group_id
    from public.letter_groups
    where owner_id = new.author_id and default_for = new.section;
  end if;
  return new;
end;
$$;

drop trigger if exists letters_default_group on public.letters;
create trigger letters_default_group
  before insert or update of section on public.letters
  for each row execute function public.letters_default_group();

-- Existing letters: Random, titled, no rule, in the author's Random group
update public.letters l
set group_id = g.id
from public.letter_groups g
where l.group_id is null and g.owner_id = l.author_id and g.default_for = 'random';

-- 3. Bodies (BlockNote JSON), readable only by the author
create table if not exists public.letter_bodies (
  letter_id  bigint primary key references public.letters (id) on delete cascade,
  doc        jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.letter_bodies enable row level security;

drop policy if exists "author owns the body" on public.letter_bodies;
create policy "author owns the body" on public.letter_bodies
  for all to authenticated
  using (exists (select 1 from public.letters l where l.id = letter_id and l.author_id = auth.uid()))
  with check (exists (select 1 from public.letters l where l.id = letter_id and l.author_id = auth.uid()));

-- Old plain-text bodies become BlockNote paragraphs (blank line = new paragraph)
insert into public.letter_bodies (letter_id, doc)
select
  l.id,
  coalesce(
    (select jsonb_agg(jsonb_build_object(
        'type', 'paragraph',
        'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', p, 'styles', '{}'::jsonb))
      ) order by ord)
     from regexp_split_to_table(trim(l.body), E'\\n\\s*\\n') with ordinality as t (p, ord)
     where trim(p) <> ''),
    '[]'::jsonb)
from public.letters l
on conflict (letter_id) do nothing;

-- 4. Who opened what, when. Written only by open_letter().
create table if not exists public.letter_opens (
  reader_id uuid not null references auth.users (id) on delete cascade,
  letter_id bigint not null references public.letters (id) on delete cascade,
  opened_at timestamptz not null default now(),
  primary key (reader_id, letter_id)
);

alter table public.letter_opens enable row level security;

-- Readers see their own opens; writers see when their letters were opened
drop policy if exists "see relevant opens" on public.letter_opens;
create policy "see relevant opens" on public.letter_opens
  for select to authenticated
  using (reader_id = auth.uid()
         or exists (select 1 from public.letters l where l.id = letter_id and l.author_id = auth.uid()));

-- 5. Lock the letters table down to its author (the reader goes through the functions below)
drop policy if exists "letters readable by both" on public.letters;
drop policy if exists "authors read own letters" on public.letters;
create policy "authors read own letters" on public.letters
  for select to authenticated using (author_id = auth.uid());

-- The old shuffle is retired
drop function if exists public.next_letter();

-- 6. Lock state for one letter, from the reader's point of view
create or replace function public.letter_lock(p_letter public.letters, p_reader uuid)
returns table (locked boolean, reason text, unlock_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz         text;
  g          public.letter_groups;
  period_start timestamptz;
  used       int;
begin
  -- Anything already opened stays open forever (re-reading never counts)
  if exists (select 1 from public.letter_opens o where o.letter_id = p_letter.id and o.reader_id = p_reader) then
    return query select false, null::text, null::timestamptz;
    return;
  end if;

  -- The letter's own rule comes first
  if p_letter.rule is not null then
    case p_letter.rule ->> 'kind'
      when 'date' then
        if now() < (p_letter.rule ->> 'at')::timestamptz then
          return query select true, 'date', (p_letter.rule ->> 'at')::timestamptz;
          return;
        end if;
      when 'after' then
        if not exists (select 1 from public.letter_opens o
                       where o.reader_id = p_reader and o.letter_id = (p_letter.rule ->> 'letter_id')::bigint) then
          return query select true, 'after', null::timestamptz;
          return;
        end if;
      when 'manual' then
        if not p_letter.unlocked_by_writer then
          return query select true, 'manual', null::timestamptz;
          return;
        end if;
    end case;
  end if;

  -- Then the group's quota, counted in the reader's own timezone (weeks start Monday)
  select * into g from public.letter_groups where id = p_letter.group_id;
  if g.id is not null and g.quota is not null then
    select coalesce(timezone, 'UTC') into tz from public.profiles where id = p_reader;
    tz := coalesce(tz, 'UTC');
    period_start := date_trunc(g.period, now() at time zone tz) at time zone tz;

    select count(*) into used
    from public.letter_opens o
    join public.letters l on l.id = o.letter_id
    where o.reader_id = p_reader and l.group_id = g.id and o.opened_at >= period_start;

    if used >= g.quota then
      return query select true, 'quota', period_start + ('1 ' || g.period)::interval;
      return;
    end if;
  end if;

  return query select false, null::text, null::timestamptz;
end;
$$;

revoke all on function public.letter_lock(public.letters, uuid) from public, anon, authenticated;

-- 7. The index: letters written FOR me, with secrets hidden until opened
create or replace function public.letter_index()
returns table (
  id          bigint,
  title       text,   -- null while a sealed letter is unopened
  sealed      boolean,
  section     text,
  group_name  text,
  created_at  timestamptz,
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
    l.created_at,
    o.opened_at,
    lk.locked,
    lk.reason,
    lk.unlock_at,
    case when lk.reason = 'after' then
      (select case when a.sealed then null else a.title end
       from public.letters a where a.id = (l.rule ->> 'letter_id')::bigint)
    end
  from public.letters l
  left join public.letter_groups g on g.id = l.group_id
  left join public.letter_opens o on o.letter_id = l.id and o.reader_id = auth.uid()
  cross join lateral public.letter_lock(l, auth.uid()) lk
  where auth.uid() is not null
    and l.author_id is distinct from auth.uid()
  order by l.created_at desc;
$$;

revoke all on function public.letter_index() from public, anon;
grant execute on function public.letter_index() to authenticated;

-- 8. Open a letter: the only way a reader ever gets a body
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

  select * into l from public.letters where letters.id = p_id and author_id is distinct from me;
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

-- 9. Writer side: unlock a 'manual' letter for the reader
--    (plain UPDATE works too via "edit own letters"; this is just a clear name for the button)
create or replace function public.unlock_letter(p_id bigint)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.letters set unlocked_by_writer = true where id = p_id and author_id = auth.uid();
$$;

revoke all on function public.unlock_letter(bigint) from public, anon;
grant execute on function public.unlock_letter(bigint) to authenticated;
