-- Display names for the two accounts, so letters can say "from Max".
-- Run AFTER you've created both users in Authentication > Users.

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
);

alter table public.profiles enable row level security;

drop policy if exists "profiles readable by both" on public.profiles;
create policy "profiles readable by both" on public.profiles
  for select to authenticated using (true);

drop policy if exists "edit own profile" on public.profiles;
create policy "edit own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Fill in the two rows (swap in the real emails and the names you want shown):
insert into public.profiles (id, display_name)
select id, 'Max' from auth.users where email = 'YOUR_EMAIL_HERE'
on conflict (id) do nothing;

insert into public.profiles (id, display_name)
select id, 'Saumi' from auth.users where email = 'HER_EMAIL_HERE'
on conflict (id) do nothing;

-- Your existing letters belong to you (from 0001):
update public.letters
set author_id = (select id from auth.users where email = 'YOUR_EMAIL_HERE')
where author_id is null;
