-- See 00_supabase_stub.sql for how to run (after 10_locks.sql). Expected results in --- lines.
\set max '00000000-0000-0000-0000-00000000000a'
\set her '00000000-0000-0000-0000-00000000000b'
reset role;
delete from notifications;
set role authenticated;
select set_config('request.jwt.claim.sub', :'max', false) \gset
insert into letters (title, section, sealed, group_id) values ('thread me', 'random', false, null) returning id as l \gset
insert into letter_bodies (letter_id, doc) values (:l, '[{"type":"paragraph","content":"v1"}]');
reset role; update letters set group_id = null where id = :l; set role authenticated; -- her weekly limit is used up by 10_locks
select set_config('request.jwt.claim.sub', :'max', false) \gset

\echo '--- 1. editing a draft is not "edited" (expect null)'
update letter_bodies set doc = '[{"type":"paragraph","content":"v2"}]' where letter_id = :l;
select edited_at is null as not_edited from letters where id = :l;

\echo '--- 2. send, then save the same body again (expect still null), then change it (expect set)'
update letters set published_at = now() where id = :l;
update letter_bodies set doc = doc where letter_id = :l;
select edited_at is null as not_edited from letters where id = :l;
update letter_bodies set doc = '[{"type":"paragraph","content":"v3"}]' where letter_id = :l;
select edited_at is not null as edited from letters where id = :l;
\echo '--- 2b. settings changes (section, sealed) do not count; a title change does'
reset role; update letters set edited_at = null where id = :l; set role authenticated;
select set_config('request.jwt.claim.sub', :'max', false) \gset
update letters set sealed = true where id = :l;
update letters set sealed = false, section = 'random' where id = :l;
select edited_at is null as not_edited from letters where id = :l;
update letters set title = 'thread me!' where id = :l;
select edited_at is not null as edited from letters where id = :l;

reset role; update letters set group_id = null where id = :l; set role authenticated; -- 2b's section save re-grouped it

\echo '--- 3. she cannot see or join the thread before opening it (expect 3 errors)'
select set_config('request.jwt.claim.sub', :'her', false) \gset
select get_thread(:l);
select add_reply(:l, 'text', 'sneaky', null);
select toggle_reaction(:l, null, '💖');

\echo '--- 4. she opens it (sees edited_at), reacts and replies'
select title, edited_at is not null as shows_edited from open_letter(:l);
select toggle_reaction(:l, null, '💖') as on1;
select add_reply(:l, 'text', '  hiii  ', null) ->> 'body' as reply_body;
select add_reply(:l, 'gif', null, '{"url":"https://static.klipy.com/x.gif","width":200,"height":150}') ->> 'kind' as reply_kind;
\echo '--- 4b. a text reply with no text, and a gif without media (expect 2 errors)'
select add_reply(:l, 'text', '   ', null);
select add_reply(:l, 'gif', null, null);

\echo '--- 5. Max now cannot unsend (expect error)'
select set_config('request.jwt.claim.sub', :'max', false) \gset
update letters set published_at = null where id = :l;

\echo '--- 6. Max has 3 unread (2 replies + 1 reaction); sees the thread; then 0'
select unread from thread_activity() where letter_id = :l;
select jsonb_array_length(get_thread(:l) -> 'replies') as replies, jsonb_array_length(get_thread(:l) -> 'reactions') as reactions;
select mark_thread_seen(:l);
select unread from thread_activity() where letter_id = :l;

\echo '--- 7. Max reacts to her first reply, toggles 😭 on then off (expect true, true, false)'
select (get_thread(:l) -> 'replies' -> 0 ->> 'id')::bigint as r1 \gset
select toggle_reaction(:l, :r1, '🥺');
select toggle_reaction(:l, :r1, '😭');
select toggle_reaction(:l, :r1, '😭');
\echo '--- 7b. reacting with a reply from another letter (expect error)'
select toggle_reaction(:l, 999999, '🥺');

\echo '--- 8. she cannot delete Max''s reply; Max replies and deletes his own (expect her delete = no-op)'
select add_reply(:l, 'text', 'hehe ty', null) ->> 'id' as mine \gset
select set_config('request.jwt.claim.sub', :'her', false) \gset
select delete_reply(:mine);
select jsonb_array_length(get_thread(:l) -> 'replies') as replies_after_her_delete;
select set_config('request.jwt.claim.sub', :'max', false) \gset
select delete_reply(:mine);
select jsonb_array_length(get_thread(:l) -> 'replies') as replies_after_his_delete;

\echo '--- 9. notifications: replies buzz the other person with the right link; reactions rate-limited'
reset role;
select recipient = :'max' as to_max, kind, title, body, url from notifications order by id;
