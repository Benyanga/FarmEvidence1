import { useSyncContext } from '../context/SyncContext';

/** Exposes pending sync queue count and a manual trigger; auto-syncs on reconnect. */
export default function useSync() {
  return useSyncContext();
}
