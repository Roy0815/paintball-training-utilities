const STORAGE_KEY = 'ptu:debug-mode';

/** Whether debug tools (log panels, diagnostics, engine override) show up in the tools. */
export function isDebugMode() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDebugMode(enabled) {
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable, the choice just won't survive a reload */
  }
}
