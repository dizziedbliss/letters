-- See 00_supabase_stub.sql for how to run. Expected results are in the --- lines.
insert into letters (id, title, body, author_id) overriding system value values (1, 'first one', E'hi saumi\n\nmiss u', '00000000-0000-0000-0000-00000000000a'), (2, 'second one', 'heheh', '00000000-0000-0000-0000-00000000000a') on conflict (id) do nothing;
\set max '00000000-0000-0000-0000-00000000000a'
\set her '00000000-0000-0000-0000-00000000000b'
-- Max writes a spread of locked letters (as the database owner, to set things up)
insert into letters (id, title, body, author_id, sealed, section, rule) overriding system value values
  (10, 'SECRET sealed title', '', :'max', true,  'random', null),
  (11, 'future date',         '', :'max', false, 'random', jsonb_build_object('kind','date','at', now() + interval '3 days')),
  (12, 'after first one',     '', :'max', false, 'random', '{"kind":"after","letter_id":1}'),
  (13, 'when on call',        '', :'max', false, 'random', '{"kind":"manual"}'),
  (20, 'sick',  '', :'max', false, 'open_when', null),
  (21, 'sad',   '', :'max', false, 'open_when', null),
  (22, 'bored', '', :'max', false, 'open_when', null),
  (30, 'her own letter', '', :'her', false, 'random', null);
insert into letter_bodies (letter_id, doc) values (10, '[{"type":"paragraph","content":"TOP SECRET BODY"}]'), (11, '[{"type":"paragraph","content":"FUTURE BODY"}]');
select setval(pg_get_serial_sequence('letters','id'), 100);
update profiles set timezone = 'Asia/Kolkata' where true;
insert into profiles (id, display_name, timezone) values (:'max','Max','Asia/Kolkata'), (:'her','Saumi','Asia/Kolkata') on conflict (id) do update set timezone = excluded.timezone;

\echo '===== as HER ====='
set role authenticated;
select set_config('request.jwt.claim.sub', :'her', false) \gset

\echo '--- 1. direct select on letters (expect only her own letter 30)'
select id, title from letters order by id;
\echo '--- 2. direct select on letter_bodies (expect 0 rows)'
select count(*) as bodies_visible from letter_bodies;
\echo '--- 3. the index (sealed title hidden, own letter absent, groups named)'
select id, title, sealed, section, group_name, locked, lock_reason, unlock_at is not null as has_unlock_at, after_title from letter_index() order by id;
\echo '--- 4. open future-dated letter (expect: locked: date)'
select id from open_letter(11);
\echo '--- 5. open "after" letter before its prerequisite (expect: locked: after)'
select id from open_letter(12);
\echo '--- 6. open the prerequisite, then the "after" letter (both expect OK)'
select id, title, doc from open_letter(1);
select id, title from open_letter(12);
\echo '--- 7. sealed letter opens (no rule), title revealed afterwards'
select id, title, doc from open_letter(10);
select id, title from letter_index() where id = 10;
\echo '--- 8. open-when quota 2/week: sick OK, sad OK, bored LOCKED quota'
select id from open_letter(20);
select id from open_letter(21);
select id from open_letter(22);
select id, lock_reason, to_char(unlock_at at time zone 'Asia/Kolkata', 'Dy YYYY-MM-DD HH24:MI') as unlocks_local from letter_index() where id = 22;
\echo '--- 9. re-reading an opened letter is free (expect OK even at quota)'
select id from open_letter(20);
\echo '--- 10. cheat: insert an open directly (expect permission/RLS error)'
insert into letter_opens (reader_id, letter_id) values (:'her', 13);
\echo '--- 11. cheat: unlock Max''s manual letter herself (expect 0 rows updated)'
update letters set unlocked_by_writer = true where id = 13;
select id from open_letter(13);
\echo '--- 12. cheat: open her own letter as if it were for her (expect not found)'
select id from open_letter(30);

\echo '===== as MAX: unlock the manual letter ====='
select set_config('request.jwt.claim.sub', :'max', false) \gset
select unlock_letter(13);
\echo '--- Max sees when she opened his letters'
select letter_id, opened_at is not null as opened from letter_opens order by letter_id;

\echo '===== HER again: manual letter now opens ====='
select set_config('request.jwt.claim.sub', :'her', false) \gset
select id, title from open_letter(13);

\echo '===== as ANON ====='
reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false) \gset
select count(*) from letter_index();
