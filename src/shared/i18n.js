const STORAGE_KEY = 'ptu:lang';
export const LANGUAGES = ['de', 'en'];

const listeners = new Set();

function detectLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.includes(stored)) return stored;
  } catch {
    /* storage unavailable, fall through to the browser language */
  }
  const browserLang = navigator.language?.slice(0, 2).toLowerCase();
  return browserLang === 'en' ? 'en' : 'de';
}

let currentLang = detectLang();

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (!LANGUAGES.includes(lang) || lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable, the choice just won't survive a reload */
  }
  document.documentElement.lang = lang;
  listeners.forEach((listener) => listener(lang));
}

/** Notifies screens (plain innerHTML, no reactivity) that they need to re-render. */
export function onLangChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

document.documentElement.lang = currentLang;

/**
 * Flat, dot namespaced key to { de, en }. Flat rather than nested so a lookup
 * is a single property access instead of a path walk, since this runs on every
 * screen render.
 */
const STRINGS = {
  'shell.appTitle': { de: 'Paintball Training Utilities', en: 'Paintball Training Utilities' },
  'shell.back': { de: 'Zurück', en: 'Back' },
  'shell.langName.de': { de: 'DE', en: 'DE' },
  'shell.langName.en': { de: 'EN', en: 'EN' },
  'shell.loading': { de: 'Wird geladen…', en: 'Loading…' },

  'home.subtitle': { de: 'Wähle ein Tool aus.', en: 'Choose a tool.' },

  'notFound.title': { de: 'Nicht gefunden', en: 'Not found' },
  'notFound.message': { de: 'Feature nicht gefunden.', en: 'Feature not found.' },

  'feature.presenceCounter.name': { de: 'Snaptraining Dryrun', en: 'Snaptraining Dryrun' },
  'feature.presenceCounter.description': {
    de: 'Erkennt per Kamera und selbst trainiertem Modell, wie viele Snapshot Wiederholungen du gemacht hast.',
    en: 'Uses your camera and a self-trained model to detect how many snapshot reps you’ve done.',
  },

  // Words reused across several screens (tags, buttons, status lines, counts).
  'label.snap': { de: 'Snap', en: 'Snap' },
  'label.cover': { de: 'Deckung', en: 'Cover' },
  'label.ignored': { de: 'Ignoriert', en: 'Ignored' },

  'pc.list.newPosition': { de: '+ Neue Snapshot-Position', en: '+ New snapshot position' },
  'pc.list.emptyState': {
    de: 'Noch keine Snapshot-Positionen. Lege eine neue an, um ein Szenario zu trainieren.',
    en: 'No snapshot positions yet. Create one to train a scenario.',
  },
  'pc.list.trainedAt': { de: 'Bildmodell trainiert am {date}', en: 'Image model trained on {date}' },
  'pc.list.notTrained': { de: 'Noch nicht trainiert', en: 'Not trained yet' },
  'pc.list.retrain': { de: 'Neu trainieren', en: 'Retrain' },
  'pc.list.delete': { de: 'Löschen', en: 'Delete' },
  'pc.list.deleteConfirm': {
    de: 'Snapshot-Position "{name}" wirklich löschen?',
    en: 'Really delete snapshot position "{name}"?',
  },

  'pc.setup.title': { de: 'Neue Snapshot-Position', en: 'New snapshot position' },
  'pc.setup.nameLabel': { de: 'Name des Szenarios', en: 'Scenario name' },
  'pc.setup.namePlaceholder': { de: 'z.B. Flur-Spiegel', en: 'e.g. hallway mirror' },
  'pc.setup.cameraLabel': { de: 'Kamera', en: 'Camera' },
  'pc.setup.cameraRear': { de: 'Rückkamera', en: 'Rear camera' },
  'pc.setup.cameraFront': { de: 'Frontkamera', en: 'Front camera' },
  'pc.setup.startCamera': { de: 'Kamera starten', en: 'Start camera' },
  'pc.setup.next': { de: 'Weiter zur Aufnahme', en: 'Continue to capture' },
  'pc.setup.roiHint': {
    de: 'Optional: Ziehe im Vorschaubild ein Rechteck, um nur einen Bildausschnitt (ROI) zu analysieren.',
    en: 'Optional: drag a rectangle over the preview to analyze only part of the frame (ROI).',
  },
  'pc.setup.clearRoi': { de: 'ROI zurücksetzen', en: 'Clear ROI' },
  'pc.setup.cameraError': { de: 'Kamerazugriff fehlgeschlagen: {message}', en: 'Camera access failed: {message}' },

  'pc.capture.title': { de: 'Trainingsdaten sammeln', en: 'Collect training data' },
  'pc.capture.ratioTitle': { de: 'Ziel: halb Deckung, halb Snap', en: 'Goal: half cover, half snap' },
  'pc.capture.hint': {
    de: 'Nimm für "{name}" eine Serie auf und drille dabei normal: rein in die Deckung, heraussnappen, zurück.',
    en: 'Capture a series for "{name}" and drill normally: into cover, snap out, back again.',
  },
  'pc.capture.countLabel': { de: 'Anzahl Fotos', en: 'Number of photos' },
  'pc.capture.intervalLabel': { de: 'Intervall (ms)', en: 'Interval (ms)' },
  'pc.capture.delayLabel': { de: 'Start-Verzögerung (s)', en: 'Start delay (s)' },
  'pc.capture.start': { de: 'Serie aufnehmen', en: 'Capture series' },
  'pc.capture.retake': { de: 'Serie erneut aufnehmen', en: 'Retake series' },
  'pc.capture.stop': { de: 'Aufnahme stoppen', en: 'Stop capture' },
  'pc.capture.countdown': { de: 'Start in {seconds}s…', en: 'Starting in {seconds}s…' },
  'pc.capture.progress': { de: '{index}/{total} Fotos aufgenommen', en: '{index}/{total} photos taken' },
  'pc.capture.cameraError': { de: 'Kamerazugriff fehlgeschlagen: {message}', en: 'Camera access failed: {message}' },
  'pc.capture.next': { de: 'Weiter zum Labeling', en: 'Continue to labeling' },

  'pc.label.title': { de: 'Fotos labeln', en: 'Label photos' },
  'pc.label.hint': {
    de: 'Nach rechts wischen = Snap, nach links = Deckung. Oder Buttons nutzen.',
    en: 'Swipe right = snap, swipe left = cover. Or use the buttons.',
  },
  'pc.label.btnSnap': { de: '✓ Snap', en: '✓ Snap' },
  'pc.label.btnCover': { de: '✕ Deckung', en: '✕ Cover' },
  'pc.label.btnIgnore': { de: 'Ignorieren', en: 'Ignore' },
  'pc.label.prev': { de: '‹ Vorheriges Foto', en: '‹ Previous photo' },
  'pc.label.photoCounter': { de: 'Foto {index} / {total}', en: 'Photo {index} / {total}' },
  'pc.label.currentPrefix': { de: 'aktuell', en: 'current' },
  'pc.label.summaryTitle': { de: 'Fotos gelabelt', en: 'Photos labeled' },
  'pc.label.summaryCounts': {
    de: 'Snap: {snap} · Deckung: {cover} · Ignoriert: {ignored}',
    en: 'Snap: {snap} · Cover: {cover} · Ignored: {ignored}',
  },
  'pc.label.summaryMissing': { de: 'Noch zu wenig Beispiele: {list}', en: 'Not enough examples yet: {list}' },
  'pc.label.nextTrain': { de: 'Weiter zum Training', en: 'Continue to training' },

  'pc.train.title': { de: 'Training', en: 'Training' },
  'pc.train.running': { de: 'Training läuft…', en: 'Training…' },
  'pc.train.runningProgress': { de: 'Training läuft… ({done}/{total})', en: 'Training… ({done}/{total})' },
  'pc.train.done': {
    de: 'Fertig. Snapshot-Position "{name}" ist trainiert.',
    en: 'Done. Snapshot position "{name}" is trained.',
  },
  'pc.train.error': { de: 'Training fehlgeschlagen: {message}', en: 'Training failed: {message}' },
  'pc.train.doneBtn': { de: 'Zu den Snapshot-Positionen', en: 'Go to snapshot positions' },

  'pc.live.reset': { de: 'Counter zurücksetzen', en: 'Reset counter' },
  'pc.live.starting': { de: 'Kamera wird gestartet…', en: 'Starting camera…' },
  'pc.live.status': { de: 'Snap: {snap}% · Deckung: {cover}%', en: 'Snap: {snap}% · Cover: {cover}%' },
  'pc.live.stateSnap': { de: 'Snap!', en: 'Snap!' },
  'pc.live.stateCover': { de: 'In Deckung', en: 'In cover' },
  'pc.live.cameraError': { de: 'Live-Betrieb fehlgeschlagen: {message}', en: 'Live mode failed: {message}' },
};

/** Looks up `key` in the active language and fills any `{name}` placeholders from `vars`. */
export function t(key, vars) {
  const entry = STRINGS[key];
  if (!entry) {
    console.warn(`[i18n] missing key "${key}"`);
    return key;
  }
  let text = entry[currentLang] ?? entry.de ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, value);
    }
  }
  return text;
}

export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(currentLang === 'en' ? 'en-US' : 'de-DE');
}
