import api from './api';
import { cacheOne, enqueueSync } from './db';

/**
 * Single gateway for all data writes. Attempts the API call first; on
 * network failure (offline) it writes a pending record to IndexedDB and
 * queues it for the next sync. See docs/ARCHITECTURE.md §3 (Data Flow).
 *
 * @param {object} params
 * @param {string} [params.store] - IndexedDB store to optimistically cache into
 * @param {string} params.endpoint - API path, e.g. '/plots/64.../costs'
 * @param {'POST'|'PUT'} [params.method]
 * @param {object} params.body
 */
export async function writeThrough({ store, endpoint, method = 'POST', body }) {
  if (navigator.onLine) {
    try {
      const response = await api.request({ url: endpoint, method, data: body });
      const record = extractRecord(response.data);
      if (store && record) await cacheOne(store, record);
      return { online: true, data: response.data };
    } catch (err) {
      if (!err.response) {
        return queueOffline({ store, endpoint, method, body });
      }
      throw err;
    }
  }
  return queueOffline({ store, endpoint, method, body });
}

async function queueOffline({ store, endpoint, method, body }) {
  const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const pendingRecord = { _id: body._id || localId, ...body, _pending: true };
  if (store) await cacheOne(store, pendingRecord);
  await enqueueSync({ localId, endpoint, method, body, timestamp: new Date().toISOString() });
  return { online: false, data: pendingRecord, localId };
}

function extractRecord(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const key = Object.keys(payload).find((k) => !['success', 'error'].includes(k) && payload[k] && typeof payload[k] === 'object' && !Array.isArray(payload[k]));
  return key ? payload[key] : null;
}

export function isOnline() {
  return navigator.onLine;
}
