-- Real locks for letter images too: anything uploaded under letters/ in the intro-media
-- bucket is readable only by whoever uploaded it, or by the reader once a letter that
-- uses it has been opened. Intro-page images (everything else) stay readable by both.
-- Run in Supabase: SQL Editor > New query (after 0005).

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
    where strpos(b.doc::text, 'storage:' || p_name) > 0
      and (l.author_id = auth.uid()
           or exists (select 1 from public.letter_opens o
                      where o.letter_id = l.id and o.reader_id = auth.uid()))
  );
$$;

revoke all on function public.can_read_letter_media(text) from public, anon;
grant execute on function public.can_read_letter_media(text) to authenticated;

drop policy if exists "intro media readable by both" on storage.objects;
drop policy if exists "media readable when allowed" on storage.objects;
create policy "media readable when allowed" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'intro-media'
    and (
      name not like 'letters/%'
      or owner_id = auth.uid()::text
      or public.can_read_letter_media(name)
    )
  );
