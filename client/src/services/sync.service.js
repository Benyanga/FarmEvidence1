import { v4 as uuidv4 } from 'uuid';
import api from './api';
import { getSyncQueue, removeSyncEntry } from './db';

/**
 * Reads all pending records from IndexedDB and pushes them to the server in
 * one batch. Confirmed records are removed from the queue; failed/conflicted
 * records are left for the next attempt. See docs/API_SPEC.md §11.
 */
export async function drainSyncQueue() {
  const queue = await getSyncQueue();
  if (queue.length === 0) return { success: [], failed: [], conflicts: [] };

  const batchId = uuidv4();
  const records = queue.map((q) => ({
    localId: q.localId,
    endpoint: q.endpoint,
    method: q.method,
    body: q.body,
    timestamp: q.timestamp
  }));

  const { data } = await api.post('/sync/batch', { batchId, records });

  for (const s of data.success || []) {
    const entry = queue.find((q) => q.localId === s.localId);
    if (entry) await removeSyncEntry(entry.id);
  }

  return data;
}
