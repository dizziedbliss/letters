import React, { useEffect, useRef, useState } from 'react';
import { preloadRoute } from '../routes';
import { TileGridBackground, type GridHandle } from '../components/background/TileGridBackground';
import { HeroContent } from '../components/landing/HeroContent';
import { SecretCodeInput } from '../components/landing/SecretCodeInput';
import { supabase } from '../lib/supabase';
import { myName } from '../utils/api';
import { useSharedGrid } from '../features/gate/useSharedGrid';
import { DrawBar } from '../features/gate/DrawBar';
import { FriendFinger } from '../features/gate/FriendFinger';
import { useConfirm } from '../components/common/useConfirm';

interface LandingPageProps {
  /** The way in (the ENTER button, once signed in) */
  onEnter?: () => void;
}

/**
 * The gate. Signed out: the secret code field over a tile grid you can tap for fun.
 * Signed in: the grid becomes our shared drawing (saved, live), and the field becomes ENTER.
 */
export const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  const [session, setSession] = useState<'checking' | 'out' | 'in'>('checking');
  const [name, setName] = useState<string | null>(null);
  const [tool, setTool] = useState(1);
  const grid = useRef<GridHandle>(null);
  const signedIn = session === 'in';
  const { status, friend, onPaint, onCursor, clearAll } = useSharedGrid(signedIn, grid, name, tool);
  const { confirm, dialog } = useConfirm();

  // Typing the code takes a few seconds; fetch the hub meanwhile
  useEffect(() => preloadRoute('/home'), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ? 'in' : 'out'));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ? 'in' : 'out'));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (signedIn) myName().then(setName).catch(() => {});
  }, [signedIn]);

  const clear = async () => {
    const ok = await confirm({
      title: 'Clear the whole drawing?',
      body: `It's gone for ${friend?.name ?? 'both of you'} too.`,
      confirmLabel: 'Clear it',
      danger: true,
    });
    if (ok) clearAll().catch(() => {});
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-paper flex items-center justify-center">
      <TileGridBackground ref={grid} draw={signedIn ? { tool, onPaint, onCursor } : null} />
      {signedIn && <FriendFinger friend={friend} />}

      {/* Floating foreground (lets taps through to the grid except on its controls) */}
      <div className="relative z-10 pointer-events-none flex flex-col items-center text-center px-4 sm:px-6 w-full max-w-[760px] mx-auto">
        <HeroContent compact={signedIn} />
        {session === 'out' && <SecretCodeInput />}
      </div>

      {signedIn && <DrawBar tool={tool} onTool={setTool} friend={friend} status={status} onClear={clear} onEnter={() => onEnter?.()} />}
      {dialog}
    </div>
  );
};

export default LandingPage;
