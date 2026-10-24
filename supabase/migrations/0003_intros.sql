-- Personal intro pages: each person's "Hello, ___" page is written by the OTHER person.
-- Run in Supabase: SQL Editor > New query. Swap HER_EMAIL_HERE for her real email first.

create table if not exists public.intros (
  for_user   uuid primary key references auth.users (id) on delete cascade,
  nickname   text not null default '',  -- "Hello, <nickname>"
  intro      text not null default '',  -- intro paragraphs (blank line = new paragraph)
  aside      text not null default '',  -- small line above the button
  note       text not null default '',  -- shown on the letters page before the first "more?"
  updated_by uuid references auth.users (id) default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.intros enable row level security;

drop policy if exists "intros readable by both" on public.intros;
create policy "intros readable by both" on public.intros
  for select to authenticated using (true);

-- You can only write the other person's intro, never your own
drop policy if exists "write the other's intro" on public.intros;
create policy "write the other's intro" on public.intros
  for insert to authenticated with check (for_user <> auth.uid());

drop policy if exists "edit the other's intro" on public.intros;
create policy "edit the other's intro" on public.intros
  for update to authenticated using (for_user <> auth.uid()) with check (for_user <> auth.uid());

-- Her intro starts as exactly what the site shows today
insert into public.intros (for_user, nickname, intro, aside, note, updated_by)
select
  u.id,
  'Saumiiiiii',
  E'This thing is currently under construction lol, apparently the owner of this website is currently doing something totally useless, uhm please forgive him... since he has done this much\u2014 he\u2019ll be updating this soon.\n\nplease be in touch <3',
  'until then u can read these :3',
  'ILOVEYOUUUUUUUUUUUUUUUUUUUUUUUUUUSOOOOOOOOOOOOOOOMCUHHHHHHHHHHHHHHHHHHHHHHHH ILOVEYOUSOOMUCHHHHH ILOVEYOUSOOOSOSOSOOSSOOSSOOSOMUCHHHH ILOVEYOUUSOOOOMUCHHHHMUCHMUHCUHCHCHH ILOVEYOUUUUUUUUUUUUUUUUUSAUUMMMIIIIIIII HEHHE <3',
  null
from auth.users u
where u.email = 'HER_EMAIL_HERE'
on conflict (for_user) do nothing;
