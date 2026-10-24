-- The gate's tile grid, shared: what either of you draws stays until one of you erases it.
-- Run in Supabase: SQL Editor > New query (after 0010).
--
-- Cells are counted from the middle of the screen (0,0 is the centre tile), so a phone shows
-- the middle of the drawing and a laptop shows more around it.
-- Live strokes and the other person's finger travel over a private Realtime channel ("gate");
-- this table is just what's saved.

create table if not exists public.gate_cells (
  x          smallint not null check (x between -150 and 150),
  y          smallint not null check (y between -150 and 150),
  color      smallint not null check (color between 1 and 4), -- purple, cyan, coral, ink
  painted_by uuid references auth.users (id) on delete set null default auth.uid(),
  painted_at timestamptz not null default now(),
  primary key (x, y)
);

alter table public.gate_cells enable row level security;

-- Both can look; nobody writes the table directly (paint_cells does, in one go)
drop policy if exists "gate readable by both" on public.gate_cells;
create policy "gate readable by both" on public.gate_cells
  for select to authenticated using (true);

create or replace function public.get_gate()
returns table (x smallint, y smallint, color smallint)
language sql
stable
security invoker
set search_path = public
as $$
  select x, y, color from public.gate_cells;
$$;

-- p_cells: [{"x":0,"y":-2,"c":3}, ...]; c = 0 erases
create or replace function public.paint_cells(p_cells jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if jsonb_array_length(p_cells) > 2000 then
    raise exception 'too many cells at once';
  end if;

  if exists (select 1 from jsonb_to_recordset(p_cells) as p(x int, y int, c int) where p.c is null or p.c not between 0 and 4) then
    raise exception 'unknown colour';
  end if;

  -- Only the last thing done to each cell in this batch counts (paint then erase = erased)
  with last as (
    select distinct on (p.x, p.y) p.x, p.y, p.c
    from rows from (jsonb_to_recordset(p_cells) as (x int, y int, c int)) with ordinality as p(x, y, c, n)
    order by p.x, p.y, p.n desc
  ), erased as (
    delete from public.gate_cells g using last
    where last.c = 0 and g.x = last.x and g.y = last.y
  )
  insert into public.gate_cells (x, y, color, painted_by, painted_at)
  select last.x, last.y, last.c, auth.uid(), now() from last where last.c > 0
  on conflict (x, y) do update set color = excluded.color, painted_by = excluded.painted_by, painted_at = excluded.painted_at;
end;
$$;

create or replace function public.clear_gate()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from public.gate_cells where true;
end;
$$;

revoke all on function public.paint_cells(jsonb) from public, anon;
revoke all on function public.clear_gate() from public, anon;
revoke all on function public.get_gate() from public, anon;
grant execute on function public.paint_cells(jsonb) to authenticated;
grant execute on function public.clear_gate() to authenticated;
grant execute on function public.get_gate() to authenticated;

-- Realtime: only the two of you can join the private "gate" channel, listen, or send on it
drop policy if exists "gate channel listen" on realtime.messages;
create policy "gate channel listen" on realtime.messages
  for select to authenticated using (realtime.topic() = 'gate');

drop policy if exists "gate channel send" on realtime.messages;
create policy "gate channel send" on realtime.messages
  for insert to authenticated with check (realtime.topic() = 'gate');
