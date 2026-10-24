-- See 00_supabase_stub.sql for how to run. Expected results in --- lines.
\set max '00000000-0000-0000-0000-00000000000a'
\set her '00000000-0000-0000-0000-00000000000b'
reset role;
delete from gate_cells;

\echo '--- 1. she paints 3 cells, one of them twice in the batch (expect 2 cells, (1,1) is coral=3)'
set role authenticated;
select set_config('request.jwt.claim.sub', :'her', false) \gset
select paint_cells('[{"x":0,"y":0,"c":1},{"x":1,"y":1,"c":2},{"x":1,"y":1,"c":3}]');
select x, y, color from get_gate() order by x, y;

\echo '--- 1b. paint then erase the same cell in one batch (expect (5,5) absent)'
select paint_cells('[{"x":5,"y":5,"c":2},{"x":5,"y":5,"c":0}]');
select count(*) as five_five from get_gate() where x = 5 and y = 5;

\echo '--- 2. Max sees it, erases (0,0), repaints (1,1) ink (expect only (1,1)=4, painted by Max)'
select set_config('request.jwt.claim.sub', :'max', false) \gset
select paint_cells('[{"x":0,"y":0,"c":0},{"x":1,"y":1,"c":4}]');
reset role;
select x, y, color, painted_by = :'max' as by_max from gate_cells;

\echo '--- 3. refused: direct insert, off the board, bad colour, signed out (expect 4 errors)'
set role authenticated;
select set_config('request.jwt.claim.sub', :'her', false) \gset
insert into gate_cells (x, y, color) values (5, 5, 1);
select paint_cells('[{"x":999,"y":0,"c":1}]');
select paint_cells('[{"x":0,"y":0,"c":9}]');
reset role;
set role anon;
select paint_cells('[{"x":0,"y":0,"c":1}]');

\echo '--- 4. clear (expect 0 cells)'
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :'her', false) \gset
select clear_gate();
select count(*) as cells from get_gate();

\echo '--- 5. channel policies: she can use "gate", not another topic (expect t, f)'
select set_config('realtime.topic', 'gate', false) \gset
select count(*) >= 0 as can_listen_gate from realtime.messages;
insert into realtime.messages (topic, payload) values ('gate', '{}');
select set_config('realtime.topic', 'other', false) \gset
insert into realtime.messages (topic, payload) values ('other', '{}');
