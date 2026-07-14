import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import useRole from '../../hooks/useRole';
import LoadingSpinner from './LoadingSpinner';
import OfflineBanner from '../layout/OfflineBanner';
import ApiHealthBanner from '../layout/ApiHealthBanner';
import ResearchTopbar from '../layout/ResearchTopbar';
import ResearchSidebar from '../layout/ResearchSidebar';
import FarmerTopbar from '../layout/FarmerTopbar';
import FarmerSidebar from '../layout/FarmerSidebar';

/** Requires an authenticated + role-synced user; otherwise redirects. */
export default function ProtectedLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { role, loading } = useRole();

  if (!isLoaded || loading) return <LoadingSpinner />;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  if (!role) return <Navigate to="/select-role" replace />;

  if (role === 'researcher') {
    return (
      <>
        <ResearchTopbar />
        <ApiHealthBanner />
        <div className="d-flex flex-column flex-md-row">
          <ResearchSidebar />
          <main className="flex-grow-1 p-3" style={{ minWidth: 0 }}>
            <Outlet />
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <FarmerTopbar />
      <ApiHealthBanner />
      <OfflineBanner />
      <div className="d-flex flex-column flex-md-row">
        <FarmerSidebar />
        <main className="flex-grow-1 p-3" style={{ minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
