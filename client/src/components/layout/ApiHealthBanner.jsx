import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import api from '../../services/api';

const COLD_START_TIMEOUT_MS = 45000; // Render free-tier spin-up can take up to ~50s
const RETRY_DELAYS_MS = [3000, 8000, 15000]; // a few spaced retries before giving up

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One proactive check at app startup: is the configured backend actually
 * reachable and answering as a real API? This doesn't depend on any given
 * page correctly surfacing a fetch error — every authenticated page renders
 * inside ProtectedLayout, so this is a single, guaranteed place to catch
 * "the app looks fine but every list is silently empty" (a misconfigured
 * REACT_APP_API_BASE_URL returning HTML for every request looks, to most
 * pages' empty-state handling, identical to "you have no data yet").
 *
 * Free-tier Render services spin down after ~15min idle and can take up to
 * ~50s to wake on the next request — the very first request in that window
 * can time out even though the backend is perfectly healthy. A short
 * timeout with no retry turns a normal cold start into a false "backend is
 * down" alarm, which is worse than useless (it's actively misleading). So:
 * a longer per-attempt timeout, a few spaced retries showing a calm
 * "waking up" state, and only the *final* failure renders as a real error.
 */
export default function ApiHealthBanner() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'ok' | 'unreachable'
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function checkWithRetries() {
      const totalAttempts = RETRY_DELAYS_MS.length + 1;
      for (let i = 0; i < totalAttempts; i++) {
        if (cancelled) return;
        setAttempt(i);
        try {
          const res = await api.get('/health', { timeout: COLD_START_TIMEOUT_MS });
          if (cancelled) return;
          if (res.data?.status === 'ok') {
            setStatus('ok');
            return;
          }
        } catch {
          // fall through to retry/give-up below
        }
        if (i < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[i]);
      }
      if (!cancelled) setStatus('unreachable');
    }

    checkWithRetries();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'ok') return null;

  if (status === 'checking' && attempt > 0) {
    return (
      <div className="bg-info-subtle border-bottom px-3 py-2 small d-flex align-items-center gap-2">
        <Clock size={16} className="flex-shrink-0" />
        <span>Waking up the server — this can take up to a minute after inactivity. Retrying…</span>
      </div>
    );
  }

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
