import { supabase } from './supabase';

// A tiny "room" for live, throwaway messages (strokes, fingers, who's here).
// Real: a private Supabase Realtime broadcast channel, which only signed-in users can join
// (policies in 0011). Demo: the browser's BroadcastChannel, so two tabs act like two phones.

export type LiveStatus = 'connecting' | 'live' | 'offline';

export interface LiveRoom {
  send(event: string, payload: Record<string, unknown>): void;
  leave(): void;
}

type Handlers = Record<string, (payload: Record<string, unknown>) => void>;

export function joinRoom(topic: string, handlers: Handlers, onStatus: (s: LiveStatus) => void): LiveRoom {
  if (import.meta.env.VITE_DEMO === '1') return joinDemoRoom(topic, handlers, onStatus);

  const channel = supabase.channel(topic, { config: { private: true, broadcast: { self: false } } });
  for (const [event, fn] of Object.entries(handlers)) {
    channel.on('broadcast', { event }, ({ payload }) => fn(payload as Record<string, unknown>));
  }
  onStatus('connecting');
  let left = false;
  // Private channels check the signed-in user's token, so hand it over first
  supabase.realtime
    .setAuth()
    .catch(() => {})
    .then(() => {
      if (left) return;
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') onStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onStatus('offline');
      });
    });

  return {
    send(event, payload) {
      channel.send({ type: 'broadcast', event, payload }).catch(() => {});
    },
    leave() {
      left = true;
      supabase.removeChannel(channel);
    },
  };
}

function joinDemoRoom(topic: string, handlers: Handlers, onStatus: (s: LiveStatus) => void): LiveRoom {
  const bc = new BroadcastChannel(`demo-${topic}`);
  bc.onmessage = (e: MessageEvent<{ event: string; payload: Record<string, unknown> }>) => handlers[e.data.event]?.(e.data.payload);
  queueMicrotask(() => onStatus('live'));
  return {
    send: (event, payload) => bc.postMessage({ event, payload }),
    leave: () => bc.close(),
  };
}
