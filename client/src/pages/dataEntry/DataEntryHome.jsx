import React from 'react';
import useRole from '../../hooks/useRole';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import DataEntryList from './DataEntryList';
import FarmerDataEntryHome from '../farms/FarmerDataEntryHome';

/** Shared /data-entry route — Research Mode sees every trial, Farmer Mode sees every farm. */
export default function DataEntryHome() {
  const { role, loading } = useRole();

  if (loading) return <LoadingSpinner />;
  if (role === 'researcher') return <DataEntryList />;
  return <FarmerDataEntryHome />;
}
