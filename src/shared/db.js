import { openDB } from 'idb';

const DB_NAME = 'paintball-training-utilities';
// Only ever counts up. Lowering it makes every browser that already opened a
// higher version throw a VersionError, with no way out but clearing site data.
const DB_VERSION = 2;

/**
 * Central object store schema. Every feature registers its own stores here,
 * namespaced as "<feature-id>:<store>" so two features can never collide.
 * A new store means one more entry plus a bumped DB_VERSION.
 */
const STORE_SCHEMA = [
  { name: 'snaptraining-dryrun:profiles', options: { keyPath: 'id' } },
];

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      // The schema is the truth: create what it lists, drop what it does not.
      // Since stores are only ever created from STORE_SCHEMA, anything else is
      // left over from an older name and its contents are not worth keeping.
      upgrade(db) {
        for (const store of STORE_SCHEMA) {
          if (!db.objectStoreNames.contains(store.name)) {
            db.createObjectStore(store.name, store.options);
          }
        }
        const known = new Set(STORE_SCHEMA.map((store) => store.name));
        // Array.from, not spread: objectStoreNames is a DOMStringList, which is array
        // like but does not reliably carry a Symbol.iterator.
        for (const name of Array.from(db.objectStoreNames)) {
          if (!known.has(name)) db.deleteObjectStore(name);
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
