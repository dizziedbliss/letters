-- Stage 1: two real accounts (Supabase Auth) + row-level security.
-- Run in Supabase: SQL Editor > New query. Safe to read first, nothing runs until you do.
--
-- BEFORE running:
--   1. Authentication > Sign In / Providers > turn OFF "Allow new users to sign up".
--      (Only the two of you should ever exist. RLS below trusts "any logged-in user".)
--   2. Authentication > Users > Add user, for him and for her
--      (email + password; the password is the secret code typed on the landing page).

-- 1. Letters now have an author, so both of you can write.
alter table public.letters
  add column if not exists author_id uuid references auth.users (id) on delete set null
  default auth.uid();

-- Existing letters were all written by Max. After creating his user, run:
--   update public.letters set author_id = '<max-user-uuid>' where author_id is null;

-- 2. Which letters each person has already read ("more?" shows each once).
create table if not exists public.letters_seen (
  user_id   uuid not null references auth.users (id) on delete cascade default auth.uid(),
  letter_id bigint not null references public.letters (id) on delete cascade,
  seen_at   timestamptz not null default now(),
  primary key (user_id, letter_id)
);

alter table public.letters enable row level security;
alter table public.letters_seen enable row level security;

-- 3. Policies. "authenticated" = one of the two logged-in people; anon gets nothing.
drop policy if exists "letters readable by both" on public.letters;
create policy "letters readable by both" on public.letters
  for select to authenticated using (true);

drop policy if exists "write own letters" on public.letters;
create policy "write own letters" on public.letters
  for insert to authenticated with check (author_id = auth.uid());

drop policy if exists "edit own letters" on public.letters;
create policy "edit own letters" on public.letters
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists "delete own letters" on public.letters;
create policy "delete own letters" on public.letters
  for delete to authenticated using (author_id = auth.uid());

drop policy if exists "own seen list" on public.letters_seen;
create policy "own seen list" on public.letters_seen
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4. "more?" in one call: pick a random letter written by the OTHER person that I
--    haven't read yet, mark it read, return it. Returns nothing when I've read them all
--    (the frontend shows the red "sabar karo" button for that).
create or replace function public.next_letter()
returns setof public.letters
language plpgsql
security invoker
as $$
declare
  picked public.letters;
begin
  select l.* into picked
  from public.letters l
  where l.author_id is distinct from auth.uid()
    and not exists (
      select 1 from public.letters_seen s
      where s.letter_id = l.id and s.user_id = auth.uid()
    )
  order by random()
  limit 1;

  if picked.id is null then
    return;
  end if;

  insert into public.letters_seen (letter_id) values (picked.id)
  on conflict do nothing;

  return next picked;
end;
$$;

revoke all on function public.next_letter() from public, anon;
grant execute on function public.next_letter() to authenticated;
