# lettersvsdvsdvsvssbbdbdb
## Setup

1. **Supabase:** run `backend/schema.sql` in the SQL Editor.
2. **Env vars** (see `.env.example`): `ADMIN_PASSWORD`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
   Put them in `.env` locally, and in Vercel under Settings > Environment Variables.
3. **Vercel:** Root Directory = repo root (not `frontend`). `vercel.json` handles build, `/api` and SPA routing.

## Local dev

```
npm install && npm install --prefix frontend
npm run dev:api                    # API on :3001
npm run dev --prefix frontend      # Vite, proxies /api to :3001
```

Type the admin password into the landing page field to reach `/admin`.
