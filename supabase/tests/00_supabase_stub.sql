-- Lock tests: run every migration against a throwaway Postgres, then try to read ahead as her.
-- Nothing here touches the real Supabase project.
--
--   docker run --rm -d --name letters-pgtest -e POSTGRES_PASSWORD=t \
--     -v $PWD/supabase:/sb postgres:16-alpine
--   P="docker exec -i letters-pgtest psql -U postgres -q"
--   $P -v ON_ERROR_STOP=1 < supabase/tests/00_supabase_stub.sql
--   for f in supabase/migrations/*.sql; do
--     sed -e 's/YOUR_EMAIL_HERE/max@x/g; s/HER_EMAIL_HERE/her@x/g' "$f" | $P -v ON_ERROR_STOP=1
--   done
--   $P < supabase/tests/10_locks.sql      # read the expectations in the --- lines
--   docker stop letters-pgtest
--
-- Note: seed letters 1 and 2 ("first one", "second one") are inserted after 0001 in the
-- original run; 10_locks.sql inserts them itself if missing.

-- Minimal stand-ins for what Supabase provides, so the real migrations run unchanged
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner_id text);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon;
grant select, insert, delete on storage.objects to authenticated;
grant usage on schema public, auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
alter default privileges in schema public grant all on sequences to authenticated, anon;
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'max@x'),
  ('00000000-0000-0000-0000-00000000000b', 'her@x');

-- 0010: pg_net, pg_cron and Vault stand-ins. http_post just records the call.
create role service_role nologin;
grant usage on schema public to service_role;
create schema net;
create table net.calls (id serial, url text, body jsonb, headers jsonb, at timestamptz default now());
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
                              headers jsonb default '{}', timeout_milliseconds int default 5000)
returns bigint language sql as
  $$ insert into net.calls (url, body, headers) values (url, body, headers) returning id $$;
create schema cron;
create table cron.job (jobname text primary key, schedule text, command text);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as
  $$ insert into cron.job values (job_name, schedule, command)
     on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning 1::bigint $$;
create schema vault;
create table vault.decrypted_secrets (name text primary key, decrypted_secret text);

-- 0011: Realtime's message table, so the channel policies can be created
create schema realtime;
create table realtime.messages (id bigserial, topic text, payload jsonb);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as
  $$ select current_setting('realtime.topic', true) $$;
