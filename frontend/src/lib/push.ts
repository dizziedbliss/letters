import { supabase } from './supabase';

// Web push for this phone: ask permission, subscribe with our public VAPID key, and hand the
// subscription to the database (0010). The sending side lives in /api/push.js.

const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on';

export const pushSupported = () =>
  !!KEY &&
  import.meta.env.VITE_DEMO !== '1' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const keyBytes = (base64url: string) => {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

const sameKey = (a: ArrayBuffer | null, b: Uint8Array) =>
  !!a && a.byteLength === b.byteLength && new Uint8Array(a).every((x, i) => x === b[i]);

const currentSubscription = async () => {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
};

async function save(sub: PushSubscription) {
  const { keys } = sub.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: keys?.p256dh,
    p_auth: keys?.auth,
  });
  if (error) throw error;
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'off';
  return (await currentSubscription()) ? 'on' : 'off';
}

export async function enablePush(): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'blocked';
  if (permission !== 'granted') return 'off';

  await navigator.serviceWorker.register('/sw.js');
  const reg = await navigator.serviceWorker.ready;
  const key = keyBytes(KEY!);
  let sub = await reg.pushManager.getSubscription();
  // Made with an older key (we rotated it): start over, or the server can't reach it
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await save(sub);
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const sub = await currentSubscription();
  if (sub) {
    await supabase.rpc('drop_push_subscription', { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
  return 'off';
}

/** Logging out: this phone stops getting that account's buzzes (it keeps the permission). */
export async function releasePush() {
  if (!pushSupported()) return;
  const sub = await currentSubscription();
  if (sub) await supabase.rpc('drop_push_subscription', { p_endpoint: sub.endpoint });
}

/** On each visit: re-save, so the phone's subscription follows whoever is logged in on it. */
export async function refreshPush() {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const sub = await currentSubscription();
  if (sub) await save(sub);
}

export async function sendTestPush() {
  const { error } = await supabase.rpc('push_test');
  if (error) throw error;
}
