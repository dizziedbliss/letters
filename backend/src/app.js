import express from 'express';
import rateLimit from 'express-rate-limit';
import { letters } from './db.js';
import { COOKIE, MAX_AGE_MS, roleForCode, issueToken, verifyToken, readCookie } from './session.js';

const app = express();
const isProd = process.env.NODE_ENV === 'production';
app.disable('x-powered-by');
// Behind Vercel's proxy: trust it so rate limiting sees the real client IP
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/' };

const roleOf = (req) => verifyToken(readCookie(req, COOKIE));

const requireRole = (allowed) => (req, res, next) => {
  const role = roleOf(req);
  if (!role) return res.status(401).json({ error: 'unauthorized' });
  if (!allowed.includes(role)) return res.status(403).json({ error: 'forbidden' });
  next();
};
const requireAdmin = requireRole(['admin']);
const requireReader = requireRole(['reader', 'admin']);

// ---- auth -----------------------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many attempts, try again later' },
});

app.post('/api/login', loginLimiter, (req, res) => {
  const { code } = req.body ?? {};
  const role = typeof code === 'string' && code.trim() ? roleForCode(code.trim()) : null;
  if (!role) return res.status(401).json({ error: 'invalid' });
  res.cookie(COOKIE, issueToken(role), { ...cookieOpts, maxAge: MAX_AGE_MS });
  res.json({ role });
});

app.post('/api/logout', (_req, res) => {
  res.clearCookie(COOKIE, cookieOpts);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const role = roleOf(req);
  role ? res.json({ role }) : res.status(401).json({ error: 'unauthorized' });
});

// ---- admin letters CRUD ---------------------------------------------------
const parseLetter = (body) => {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const text = typeof body?.body === 'string' ? body.body : '';
  if (!title || title.length > 200 || text.length > 100_000) return null;
  return { title, text };
};

const parseId = (req) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

app.get('/api/admin/letters', requireAdmin, async (_req, res) => res.json(await letters.all()));

app.post('/api/admin/letters', requireAdmin, async (req, res) => {
  const parsed = parseLetter(req.body);
  if (!parsed) return res.status(400).json({ error: 'a title is required' });
  res.status(201).json(await letters.create(parsed.title, parsed.text));
});

app.put('/api/admin/letters/:id', requireAdmin, async (req, res) => {
  const id = parseId(req);
  const parsed = parseLetter(req.body);
  if (!id || !parsed) return res.status(400).json({ error: 'invalid letter' });
  const updated = await letters.update(id, parsed.title, parsed.text);
  updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});

app.delete('/api/admin/letters/:id', requireAdmin, async (req, res) => {
  const id = parseId(req);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  (await letters.remove(id)) ? res.json({ ok: true }) : res.status(404).json({ error: 'not found' });
});

// ---- reader endpoints (her page) ------------------------------------------
app.get('/api/letters', requireReader, async (_req, res) => res.json(await letters.all()));

// ?exclude=<id> avoids repeating the letter she's currently reading
app.get('/api/letters/random', requireReader, async (req, res) => {
  const exclude = Number(req.query.exclude);
  const letter = await letters.random(Number.isInteger(exclude) && exclude > 0 ? exclude : undefined);
  letter ? res.json(letter) : res.status(404).json({ error: 'no letters' });
});

app.get('/api/letters/:id', requireReader, async (req, res) => {
  const id = parseId(req);
  const letter = id ? await letters.get(id) : null;
  letter ? res.json(letter) : res.status(404).json({ error: 'not found' });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'server error' });
});

export default app;
