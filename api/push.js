// Sends whatever is waiting in the notifications outbox (see supabase/migrations/0010).
// Supabase pings this (pg_net) whenever a row lands, and every minute while anything is unsent.
// Vercel env: PUSH_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
// (and optionally VAPID_SUBJECT). None of these ever reach the browser.

import { timingSafeEqual } from 'node:crypto';
import webpush from 'web-push';

// The site's own build setting holds the same address, so either name works
const supabaseUrl = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

const env = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
};

// Call one of the service-role-only database functions
async function rpc(fn, args = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  // New-style secret keys (sb_secret_...) go only in apikey; legacy JWT keys also as the bearer
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  const url = supabaseUrl();
  if (!url) throw new Error('missing env SUPABASE_URL');
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Send one claimed batch. Returns what happened, for the logs. */
export async function sendBatch(send = webpush.sendNotification) {
  const batch = await rpc('claim_notifications');
  if (!batch.length) return { sent: 0, failed: 0, dead: 0 };

  const recipients = [...new Set(batch.map((n) => n.recipient))];
  const targets = await rpc('push_targets', { p_recipients: recipients });

  const sent = [];
  const dead = new Set();
  let failed = 0;

  for (const n of batch) {
    const devices = targets.filter((t) => t.user_id === n.recipient);
    const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: `n${n.id}` });
    let delivered = devices.length === 0; // nobody to tell: done, don't retry forever
    let retry = false;

    await Promise.all(
      devices.map(async (d) => {
        try {
          await send({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, {
            TTL: 60 * 60 * 24, // a phone that's off still gets it within a day
            urgency: 'high',
          });
          delivered = true;
        } catch (err) {
          // 404/410: the browser dropped this subscription (site data cleared, permission revoked)
          if (err.statusCode === 404 || err.statusCode === 410) dead.add(d.endpoint);
          else {
            retry = true;
            console.error('push to a device failed:', err.statusCode ?? err.code, err.body ?? err.message);
          }
        }
      })
    );

    if (delivered || !retry) sent.push(n.id);
    else failed++;
  }

  await rpc('push_done', { p_sent: sent, p_dead: [...dead] });
  return { sent: sent.length, failed, dead: dead.size };
}

const sameSecret = (given) => {
  const want = Buffer.from(process.env.PUSH_SECRET || '');
  const got = Buffer.from(String(given || ''));
  return want.length > 0 && got.length === want.length && timingSafeEqual(got, want);
};

const SETTINGS = ['PUSH_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];

export default async function handler(req, res) {
  // Opening /api/push in a browser: which settings this deploy has (yes/no only, never values)
  if (req.method === 'GET') {
    return res.status(200).json({ ...Object.fromEntries(SETTINGS.map((k) => [k, !!process.env[k]])), SUPABASE_URL: !!supabaseUrl() });
  }
  if (req.method !== 'POST') return res.status(405).end();
  if (!sameSecret(req.headers['x-push-secret'])) {
    return res.status(401).end();
  }
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'https://us.dizziedbliss.lol',
      env('VAPID_PUBLIC_KEY'),
      env('VAPID_PRIVATE_KEY')
    );
    const result = await sendBatch();
    return res.status(200).json(result);
  } catch (err) {
    console.error('push failed:', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
