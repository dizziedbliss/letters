import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { syncTimezone } from '../../utils/api';
import { refreshPush } from '../../lib/push';

/** Gate a route on a live Supabase session (either of the two accounts). */
export const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const [state, setState] = useState<'checking' | 'ok' | 'denied'>('checking');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState(data.session ? 'ok' : 'denied');
      if (data.session) {
        syncTimezone().catch(() => {});
        refreshPush().catch(() => {}); // this phone's buzzes belong to whoever is signed in on it
      }
    });
    // Signing out in another tab (or an expired session) kicks you back to the gate
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setState('denied');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (state === 'denied') return <Navigate to="/" replace />;
  if (state === 'checking') return <div className="min-h-dvh bg-[#151515]" />;
  return children;
};

export default ProtectedRoute;
