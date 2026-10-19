import React from 'react';
import { RoleRoute } from './RoleRoute';

// Her pages: the reader code or the admin password both get in
export const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => (
  <RoleRoute allow={['reader', 'admin']}>{children}</RoleRoute>
);

export default ProtectedRoute;
