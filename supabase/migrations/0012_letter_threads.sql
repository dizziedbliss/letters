-- Replies, reactions and "edited" on letters.
-- Run in Supabase: SQL Editor > New query (after 0011).
--
-- A sent letter stays editable (it then shows "edited"), can be unsent only until it's opened,
-- and grows a thread: text, KLIPY GIFs or stickers, plus emoji reactions on the letter and on
-- each reply. Only the writer, and the reader once they've opened it, can see or join a thread.
-- The tables have no policies: everything goes through the functions below, which check that.

-- 1. "edited": set when a sent letter's words, banner or look change. Edits never notify (0010).
alter table public.letters add column if not exists edited_at timestamptz;

create or replace function public.letters_mark_edited()
returns trigger
language plpgsql
as $$
begin
  if old.published_at is not null and new.published_at is not null
     and (new.title is distinct from old.title or new.greeting is distinct from old.greeting) then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists letters_mark_edited on public.letters;
create trigger letters_mark_edited
  before update of title, greeting on public.letters
  for each row execute function public.letters_mark_edited();

create or replace function public.letter_bodies_mark_edited()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.doc is not distinct from old.doc and new.banner is not distinct from old.banner
     and new.look is not distinct from old.look then
    return null;
  end if;
  update public.letters set edited_at = now() where id = new.letter_id and published_at is not null;
  return null;
end;
$$;

drop trigger if exists letter_bodies_mark_edited on public.letter_bodies;
create trigger letter_bodies_mark_edited
  after insert or update on public.letter_bodies
  for each row execute function public.letter_bodies_mark_edited();

-- 2. Unsend only until it's been opened (the button hides then, this makes it a rule)
create or replace function public.letters_no_unsend_after_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.published_at is not null and new.published_at is null
     and exists (select 1 from public.letter_opens o where o.letter_id = old.id) then
    raise exception 'already opened, it can''t be unsent' using errcode = 'P0001';
  end if;
  -- a fresh send starts clean: no "edited" from before it went out
  if old.published_at is null and new.published_at is not null then
    new.edited_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists letters_no_unsend_after_open on public.letters;
create trigger letters_no_unsend_after_open
  before update of published_at on public.letters
  for each row execute function public.letters_no_unsend_after_open();

-- 3. The reader sees "edited" too
drop function if exists public.open_letter(bigint);

create or replace function public.open_letter(p_id bigint)
returns table (id bigint, title text, greeting text, doc jsonb, banner jsonb, look jsonb,
               opened_at timestamptz, edited_at timestamptz)
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
  select l.id, l.title, l.greeting, coalesce(b.doc, '[]'::jsonb), b.banner, b.look, o.opened_at, l.edited_at
  from public.letter_opens o
  left join public.letter_bodies b on b.letter_id = l.id
  where o.letter_id = l.id and o.reader_id = me;
end;
$$;

revoke all on function public.open_letter(bigint) from public, anon;
grant execute on function public.open_letter(bigint) to authenticated;

-- 4. Threads
create table if not exists public.letter_replies (
  id         bigint generated always as identity primary key,
  letter_id  bigint not null references public.letters (id) on delete cascade,
  author_id  uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('text', 'gif', 'sticker')),
  body       text check (char_length(body) <= 2000),
  media      jsonb, -- {"url": ..., "width": ..., "height": ...} for a gif or sticker
  created_at timestamptz not null default now(),
  check ((kind = 'text' and body is not null and media is null) or (kind <> 'text' and media is not null))
);

create index if not exists letter_replies_letter on public.letter_replies (letter_id, created_at);

create table if not exists public.letter_reactions (
  id         bigint generated always as identity primary key,
  letter_id  bigint not null references public.letters (id) on delete cascade,
  reply_id   bigint references public.letter_replies (id) on delete cascade, -- null = on the letter itself
  user_id    uuid not null references auth.users (id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now()
);

create unique index if not exists letter_reactions_once
  on public.letter_reactions (letter_id, coalesce(reply_id, 0), user_id, emoji);

-- When each of you last looked at each thread, for the "new replies" dots
create table if not exists public.letter_thread_seen (
  user_id   uuid not null references auth.users (id) on delete cascade,
  letter_id bigint not null references public.letters (id) on delete cascade,
  seen_at   timestamptz not null default now(),
  primary key (user_id, letter_id)
);

alter table public.letter_replies enable row level security;
alter table public.letter_reactions enable row level security;
alter table public.letter_thread_seen enable row level security;

-- The writer, or the reader once they've opened it
create or replace function public.can_thread(p_letter bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.letters l
    where l.id = p_letter and l.published_at is not null
      and (l.author_id = auth.uid()
           or exists (select 1 from public.letter_opens o where o.letter_id = l.id and o.reader_id = auth.uid()))
  );
$$;

create or replace function public.get_thread(p_letter bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_thread(p_letter) then
    raise exception 'not your thread' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'replies', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'author_id', r.author_id, 'kind', r.kind, 'body', r.body,
                                          'media', r.media, 'created_at', r.created_at) order by r.created_at, r.id)
      from public.letter_replies r where r.letter_id = p_letter), '[]'::jsonb),
    'reactions', coalesce((
      select jsonb_agg(jsonb_build_object('reply_id', x.reply_id, 'user_id', x.user_id, 'emoji', x.emoji) order by x.id)
      from public.letter_reactions x where x.letter_id = p_letter), '[]'::jsonb)
  );
end;
$$;

