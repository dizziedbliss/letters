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

\echo '===== banners ====='
reset role;
insert into storage.objects (bucket_id, name, owner_id) values ('intro-media', 'letters/locked-banner.webp', :'max'), ('intro-media', 'letters/open-banner.webp', :'max');
update letter_bodies set banner = '{"src":"storage:letters/locked-banner.webp","height":"md","focus":50}' where letter_id = 11;
update letter_bodies set banner = '{"src":"storage:letters/open-banner.webp","height":"md","focus":50}' where letter_id = 1;
set role authenticated;
select set_config('request.jwt.claim.sub', :'her', false) \gset
\echo '--- banner of the opened letter visible, locked letter''s banner NOT'
select name from storage.objects where name like '%banner%' order by name;
\echo '--- open_letter returns the banner (expect open-banner src)'
select banner ->> 'src' as banner_src from open_letter(1);

\echo '===== looks ====='
reset role;
insert into storage.objects (bucket_id, name, owner_id) values ('intro-media', 'letters/locked-sticker.webp', :'max');
update letter_bodies set look = '{"background":{"kind":"preset","value":"purple"},"stickers":[{"kind":"image","value":"storage:letters/locked-sticker.webp"}]}' where letter_id = 11;
update letter_bodies set look = '{"background":{"kind":"preset","value":"paper"},"stickers":[]}' where letter_id = 1;
set role authenticated;
select set_config('request.jwt.claim.sub', :'her', false) \gset
\echo '--- locked letter''s sticker image NOT visible (expect 0)'
select count(*) as locked_sticker_rows from storage.objects where name = 'letters/locked-sticker.webp';
\echo '--- open_letter returns the look (expect paper)'
select look -> 'background' ->> 'value' as look_bg from open_letter(1);

\echo '===== media as MAX (uploader sees all three) ====='
select set_config('request.jwt.claim.sub', :'max', false) \gset
select name from storage.objects order by name;
