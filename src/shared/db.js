import { openDB } from 'idb';

const DB_NAME = 'paintball-training-utilities';
const DB_VERSION = 2;

/**
 * Central object store schema. Every feature registers its own stores here,
 * namespaced as "<feature-id>:<store>" so two features can never collide.
 * A new store means one more entry plus a bumped DB_VERSION.
 */
const STORE_SCHEMA = [
  { name: 'snaptraining-dryrun:profiles', options: { keyPath: 'id' } },
];

/**
 * Stores that changed name. Because the name carries the feature id, renaming a
 * feature renames its store, and without this every profile already trained on
 * a device would simply stop existing. The rows are copied into the new store
 * and the old one is dropped, inside the same version change transaction, so a
 * failure anywhere aborts the whole thing and leaves the old data untouched for
 * the next attempt.
 */
const RENAMED_STORES = [{ from: 'presence-counter:profiles', to: 'snaptraining-dryrun:profiles' }];

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, newVersion, transaction) {
        for (const store of STORE_SCHEMA) {
          if (!db.objectStoreNames.contains(store.name)) {
            db.createObjectStore(store.name, store.options);
          }
        }
        for (const { from, to } of RENAMED_STORES) {
          if (!db.objectStoreNames.contains(from)) continue;
          const rows = await transaction.objectStore(from).getAll();
          for (const row of rows) {
            await transaction.objectStore(to).put(row);
          }
          db.deleteObjectStore(from);
          console.log(`[db] migrated ${rows.length} rows from "${from}" to "${to}"`);
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
