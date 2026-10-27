-- Sent letters are final: no edits to their words, title, look or locks once sent.
-- Run in Supabase: SQL Editor > New query (after 0012).
--
-- The way to fix one is UNSEND (allowed until it's opened, see 0012), edit, send again.
-- Still allowed on a sent letter: unlocking it yourself, unsending it, and its limit group
-- (deleting a group clears group_id on its letters, which must keep working).
-- Deleting a sent letter is refused once it's been opened, same as unsending.

create or replace function public.letters_freeze_sent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.published_at is not null and exists (select 1 from public.letter_opens o where o.letter_id = old.id) then
      raise exception 'already opened, it can''t be deleted' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if old.published_at is not null and new.published_at is not null and (
       new.title is distinct from old.title
    or new.greeting is distinct from old.greeting
    or new.section is distinct from old.section
    or new.sealed is distinct from old.sealed
    or new.rule is distinct from old.rule
    or new.notify_title is distinct from old.notify_title
    or new.notify_body is distinct from old.notify_body) then
    raise exception 'sent letters can''t be changed (unsend it first)' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists letters_freeze_sent on public.letters;
create trigger letters_freeze_sent
  before update or delete on public.letters
  for each row execute function public.letters_freeze_sent();

create or replace function public.letter_bodies_freeze_sent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.letters l where l.id = new.letter_id and l.published_at is not null) then
    raise exception 'sent letters can''t be changed (unsend it first)' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Only writes: deleting a letter still cascades to its body
drop trigger if exists letter_bodies_freeze_sent on public.letter_bodies;
create trigger letter_bodies_freeze_sent
  before insert or update on public.letter_bodies
  for each row execute function public.letter_bodies_freeze_sent();

-- "edited" (0012) can't happen any more; letters already marked keep their edited_at
drop trigger if exists letters_mark_edited on public.letters;
drop trigger if exists letter_bodies_mark_edited on public.letter_bodies;
drop function if exists public.letters_mark_edited();
drop function if exists public.letter_bodies_mark_edited();
