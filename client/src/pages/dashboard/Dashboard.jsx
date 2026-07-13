import React from 'react';
import useRole from '../../hooks/useRole';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import FarmerDashboard from './FarmerDashboard';
import ResearcherDashboard from './ResearcherDashboard';

export default function Dashboard() {
  const { role, loading } = useRole();

  if (loading) return <LoadingSpinner />;
  if (role === 'researcher') return <ResearcherDashboard />;
  return <FarmerDashboard />;
}
