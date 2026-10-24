# lettersvsdvsdvsvssbbdbdb
## Setup

1. **Supabase, one time:**
   - Authentication > Sign In / Providers: turn OFF "Allow new users to sign up".
   - Authentication > Users: add the two accounts (email + password; the password is the secret code typed on the landing page).
   - SQL Editor: run `supabase/migrations/` in order, `0000` → `0006` (fill in the emails where a file asks).
2. **Env vars** (see `frontend/.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ACCOUNT_EMAILS`.
   Put them in `frontend/.env` locally, and in Vercel under Settings > Environment Variables.
3. **Vercel:** Root Directory = repo root. `vercel.json` handles install, build and SPA routing.

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
