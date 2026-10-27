-- See 00_supabase_stub.sql for how to run (after 10_locks.sql). Expected results in --- lines.
\set max '00000000-0000-0000-0000-00000000000a'
\set her '00000000-0000-0000-0000-00000000000b'
reset role;
delete from notifications;
insert into vault.decrypted_secrets values ('push_url', 'https://example.test/api/push'), ('push_secret', 's3cret')
  on conflict (name) do nothing;
truncate net.calls;

\echo '--- 1. cron job registered (expect push-tick, every minute)'
select jobname, schedule from cron.job;

\echo '--- 2. Max writes a draft (expect 0 notifications)'
set role authenticated;
select set_config('request.jwt.claim.sub', :'max', false) \gset
insert into letters (title, section, sealed) values ('a plain one', 'random', false) returning id as plain \gset
select count(*) as notifications from notifications;

\echo '--- 3. sends it (expect 1 for her: rotating "from Max" title, body is the title in quotes)'
update letters set published_at = now() where id = :plain;
reset role;
select recipient = :'her' as for_her, kind, title, body, url from notifications order by id;
\echo '--- 3b. the sender got pinged once (expect 1 call with the secret header)'
select url, headers ->> 'x-push-secret' as secret from net.calls;

\echo '--- 4. an edit after sending is refused (0013), and nothing buzzes (expect 1 error, still 1 notification)'
set role authenticated;
select set_config('request.jwt.claim.sub', :'max', false) \gset
update letters set title = 'a plain one (edited)', published_at = published_at where id = :plain;
reset role;
select count(*) as notifications from notifications;

\echo '--- 5. sealed + custom text, open right away (expect custom title and line)'
set role authenticated;
select set_config('request.jwt.claim.sub', :'max', false) \gset
insert into letters (title, section, sealed, notify_title, notify_body, published_at)
  values ('SECRET', 'random', true, 'hehe guess what', 'go go go', now());
reset role;
select title, body from notifications order by id desc limit 1;

\echo '--- 6. date-locked with custom text: send buzz is generic, custom text waits for the unlock'
set role authenticated;
select set_config('request.jwt.claim.sub', :'max', false) \gset
insert into letters (title, section, sealed, rule, notify_title, notify_body, published_at)
  values ('birthday', 'random', false, jsonb_build_object('kind','date','at', now() + interval '1 hour'),
          'HAPPY BIRTHDAY', 'open it nowww', now()) returning id as bday \gset
reset role;
select kind, title, body from notifications order by id desc limit 1;
\echo '--- 6b. tick before the date (expect no new rows)'
select push_tick();
select count(*) filter (where kind = 'unlocked') as unlocked_rows from notifications;
\echo '--- 6c. the date passes, tick (expect 1 unlocked row with the custom text), tick again (still 1)'
update letters set rule = jsonb_build_object('kind','date','at', now() - interval '1 minute') where id = :bday;
select push_tick();
select push_tick();
select kind, title, body from notifications where kind = 'unlocked';

\echo '--- 7. manual letter: send (generic), writer unlocks (expect unlocked buzz immediately)'
set role authenticated;
select set_config('request.jwt.claim.sub', :'max', false) \gset
insert into letters (title, section, sealed, rule, published_at)
  values ('on call', 'random', false, '{"kind":"manual"}', now()) returning id as manual \gset
select unlock_letter(:manual);
reset role;
select kind, body from notifications order by id desc limit 2;

\echo '--- 8. chapters: "after" letter unlocks when she reads the first one'
set role authenticated;
select set_config('request.jwt.claim.sub', :'max', false) \gset
insert into letters (title, section, sealed, published_at) values ('chapter one', 'random', false, now()) returning id as ch1 \gset
insert into letters (title, section, sealed, rule, published_at)
  values ('chapter two', 'random', false, jsonb_build_object('kind','after','letter_id', :ch1), now());
reset role;
update letters set group_id = null where title in ('chapter one', 'chapter two'); -- her weekly limit is used up by 10_locks
set role authenticated;
select set_config('request.jwt.claim.sub', :'her', false) \gset
select id from open_letter(:ch1);
reset role;
select kind, body from notifications order by id desc limit 1;

\echo '--- 9. her landing page published by Max (expect "Max updated your page" or "made you a page")'
set role authenticated;
select set_config('request.jwt.claim.sub', :'max', false) \gset
insert into intro_pages (for_user, doc) values (:'her', '{"version":2,"n":1}')
  on conflict (for_user) do update set doc = excluded.doc, published_at = now();
reset role;
select recipient = :'her' as for_her, title, url from notifications where kind = 'page';

\echo '--- 10. she cannot write the outbox or call the sender functions (expect 3 errors)'
set role authenticated;
select set_config('request.jwt.claim.sub', :'her', false) \gset
insert into notifications (recipient, kind, title) values (:'max', 'test', 'spoof');
select * from claim_notifications();
select push_kick();
\echo '--- 10b. she sees only her own notifications (expect all for_her = true)'
select bool_and(recipient = :'her') as all_hers, count(*) > 0 as some from notifications;

\echo '--- 11. subscriptions: save, switch account on the same phone, drop'
select save_push_subscription('https://push.test/abc', 'p', 'a');
select set_config('request.jwt.claim.sub', :'max', false) \gset
select save_push_subscription('https://push.test/abc', 'p2', 'a2');
reset role;
select user_id = :'max' as moved_to_max, p256dh from push_subscriptions;

\echo '--- 12. claim as the sender: second claim gets nothing (no double sends)'
select array_agg(id) as all_ids from notifications \gset
set role service_role;
select count(*) as first_claim from claim_notifications();
select count(*) as second_claim from claim_notifications();
select push_done(:'all_ids'::bigint[], array['https://push.test/abc']);
reset role;
select count(*) filter (where sent_at is null) as unsent, (select count(*) from push_subscriptions) as devices from notifications;
