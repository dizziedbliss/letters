import express from 'express';
import rateLimit from 'express-rate-limit';
import { letters } from './db.js';
import { COOKIE, MAX_AGE_MS, checkPassword, issueToken, verifyToken, readCookie } from './session.js';

const app = express();
const isProd = process.env.NODE_ENV === 'production';
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/' };

const requireAdmin = (req, res, next) =>
  verifyToken(readCookie(req, COOKIE)) ? next() : res.status(401).json({ error: 'unauthorized' });

// ---- auth -----------------------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many attempts, try again later' },
});

app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { code } = req.body ?? {};
  if (typeof code !== 'string' || !checkPassword(code.trim())) {
    return res.status(401).json({ error: 'invalid' });
  }
  res.cookie(COOKIE, issueToken(), { ...cookieOpts, maxAge: MAX_AGE_MS });
  res.json({ ok: true });
});

app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie(COOKIE, cookieOpts);
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAdmin, (_req, res) => res.json({ ok: true }));

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

app.get('/api/admin/letters', requireAdmin, (_req, res) => res.json(letters.all()));

app.post('/api/admin/letters', requireAdmin, (req, res) => {
  const parsed = parseLetter(req.body);
  if (!parsed) return res.status(400).json({ error: 'a title is required' });
  res.status(201).json(letters.create(parsed.title, parsed.text));
});

app.put('/api/admin/letters/:id', requireAdmin, (req, res) => {
  const id = parseId(req);
  const parsed = parseLetter(req.body);
  if (!id || !parsed) return res.status(400).json({ error: 'invalid letter' });
  const updated = letters.update(id, parsed.title, parsed.text);
  updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
});

app.delete('/api/admin/letters/:id', requireAdmin, (req, res) => {
  const id = parseId(req);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  letters.remove(id) ? res.json({ ok: true }) : res.status(404).json({ error: 'not found' });
});

// ---- reader endpoints (her page) -- TODO ----------------------------------
// Stubbed on purpose: her gate is currently a client-side check only, so serving
// letters here would make them readable by anyone. Add real auth for her first,
// then use letters.all() / letters.random() / letters.get(id).
const notYet = (_req, res) => res.status(501).json({ error: 'not implemented yet' });
app.get('/api/letters', notYet);
app.get('/api/letters/random', notYet);
app.get('/api/letters/:id', notYet);

app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`letters api on :${port}`));
