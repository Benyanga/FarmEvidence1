import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { cacheAll, getCached } from '../services/db';

/** Fetches the current user's setups, falling back to the IndexedDB cache when offline. */
export default function useSetups() {
  const [setups, setSetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/setups');
      setSetups(data.setups);
      await cacheAll('setups', data.setups);
      setError(null);
    } catch (err) {
      if (!err.response) {
        const cached = await getCached('setups');
        setSetups(cached);
      } else {
        setError(err.response?.data?.error || { message: err.message });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { setups, loading, error, refresh };
}
