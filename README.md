# lettersvsdvsdvsvssbbdbdb
## Setup

1. **Supabase, one time:**
   - Authentication > Sign In / Providers: turn OFF "Allow new users to sign up".
   - Authentication > Users: add the two accounts (email + password; the password is the secret code typed on the landing page).
   - Database > Extensions: enable `pg_net` and `pg_cron` (0010 needs them).
   - SQL Editor: run `supabase/migrations/` in order, `0000` → `0012` (fill in the emails where a file asks).
2. **Env vars** (see `frontend/.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ACCOUNT_EMAILS`,
   `VITE_KLIPY_KEY`, `VITE_VAPID_PUBLIC_KEY`.
   Put them in `frontend/.env` locally, and in Vercel under Settings > Environment Variables.
3. **Vercel:** Root Directory = repo root. `vercel.json` handles install, build and SPA routing.

## Push notifications

The database writes a row to `notifications` when a letter is sent or unlocks, or a landing page
is published (`0010`), then pings `api/push.js` (a Vercel function that deploys with the site),
which sends it to every phone that turned notifications on from the hub.

1. Keys: `npx web-push generate-vapid-keys`, plus a long random `PUSH_SECRET`.
2. Vercel env (server only, never `VITE_`): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_SECRET`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. And `VITE_VAPID_PUBLIC_KEY` = the same public key.
3. Supabase SQL Editor, once:
   ```sql
   select vault.create_secret('https://us.dizziedbliss.lol/api/push', 'push_url');
   select vault.create_secret('<PUSH_SECRET>', 'push_secret');
   ```
4. Redeploy, open the hub on each phone, NOTIFS // TURN ON, then TEST.

## Demo (fake data, no Supabase needed)

```
cd frontend && npm ci && npm run demo
```

Log in with `max` or `saumi`. Everything runs against an in-browser fake database
(`src/demo/`), saved in your browser. Add `?reset-demo` to the URL to start over.

## Lock tests

`supabase/tests/` runs every migration against a throwaway Postgres in Docker and tries
to read locked letters and images as the reader. Instructions are at the top of
`00_supabase_stub.sql`.

## Local dev

```
cd frontend && npm ci && npm run dev
```

Type your secret code into the landing page field. Letters are written at `/write`.
