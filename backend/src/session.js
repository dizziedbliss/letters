import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.SESSION_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const READER_CODE = process.env.READER_CODE;
if (!SECRET || !ADMIN_PASSWORD || !READER_CODE) {
  throw new Error('ADMIN_PASSWORD, READER_CODE and SESSION_SECRET must be set (see .env.example)');
}

export const COOKIE = 'letters_session';
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const sign = (payload) => createHmac('sha256', SECRET).update(payload).digest('base64url');

const safeEqual = (a, b) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

// Compare via HMAC so length differences don't leak
const matches = (input, expected) => safeEqual(sign(`pw:${input}`), sign(`pw:${expected}`));

/** Returns the role a code unlocks, or null. Codes are case-insensitive for the reader. */
export const roleForCode = (input) => {
  if (matches(input, ADMIN_PASSWORD)) return 'admin';
  if (matches(input.toLowerCase(), READER_CODE.toLowerCase())) return 'reader';
  return null;
};

export const issueToken = (role) => {
  const payload = `${role}.${Date.now() + MAX_AGE_MS}`;
  return `${payload}.${sign(payload)}`;
};

/** Returns 'admin' | 'reader' | null */
export const verifyToken = (token) => {
  if (!token) return null;
  const [role, expires, sig] = token.split('.');
  if (!role || !expires || !sig || !safeEqual(sig, sign(`${role}.${expires}`))) return null;
  if (Number(expires) <= Date.now()) return null;
  return role === 'admin' || role === 'reader' ? role : null;
};

export const readCookie = (req, name) => {
  const match = (req.headers.cookie || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};
