-- Push notifications: the database writes an outbox row whenever something worth a buzz
-- happens, then pings the Vercel function /api/push, which sends it to each device.
-- Run in Supabase: SQL Editor > New query (after 0009).
--
-- BEFORE running: Database > Extensions > enable "pg_net" and "pg_cron".
-- AFTER running: put the function's address and a shared secret in Vault (bottom of this file).
--
-- What buzzes: a letter sent, a letter unlocking (its date arrives, the writer unlocks it,
-- or the letter before it gets read), and your landing page being published.
-- Edits never buzz, so rewriting a letter the next day stays quiet.

-- 1. Devices that asked for notifications. Written only through the functions below,
--    so a phone that switches accounts moves its subscription instead of erroring.
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "see own devices" on public.push_subscriptions;
create policy "see own devices" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth;
$$;

create or replace function public.drop_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke all on function public.save_push_subscription(text, text, text) from public, anon;
revoke all on function public.drop_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.drop_push_subscription(text) to authenticated;

-- 2. The outbox. Only triggers write it; you can read your own (for a history page later).
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  recipient  uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('sent', 'unlocked', 'page', 'reply', 'reaction', 'test')),
  title      text not null,
  body       text not null default '',
  url        text not null default '/home',
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  attempts   int not null default 0,
  sent_at    timestamptz
);

alter table public.notifications enable row level security;

drop policy if exists "see own notifications" on public.notifications;
create policy "see own notifications" on public.notifications
  for select to authenticated using (recipient = auth.uid());

-- 3. Per-letter custom text, and whether its unlock has been announced yet
alter table public.letters
  add column if not exists notify_title text,
  add column if not exists notify_body text,
  add column if not exists unlock_notified_at timestamptz;

-- 4. Helpers
create or replace function public.display_name_of(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select display_name from public.profiles where id = p_user), 'someone');
$$;

