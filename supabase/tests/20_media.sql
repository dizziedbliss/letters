-- Run after 10_locks.sql (same database). Expected results are in the --- lines.
\set max '00000000-0000-0000-0000-00000000000a'
\set her '00000000-0000-0000-0000-00000000000b'
reset role;
-- Max uploads 3 images: one in a locked, unopened letter (11), one in a letter she opened (1), one for the intro page
insert into storage.objects (bucket_id, name, owner_id) values
  ('intro-media', 'letters/locked-pic.webp', :'max'),
  ('intro-media', 'letters/opened-pic.webp', :'max'),
  ('intro-media', 'intro/page-pic.webp', :'max');
update letter_bodies set doc = '[{"type":"image","props":{"url":"storage:letters/locked-pic.webp"}}]' where letter_id = 11;
insert into letter_bodies (letter_id, doc) values (1, '[{"type":"image","props":{"url":"storage:letters/opened-pic.webp"}}]')
  on conflict (letter_id) do update set doc = excluded.doc;

\echo '===== media as HER ====='
set role authenticated;
select set_config('request.jwt.claim.sub', :'her', false) \gset
\echo '--- expect: intro/page-pic.webp and letters/opened-pic.webp only (NOT locked-pic)'
select name from storage.objects order by name;

\echo '===== media as MAX (uploader sees all three) ====='
select set_config('request.jwt.claim.sub', :'max', false) \gset
select name from storage.objects order by name;
