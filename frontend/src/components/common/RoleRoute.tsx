import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { currentRole, type Role } from '../../utils/api';

interface RoleRouteProps {
  allow: Role[];
  children: React.ReactElement;
}

/** Gate a route on the server-verified session role. */
export const RoleRoute: React.FC<RoleRouteProps> = ({ allow, children }) => {
  const [state, setState] = useState<'checking' | 'ok' | 'denied'>('checking');

  useEffect(() => {
    let cancelled = false;
    currentRole().then((role) => {
      if (!cancelled) setState(role && allow.includes(role) ? 'ok' : 'denied');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'denied') return <Navigate to="/" replace />;
  if (state === 'checking') return <div className="min-h-dvh bg-[#151515]" />;
  return children;
};

export default RoleRoute;
