-- Intro page builder: each person's intro page is a JSON doc built by the OTHER person.
-- Draft and published live in separate tables because RLS hides rows, not columns:
-- you must never be able to peek at the draft of your own page.
-- Run in Supabase: SQL Editor > New query (after 0003).

-- 1. Published pages: both can read, only the builder (the other person) can write.
create table if not exists public.intro_pages (
  for_user     uuid primary key references auth.users (id) on delete cascade,
  doc          jsonb not null,
  updated_by   uuid references auth.users (id) default auth.uid(),
  published_at timestamptz not null default now()
);

-- 2. Drafts: only the builder can see or touch them.
create table if not exists public.intro_drafts (
  for_user   uuid primary key references auth.users (id) on delete cascade,
  doc        jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.intro_pages enable row level security;
alter table public.intro_drafts enable row level security;

drop policy if exists "intro pages readable by both" on public.intro_pages;
create policy "intro pages readable by both" on public.intro_pages
  for select to authenticated using (true);

drop policy if exists "publish the other's intro page" on public.intro_pages;
create policy "publish the other's intro page" on public.intro_pages
  for insert to authenticated with check (for_user <> auth.uid());

drop policy if exists "republish the other's intro page" on public.intro_pages;
create policy "republish the other's intro page" on public.intro_pages
  for update to authenticated using (for_user <> auth.uid()) with check (for_user <> auth.uid());

drop policy if exists "builder owns the draft" on public.intro_drafts;
create policy "builder owns the draft" on public.intro_drafts
  for all to authenticated using (for_user <> auth.uid()) with check (for_user <> auth.uid());

-- 3. Private bucket for uploaded photos / GIFs (20 MB cap, images only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('intro-media', 'intro-media', false, 20971520,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "intro media readable by both" on storage.objects;
create policy "intro media readable by both" on storage.objects
  for select to authenticated using (bucket_id = 'intro-media');

drop policy if exists "intro media upload" on storage.objects;
create policy "intro media upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'intro-media');

drop policy if exists "intro media delete own" on storage.objects;
create policy "intro media delete own" on storage.objects
  for delete to authenticated using (bucket_id = 'intro-media' and owner_id = auth.uid()::text);

-- 4. Turn today's text intros into a starter page, so nothing changes until someone rebuilds it.
insert into public.intro_pages (for_user, doc, updated_by)
select
  i.for_user,
  jsonb_build_object(
    'version', 1,
    'background', jsonb_build_object('kind', 'preset', 'value', 'dark'),
    'blocks', jsonb_build_array(
      jsonb_build_object('id', 'greeting', 'type', 'heading',
        'props', jsonb_build_object('text', 'Hello, ', 'accent', i.nickname)),
      jsonb_build_object('id', 'intro', 'type', 'text',
        'props', jsonb_build_object('text', i.intro, 'size', 'md')),
      jsonb_build_object('id', 'aside', 'type', 'text',
        'props', jsonb_build_object('text', i.aside, 'size', 'sm')),
      jsonb_build_object('id', 'letters-button', 'type', 'button',
        'props', jsonb_build_object('label', 'This :3', 'color', 'cyan')),
      jsonb_build_object('id', 'characters', 'type', 'image',
        'props', jsonb_build_object('src', 'asset:characters', 'width', 0.62, 'align', 'center'))
    ),
    'stickers', '[]'::jsonb
  ),
  i.updated_by
from public.intros i
on conflict (for_user) do nothing;

-- The builder starts editing from what's currently published
insert into public.intro_drafts (for_user, doc)
select for_user, doc from public.intro_pages
on conflict (for_user) do nothing;
