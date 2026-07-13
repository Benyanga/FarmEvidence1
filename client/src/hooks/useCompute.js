import { useCallback, useState } from 'react';
import api from '../services/api';

/** Wraps a POST /compute/* call with loading/error/result state. */
export default function useCompute(endpoint) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(
    async (body) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.post(endpoint, body || {});
        setResult(data);
        return data;
      } catch (err) {
        const apiError = err.response?.data?.error || { message: err.message };
        setError(apiError);
        throw apiError;
      } finally {
        setLoading(false);
      }
    },
    [endpoint]
  );

  return { run, result, loading, error };
}
