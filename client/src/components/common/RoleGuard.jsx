import React from 'react';
import useRole from '../../hooks/useRole';
import LoadingSpinner from './LoadingSpinner';

/** <RoleGuard roles={['researcher']}>...</RoleGuard> */
export default function RoleGuard({ roles = [], fallback = null, children }) {
  const { role, loading } = useRole();

  if (loading) return <LoadingSpinner />;
  if (!roles.includes(role)) return fallback;
  return children;
}
