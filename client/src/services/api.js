import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'
});

let tokenGetter = null;

/** Called once from App.jsx with Clerk's getToken function. */
export function setTokenGetter(fn) {
  tokenGetter = fn;
}

api.interceptors.request.use(async (config) => {
  if (tokenGetter) {
    const token = await tokenGetter();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * If REACT_APP_API_BASE_URL points at a static host with no real API behind
 * it (e.g. a SPA rewrite rule catching /api/* and returning index.html —
 * exactly what happens if this env var is left pointing at the frontend's
 * own domain instead of the backend service), the request still "succeeds"
 * with a 200 and an HTML body. Every caller across the app would otherwise
 * see this as valid data and silently render empty lists — "no trials
 * found" — instead of a real, diagnosable error. Reject those here, once,
 * so every API call fails loudly and consistently instead of per-page.
 */
api.interceptors.response.use((response) => {
  const contentType = response.headers?.['content-type'] || '';
  if (typeof response.data === 'string' && !contentType.includes('application/json')) {
    const err = new Error(
      `API request to ${response.config?.url} returned non-JSON (content-type: ${contentType || 'unknown'}). ` +
        'This usually means REACT_APP_API_BASE_URL points at a host with no backend behind it.'
    );
    err.isApiMisconfiguration = true;
    return Promise.reject(err);
  }
  return response;
});

export default api;
