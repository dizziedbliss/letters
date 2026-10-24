# lettersvsdvsdvsvssbbdbdb
## Setup

1. **Supabase, one time:**
   - Authentication > Sign In / Providers: turn OFF "Allow new users to sign up".
   - Authentication > Users: add the two accounts (email + password; the password is the secret code typed on the landing page).
   - SQL Editor: run `supabase/migrations/` in order (`0000`, `0001`, then `0002` after filling in the emails).
2. **Env vars** (see `frontend/.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ACCOUNT_EMAILS`.
   Put them in `frontend/.env` locally, and in Vercel under Settings > Environment Variables.
3. **Vercel:** Root Directory = repo root. `vercel.json` handles install, build and SPA routing.

## Local dev

```
cd frontend && npm ci && npm run dev
```

Type your secret code into the landing page field. Letters are written at `/write`.
