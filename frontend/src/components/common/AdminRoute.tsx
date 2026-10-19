import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { isAdmin } from '../../utils/api';

export const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const [state, setState] = useState<'checking' | 'ok' | 'denied'>('checking');

  useEffect(() => {
    let cancelled = false;
    isAdmin().then((ok) => {
      if (!cancelled) setState(ok ? 'ok' : 'denied');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'denied') return <Navigate to="/" replace />;
  if (state === 'checking') return <div className="min-h-dvh bg-[#151515]" />;
  return children;
};

export default AdminRoute;
