-- Letter looks: each letter can have its own background and stickers (like the landing page).
-- Stored with the body, so it stays locked with the letter; sticker/background images
-- follow the same media lock as everything else in the letter.
-- Run in Supabase: SQL Editor > New query (after 0008).

alter table public.letter_bodies add column if not exists look jsonb; -- {"background": {...}, "stickers": [...]}

drop function if exists public.open_letter(bigint);

create or replace function public.open_letter(p_id bigint)
returns table (id bigint, title text, greeting text, doc jsonb, banner jsonb, look jsonb, opened_at timestamptz)
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
  select l.id, l.title, l.greeting, coalesce(b.doc, '[]'::jsonb), b.banner, b.look, o.opened_at
  from public.letter_opens o
  left join public.letter_bodies b on b.letter_id = l.id
  where o.letter_id = l.id and o.reader_id = me;
end;
$$;

revoke all on function public.open_letter(bigint) from public, anon;
grant execute on function public.open_letter(bigint) to authenticated;

create or replace function public.can_read_letter_media(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.letters l
    join public.letter_bodies b on b.letter_id = l.id
    where (strpos(b.doc::text, 'storage:' || p_name) > 0
           or strpos(coalesce(b.banner::text, ''), 'storage:' || p_name) > 0
           or strpos(coalesce(b.look::text, ''), 'storage:' || p_name) > 0)
      and (l.author_id = auth.uid()
           or exists (select 1 from public.letter_opens o
                      where o.letter_id = l.id and o.reader_id = auth.uid()))
  );
$$;
