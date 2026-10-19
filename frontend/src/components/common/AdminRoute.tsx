import React from 'react';
import { RoleRoute } from './RoleRoute';

export const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => (
  <RoleRoute allow={['admin']}>{children}</RoleRoute>
);

export default AdminRoute;
