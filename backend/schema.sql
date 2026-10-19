-- Run once in Supabase: SQL Editor > New query
create table if not exists public.letters (
  id         bigint generated always as identity primary key,
  title      text not null,
  body       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS on with no policies: the public anon key can't touch this table.
-- Only the backend (service role key) reads/writes it.
alter table public.letters enable row level security;
