import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import api from '../../services/api';

/**
 * One proactive check at app startup: is the configured backend actually
 * reachable and answering as a real API? This doesn't depend on any given
 * page correctly surfacing a fetch error — every authenticated page renders
 * inside ProtectedLayout, so this is a single, guaranteed place to catch
 * "the app looks fine but every list is silently empty" (a misconfigured
 * REACT_APP_API_BASE_URL returning HTML for every request looks, to most
 * pages' empty-state handling, identical to "you have no data yet").
 */
export default function ApiHealthBanner() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'ok' | 'unreachable'

  useEffect(() => {
    let cancelled = false;
    api
      .get('/health', { timeout: 8000 })
      .then((res) => {
        if (!cancelled) setStatus(res.data?.status === 'ok' ? 'ok' : 'unreachable');
      })
      .catch(() => {
        if (!cancelled) setStatus('unreachable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status !== 'unreachable') return null;

  return (
    <div className="bg-danger-subtle border-bottom border-danger px-3 py-2 small d-flex align-items-start gap-2">
      <AlertTriangle size={16} className="flex-shrink-0 mt-1 text-danger" />
      <div>
        <strong>Cannot reach the backend API.</strong> Your trials and farms won't load — this
        isn't missing data, the app just can't talk to its server right now. Configured API URL:{' '}
        <code>{api.defaults.baseURL}</code>. If you're the administrator: check that the backend
        service is deployed and running, and that this app's <code>REACT_APP_API_BASE_URL</code>{' '}
        points at it (not at this frontend's own domain).
      </div>
    </div>
  );
}
