import React, { useEffect, useState } from 'react';
import { disablePush, enablePush, pushState, refreshPush, sendTestPush, type PushState } from '../../lib/push';

const link = 'underline underline-offset-4 decoration-ink/40 hover:decoration-ink cursor-pointer disabled:opacity-40 disabled:cursor-wait';

/** "NOTIFS // ON" line on the hub: turn this phone's buzzes on/off, or send yourself a test. */
export const NotifyControl: React.FC<{ onMessage: (text: string, kind?: 'ok' | 'error') => void }> = ({ onMessage }) => {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushState().then(setState).catch(() => setState('unsupported'));
    refreshPush().catch(() => {});
  }, []);

  if (!state || state === 'unsupported') return null;

  const run = async (fn: () => Promise<PushState | void>, ok?: string) => {
    setBusy(true);
    try {
      const next = await fn();
      if (next) setState(next);
      if (next === 'blocked') onMessage('notifications are blocked, allow them in site settings', 'error');
      else if (ok) onMessage(ok);
    } catch {
      onMessage("couldn't do that, try again?", 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <p className="font-mono text-[11px] mt-2 text-ink/60 tracking-wider flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>
        NOTIFS // <span className={state === 'on' ? 'text-brand-purple font-bold' : ''}>{state === 'blocked' ? 'BLOCKED' : state.toUpperCase()}</span>
      </span>
      {state === 'off' && (
        <button type="button" disabled={busy} onClick={() => run(enablePush, "notifications on :3")} className={link}>
          TURN ON
        </button>
      )}
      {state === 'on' && (
        <>
          <button type="button" disabled={busy} onClick={() => run(sendTestPush, 'sent! your phone should buzz')} className={link}>
            TEST
          </button>
          <button type="button" disabled={busy} onClick={() => run(disablePush, 'notifications off on this phone')} className={link}>
            OFF
          </button>
        </>
      )}
      {state === 'blocked' && <span className="normal-case tracking-normal">allow them in this site's settings</span>}
    </p>
  );
};