-- There are exactly two of us: whoever isn't p_user
create or replace function public.other_user(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where id is distinct from p_user order by id limit 1;
$$;

-- A rule (date / after / manual) has been met. A full quota doesn't count: that's
-- "you've opened enough this week", not a letter unlocking, so it never buzzes.
create or replace function public.letter_rule_met(p_letter public.letters, p_reader uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not l.locked or l.reason = 'quota' from public.letter_lock(p_letter, p_reader) l;
$$;

-- The words on the lock screen. The custom title/line belongs to the moment the letter
-- can actually be opened: on send if it's open right away, otherwise on unlock.
create or replace function public.letter_notice(p_letter public.letters, p_kind text, p_custom boolean,
                                                out title text, out body text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  w text := public.display_name_of(p_letter.author_id);
  shown text := case when p_letter.sealed or coalesce(trim(p_letter.title), '') in ('', 'untitled') then null
                     else trim(p_letter.title) end;
begin
  if p_kind = 'sent' then
    if p_letter.section = 'open_when' then
      title := w || ' left you an "open when" letter';
      body := case when shown is null then 'for one of those days :3' else 'for when you''re ' || shown end;
    else
      title := (array[w || ' sent you something', 'a letter from ' || w,
                      'psst, ' || w || ' wrote you something', 'new letter from ' || w])[1 + (p_letter.id % 4)::int];
      body := coalesce('"' || shown || '"', 'tap to open it');
    end if;
    if not p_custom then
      body := 'locked for now hehe, you''ll know when it opens';
    end if;
  else
    title := 'a letter just unlocked';
    body := coalesce('"' || shown || '" is ready for you', 'one of ' || w || '''s letters is ready');
  end if;

  if p_custom then
    title := coalesce(nullif(trim(p_letter.notify_title), ''), title);
    body := coalesce(nullif(trim(p_letter.notify_body), ''), body);
  end if;
end;
$$;

-- 5. Sending a letter. BEFORE, so it can mark "nothing left to unlock" on the same row.
create or replace function public.letters_on_send()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reader uuid := public.other_user(new.author_id);
  open_now boolean;
  n record;
begin
  if new.published_at is null or reader is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.published_at is not null then
    return new; -- an edit, not a send
  end if;

  open_now := new.rule is null or public.letter_rule_met(new, reader);
  new.unlock_notified_at := case when open_now then now() end;

  select * into n from public.letter_notice(new, 'sent', open_now);
  insert into public.notifications (recipient, kind, title, body, url)
  values (reader, 'sent', n.title, n.body, '/lettersPage');
  return new;
end;
$$;

drop trigger if exists letters_on_send on public.letters;
create trigger letters_on_send
  before insert or update of published_at on public.letters
  for each row execute function public.letters_on_send();

-- 6. Unlocks: announce every sent letter whose rule is now met and hasn't been announced.
--    Called right away when the writer unlocks or a letter is read, and every minute for dates.
create or replace function public.notify_unlocks(p_reader uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.letters;
  n record;
begin
  for l in
    select * from public.letters
    where published_at is not null and unlock_notified_at is null
      and author_id is distinct from p_reader and rule is not null
    for update skip locked
  loop
    if public.letter_rule_met(l, p_reader) then
      update public.letters set unlock_notified_at = now() where id = l.id;
      select * into n from public.letter_notice(l, 'unlocked', true);
      insert into public.notifications (recipient, kind, title, body, url)
      values (p_reader, 'unlocked', n.title, n.body, '/lettersPage');
    end if;
  end loop;
end;
$$;

create or replace function public.letters_on_writer_unlock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_unlocks(public.other_user(new.author_id));
  return null;
end;
$$;

drop trigger if exists letters_on_writer_unlock on public.letters;
create trigger letters_on_writer_unlock
  after update of unlocked_by_writer on public.letters
  for each row when (new.unlocked_by_writer and not old.unlocked_by_writer)
  execute function public.letters_on_writer_unlock();

create or replace function public.letter_opens_unlock_next()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_unlocks(new.reader_id); -- "after this one" letters may have just opened up
  return null;
end;
$$;

drop trigger if exists letter_opens_unlock_next on public.letter_opens;
create trigger letter_opens_unlock_next
  after insert on public.letter_opens
  for each row execute function public.letter_opens_unlock_next();

-- 7. Landing page published
create or replace function public.intro_pages_on_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  w text := public.display_name_of(coalesce(new.updated_by, public.other_user(new.for_user)));
begin
  if tg_op = 'UPDATE' and new.doc is not distinct from old.doc then
    return null;
  end if;
  insert into public.notifications (recipient, kind, title, body, url)
  values (new.for_user, 'page',
          case when tg_op = 'INSERT' then w || ' made you a page' else w || ' updated your page' end,
          'go look :3', '/letters');
  return null;
end;
$$;

drop trigger if exists intro_pages_on_publish on public.intro_pages;
create trigger intro_pages_on_publish
  after insert or update on public.intro_pages
  for each row execute function public.intro_pages_on_publish();

-- 8. "Send me a test" from the hub, to check a phone is set up
create or replace function public.push_test()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (recipient, kind, title, body, url)
  values (auth.uid(), 'test', 'it works :3', 'this phone will buzz when something lands', '/home');
$$;

revoke all on function public.push_test() from public, anon;
grant execute on function public.push_test() to authenticated;

-- 9. Wake the sender. Reads its address and secret from Vault; does nothing until they're set.
create or replace function public.push_kick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret)
  );
end;
$$;

create or replace function public.notifications_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_kick();
  return null;
end;
$$;

drop trigger if exists notifications_on_insert on public.notifications;
create trigger notifications_on_insert
  after insert on public.notifications
  for each statement execute function public.notifications_on_insert();

-- 10. What the sender calls (service role only). Claiming stops two runs sending one twice;
--     anything a day old is dropped rather than buzzing about old news.
create or replace function public.claim_notifications()
returns table (id bigint, recipient uuid, title text, body text, url text)
language sql
security definer
set search_path = public
as $$
  update public.notifications n
  set claimed_at = now(), attempts = n.attempts + 1
  where n.id in (
    select q.id from public.notifications q
    where q.sent_at is null and q.attempts < 5 and q.created_at > now() - interval '1 day'
      and (q.claimed_at is null or q.claimed_at < now() - interval '2 minutes')
    order by q.id
    limit 50
    for update skip locked
  )
  returning n.id, n.recipient, n.title, n.body, n.url;
$$;

create or replace function public.push_targets(p_recipients uuid[])
returns table (user_id uuid, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = public
as $$
  select user_id, endpoint, p256dh, auth from public.push_subscriptions where user_id = any (p_recipients);
$$;

create or replace function public.push_done(p_sent bigint[], p_dead text[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications set sent_at = now() where id = any (p_sent);
  delete from public.push_subscriptions where endpoint = any (p_dead); -- uninstalled / revoked devices
$$;

revoke all on function public.claim_notifications() from public, anon, authenticated;
revoke all on function public.push_targets(uuid[]) from public, anon, authenticated;
revoke all on function public.push_done(bigint[], text[]) from public, anon, authenticated;
grant execute on function public.claim_notifications() to service_role;
grant execute on function public.push_targets(uuid[]) to service_role;
grant execute on function public.push_done(bigint[], text[]) to service_role;

revoke all on function public.letter_notice(public.letters, text, boolean) from public, anon, authenticated;
revoke all on function public.letter_rule_met(public.letters, uuid) from public, anon, authenticated;
revoke all on function public.notify_unlocks(uuid) from public, anon, authenticated;
revoke all on function public.push_kick() from public, anon, authenticated;

-- 11. Every minute: announce date unlocks, retry anything unsent, tidy old rows
create or replace function public.push_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_unlocks(p.id) from public.profiles p;
  if exists (select 1 from public.notifications
             where sent_at is null and attempts < 5 and created_at > now() - interval '1 day') then
    perform public.push_kick();
  end if;
  delete from public.notifications where created_at < now() - interval '30 days';
end;
$$;

revoke all on function public.push_tick() from public, anon, authenticated;

-- Letters already sent and already open don't get a late "unlocked" buzz
update public.letters l
set unlock_notified_at = now()
where l.published_at is not null and l.unlock_notified_at is null
  and (l.rule is null or public.letter_rule_met(l, public.other_user(l.author_id)));

select cron.schedule('push-tick', '* * * * *', 'select public.push_tick()');

-- AFTER running, once (swap in a long random secret; the same one goes in Vercel as PUSH_SECRET):
--   select vault.create_secret('https://us.dizziedbliss.lol/api/push', 'push_url');
--   select vault.create_secret('PASTE_A_LONG_RANDOM_SECRET', 'push_secret');
