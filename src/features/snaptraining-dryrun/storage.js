import { createStore } from '../../shared/db.js';

const store = createStore('snaptraining-dryrun:profiles');

export const DEFAULT_CAPTURE_COUNT = 30;
export const DEFAULT_CAPTURE_INTERVAL_MS = 1000;
export const DEFAULT_CAPTURE_DELAY_MS = 5000;

export function listProfiles() {
  return store.getAll();
}

export function getProfile(id) {
  return store.get(id);
}

export function saveProfile(profile) {
  return store.put(profile);
}

export function deleteProfile(id) {
  return store.delete(id);
}

/**
 * A fresh, untrained profile. classifierDataset, previewImage and trainedAt
 * are filled in by the training screen.
 */
export function createProfileDraft({ name, facingMode }) {
  return {
    id: crypto.randomUUID(),
    name,
    facingMode,
    captureCount: DEFAULT_CAPTURE_COUNT,
    captureIntervalMs: DEFAULT_CAPTURE_INTERVAL_MS,
    classifierDataset: null,
    previewImage: null,
    counter: 0,
    history: [],
    createdAt: Date.now(),
    trainedAt: null,
  };
}

/** Counts one confirmed rep and keeps its timestamp for later evaluation. */
export async function recordDetection(id) {
  const profile = await getProfile(id);
  if (!profile) return null;
  profile.counter += 1;
  profile.history.push(Date.now());
  await saveProfile(profile);
  return profile;
}

export async function resetCounter(id) {
  const profile = await getProfile(id);
  if (!profile) return null;
  profile.counter = 0;
  profile.history = [];
  await saveProfile(profile);
  return profile;
}