create or replace function public.add_reply(p_letter bigint, p_kind text, p_body text, p_media jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.letter_replies;
begin
  if not public.can_thread(p_letter) then
    raise exception 'not your thread' using errcode = '42501';
  end if;
  insert into public.letter_replies (letter_id, author_id, kind, body, media)
  values (p_letter, auth.uid(), p_kind, case when p_kind = 'text' then nullif(trim(p_body), '') end,
          case when p_kind = 'text' then null else p_media end)
  returning * into r;
  -- writing in a thread means you've seen it
  insert into public.letter_thread_seen (user_id, letter_id) values (auth.uid(), p_letter)
  on conflict (user_id, letter_id) do update set seen_at = now();
  return jsonb_build_object('id', r.id, 'author_id', r.author_id, 'kind', r.kind, 'body', r.body,
                            'media', r.media, 'created_at', r.created_at);
end;
$$;

create or replace function public.delete_reply(p_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.letter_replies where id = p_id and author_id = auth.uid();
$$;

-- Returns true if the reaction is now on, false if it was taken back
create or replace function public.toggle_reaction(p_letter bigint, p_reply bigint, p_emoji text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_thread(p_letter) then
    raise exception 'not your thread' using errcode = '42501';
  end if;
  if p_reply is not null and not exists (select 1 from public.letter_replies where id = p_reply and letter_id = p_letter) then
    raise exception 'reply not found' using errcode = 'P0002';
  end if;
  delete from public.letter_reactions
  where letter_id = p_letter and reply_id is not distinct from p_reply and user_id = auth.uid() and emoji = p_emoji;
  if found then
    return false;
  end if;
  insert into public.letter_reactions (letter_id, reply_id, user_id, emoji) values (p_letter, p_reply, auth.uid(), p_emoji);
  return true;
end;
$$;

create or replace function public.mark_thread_seen(p_letter bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.can_thread(p_letter) then
    insert into public.letter_thread_seen (user_id, letter_id) values (auth.uid(), p_letter)
    on conflict (user_id, letter_id) do update set seen_at = now();
  end if;
end;
$$;

-- Per letter you're in: how many replies and reactions from the other person you haven't seen
create or replace function public.thread_activity()
returns table (letter_id bigint, unread int)
language sql
stable
security definer
set search_path = public
as $$
  select l.id,
         ((select count(*) from public.letter_replies r
           where r.letter_id = l.id and r.author_id <> auth.uid() and r.created_at > coalesce(s.seen_at, '-infinity'))
        + (select count(*) from public.letter_reactions x
           where x.letter_id = l.id and x.user_id <> auth.uid() and x.created_at > coalesce(s.seen_at, '-infinity')))::int
  from public.letters l
  left join public.letter_thread_seen s on s.letter_id = l.id and s.user_id = auth.uid()
  where public.can_thread(l.id);
$$;

revoke all on function public.can_thread(bigint) from public, anon;
revoke all on function public.get_thread(bigint) from public, anon;
revoke all on function public.add_reply(bigint, text, text, jsonb) from public, anon;
revoke all on function public.delete_reply(bigint) from public, anon;
revoke all on function public.toggle_reaction(bigint, bigint, text) from public, anon;
revoke all on function public.mark_thread_seen(bigint) from public, anon;
revoke all on function public.thread_activity() from public, anon;
grant execute on function public.can_thread(bigint) to authenticated;
grant execute on function public.get_thread(bigint) to authenticated;
grant execute on function public.add_reply(bigint, text, text, jsonb) to authenticated;
grant execute on function public.delete_reply(bigint) to authenticated;
grant execute on function public.toggle_reaction(bigint, bigint, text) to authenticated;
grant execute on function public.mark_thread_seen(bigint) to authenticated;
grant execute on function public.thread_activity() to authenticated;

-- 5. Buzz the other person on a reply or reaction (reactions: once per few minutes, so
--    tapping one on and off doesn't spam). Where it opens depends on who wrote the letter.
create or replace function public.thread_link(p_letter bigint, p_for uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when l.author_id = p_for then '/write?letter=' || l.id else '/letters/read/' || l.id end
  from public.letters l where l.id = p_letter;
$$;

create or replace function public.letter_replies_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  them uuid := public.other_user(new.author_id);
  w text := public.display_name_of(new.author_id);
begin
  if them is null then
    return null;
  end if;
  insert into public.notifications (recipient, kind, title, body, url)
  values (them, 'reply', w || ' replied',
          case new.kind when 'text' then left(new.body, 140) when 'gif' then 'sent a GIF' else 'sent a sticker' end,
          public.thread_link(new.letter_id, them));
  return null;
end;
$$;

drop trigger if exists letter_replies_notify on public.letter_replies;
create trigger letter_replies_notify
  after insert on public.letter_replies
  for each row execute function public.letter_replies_notify();

create or replace function public.letter_reactions_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  them uuid := public.other_user(new.user_id);
  w text := public.display_name_of(new.user_id);
  t text;
begin
  if them is null then
    return null;
  end if;
  if exists (select 1 from public.notifications
             where recipient = them and kind = 'reaction' and created_at > now() - interval '3 minutes') then
    return null;
  end if;
  select case when new.reply_id is not null then 'your reply'
              when l.sealed and l.author_id = new.user_id then 'a letter'
              else '"' || l.title || '"' end
  into t from public.letters l where l.id = new.letter_id;
  insert into public.notifications (recipient, kind, title, body, url)
  values (them, 'reaction', w || ' reacted ' || new.emoji, 'to ' || t, public.thread_link(new.letter_id, them));
  return null;
end;
$$;

drop trigger if exists letter_reactions_notify on public.letter_reactions;
create trigger letter_reactions_notify
  after insert on public.letter_reactions
  for each row execute function public.letter_reactions_notify();
