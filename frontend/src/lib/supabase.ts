import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example)');
}

// `npm run demo`: talk to an in-browser fake Supabase with seeded data instead of the network.
// The condition is a build-time constant, so production never includes the demo code.
const demoFetch = import.meta.env.VITE_DEMO === '1' ? (await import('../demo/fakeFetch')).fakeFetch : undefined;

export const supabase = createClient(url, key, demoFetch ? { global: { fetch: demoFetch } } : undefined);
