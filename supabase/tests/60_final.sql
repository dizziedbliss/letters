-- See 00_supabase_stub.sql for how to run (after 10_locks.sql). Expected results in --- lines.
\set max '00000000-0000-0000-0000-00000000000a'
\set her '00000000-0000-0000-0000-00000000000b'
set role authenticated;
select set_config('request.jwt.claim.sub', :'max', false) \gset
insert into letters (title, section) values ('final one', 'random') returning id as l \gset
insert into letter_bodies (letter_id, doc) values (:l, '[{"type":"paragraph","content":"draft"}]');

\echo '--- 1. drafts stay editable (expect no errors)'
update letters set title = 'final one!', sealed = true where id = :l;
update letter_bodies set doc = '[{"type":"paragraph","content":"v2"}]' where letter_id = :l;

\echo '--- 2. sent: title, body, banner, look, rule, custom text all refused (expect 6 errors)'
update letters set published_at = now() where id = :l;
update letters set title = 'sneaky edit' where id = :l;
update letter_bodies set doc = '[]' where letter_id = :l;
update letter_bodies set banner = '{"src":"x"}' where letter_id = :l;
update letter_bodies set look = '{}' where letter_id = :l;
update letters set rule = '{"kind":"manual"}' where id = :l;
update letters set notify_title = 'hi' where id = :l;

\echo '--- 3. still allowed on a sent letter: unlock, group change, a save that changes nothing (expect no errors)'
update letters set unlocked_by_writer = true where id = :l;
update letters set group_id = null where id = :l;
update letters set title = title, updated_at = now() where id = :l;

\echo '--- 4. unsend before it is opened, edit, resend (expect no errors, new title)'
update letters set published_at = null where id = :l;
update letters set title = 'fixed typo' where id = :l;
update letter_bodies set doc = '[{"type":"paragraph","content":"fixed"}]' where letter_id = :l;
update letters set published_at = now() where id = :l;
select title from letters where id = :l;

\echo '--- 5. she opens it; now no unsend and no delete (expect 2 errors, letter still there)'
reset role; update letters set group_id = null, sealed = sealed where id = :l; set role authenticated;
select set_config('request.jwt.claim.sub', :'her', false) \gset
select id from open_letter(:l);
select set_config('request.jwt.claim.sub', :'max', false) \gset
update letters set published_at = null where id = :l;
delete from letters where id = :l;
select count(*) as still_there from letters where id = :l;

\echo '--- 6. an unopened sent letter can be deleted (expect 0 left)'
insert into letters (title, section, published_at) values ('oops', 'random', now()) returning id as l2 \gset
delete from letters where id = :l2;
select count(*) as left_over from letters where id = :l2;
