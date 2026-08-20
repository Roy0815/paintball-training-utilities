import { openDB } from 'idb';

const DB_NAME = 'paintball-training-utilities';
const DB_VERSION = 1;

/**
 * Central object store schema. Every feature registers its own stores here,
 * namespaced as "<feature-id>:<store>" so two features can never collide.
 * A new store means one more entry plus a bumped DB_VERSION.
 */
const STORE_SCHEMA = [
  { name: 'presence-counter:profiles', options: { keyPath: 'id' } },
];

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const store of STORE_SCHEMA) {
          if (!db.objectStoreNames.contains(store.name)) {
            db.createObjectStore(store.name, store.options);
          }
        }
      },
    });
  }
  return dbPromise;
}

/** Thin, promise-based helpers scoped to a single object store. */
export function createStore(storeName) {
  return {
    async getAll() {
      const db = await getDB();
      return db.getAll(storeName);
    },
    async get(id) {
      const db = await getDB();
      return db.get(storeName, id);
    },
    async put(value) {
      const db = await getDB();
      return db.put(storeName, value);
    },
    async delete(id) {
      const db = await getDB();
      return db.delete(storeName, id);
    },
  };
}
