# lettersvsdvsdvsvssbbdbdb
## Dev

```
cd backend && cp .env.example .env   # set ADMIN_PASSWORD + SESSION_SECRET
npm install && npm run dev            # API on :3001 (Node >= 22.5, SQLite file in backend/data)
cd frontend && npm run dev            # proxies /api to :3001
```

Type the admin password into the landing page field to reach `/admin`.
