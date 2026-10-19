import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.SESSION_SECRET;
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!SECRET || !PASSWORD) {
  console.error('ADMIN_PASSWORD and SESSION_SECRET must be set (see .env.example)');
  process.exit(1);
}

export const COOKIE = 'letters_admin';
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const sign = (payload) => createHmac('sha256', SECRET).update(payload).digest('base64url');

const safeEqual = (a, b) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

// Compare via HMAC so length differences don't leak
export const checkPassword = (input) =>
  safeEqual(sign(`pw:${input}`), sign(`pw:${PASSWORD}`));

export const issueToken = () => {
  const payload = String(Date.now() + MAX_AGE_MS);
  return `${payload}.${sign(payload)}`;
};

export const verifyToken = (token) => {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return false;
  return Number(payload) > Date.now();
};

export const readCookie = (req, name) => {
  const match = (req.headers.cookie || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};
