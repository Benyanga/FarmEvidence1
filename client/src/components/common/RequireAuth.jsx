import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import LoadingSpinner from './LoadingSpinner';

/** Requires only Clerk authentication (used by /select-role, before a role exists). */
export default function RequireAuth() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <LoadingSpinner />;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;

  return <Outlet />;
}
