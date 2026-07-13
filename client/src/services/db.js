import { openDB } from 'idb';

const DB_NAME = 'farmevidence';
const DB_VERSION = 2;

const STORES = [
  'setups',
  'seasons',
  'plots',
  'costRecords',
  'laborRecords',
  'agronomicRecords',
  'trials',
  'treatments',
  'trialPlots',
  'trialInputCosts',
  'trialLaborCosts',
  'trialYields',
  'syncQueue'
];

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const store of STORES) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: store === 'syncQueue' ? 'id' : '_id' });
          }
        }
      }
    });
  }
  return dbPromise;
}

export async function cacheAll(store, records) {
  const db = await getDB();
  const tx = db.transaction(store, 'readwrite');
  await Promise.all(records.map((r) => tx.store.put(r)));
  await tx.done;
}

export async function cacheOne(store, record) {
  const db = await getDB();
  await db.put(store, record);
}

export async function getCached(store) {
  const db = await getDB();
  return db.getAll(store);
}

export async function getCachedOne(store, id) {
  const db = await getDB();
  return db.get(store, id);
}

export async function deleteCached(store, id) {
  const db = await getDB();
  await db.delete(store, id);
}

export async function enqueueSync(entry) {
  const db = await getDB();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.put('syncQueue', { id, ...entry, retries: 0 });
  return id;
}

export async function getSyncQueue() {
  const db = await getDB();
  return db.getAll('syncQueue');
}

export async function removeSyncEntry(id) {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

export async function getSyncQueueCount() {
  const db = await getDB();
  return db.count('syncQueue');
}
