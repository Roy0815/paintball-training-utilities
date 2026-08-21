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

  'feature.snaptrainingDryrun.name': { de: 'Snaptraining Dryrun', en: 'Snaptraining Dryrun' },
  'feature.snaptrainingDryrun.description': {
    de: 'Erkennt per Kamera und selbst trainiertem Modell, wie viele Snapshot Wiederholungen du gemacht hast.',
    en: 'Uses your camera and a self-trained model to detect how many snapshot reps you’ve done.',
  },

  // Words reused across several screens (tags, buttons, status lines, counts).
  'label.snap': { de: 'Snap', en: 'Snap' },
  'label.cover': { de: 'Deckung', en: 'Cover' },
  'label.ignored': { de: 'Ignoriert', en: 'Ignored' },

  'snaptraining.list.newPosition': { de: '+ Neue Snapshot-Position', en: '+ New snapshot position' },
  'snaptraining.list.emptyState': {
    de: 'Noch keine Snapshot-Positionen. Lege eine neue an, um ein Szenario zu trainieren.',
    en: 'No snapshot positions yet. Create one to train a scenario.',
  },
  'snaptraining.list.trainedAt': { de: 'Bildmodell trainiert am {date}', en: 'Image model trained on {date}' },
  'snaptraining.list.notTrained': { de: 'Noch nicht trainiert', en: 'Not trained yet' },
  'snaptraining.list.retrain': { de: 'Neu trainieren', en: 'Retrain' },
  'snaptraining.list.delete': { de: 'Löschen', en: 'Delete' },
  'snaptraining.list.deleteConfirm': {
    de: 'Snapshot-Position "{name}" wirklich löschen?',
    en: 'Really delete snapshot position "{name}"?',
  },

  'snaptraining.setup.title': { de: 'Neue Snapshot-Position', en: 'New snapshot position' },
  'snaptraining.setup.nameLabel': { de: 'Name des Szenarios', en: 'Scenario name' },
  'snaptraining.setup.namePlaceholder': {
    de: 'Maya Tempel / Dorito 1 / Eingangstür',
    en: 'Maya temple / dorito 1 / entrance door',
  },
  'snaptraining.setup.cameraLabel': { de: 'Kamera', en: 'Camera' },
  'snaptraining.setup.cameraRear': { de: 'Rückkamera', en: 'Rear camera' },
  'snaptraining.setup.cameraFront': { de: 'Frontkamera', en: 'Front camera' },
  'snaptraining.setup.next': { de: 'Weiter zur Aufnahme', en: 'Continue to capture' },
  'snaptraining.setup.classTitle': {
    de: 'Mindestens {min} Fotos pro Zustand',
    en: 'At least {min} photos per state',
  },
  'snaptraining.setup.classHint': {
    de: 'Mindestens {min} Fotos von der leeren Deckung und {min} pro Snap-Position. Je mehr, desto besser. Drille im nächsten Schritt ganz normal: rein in die Deckung, heraussnappen, zurück.',
    en: 'At least {min} photos of the empty cover and {min} per snap position. The more the better. In the next step just drill normally: into cover, snap out, back again.',
  },

  'snaptraining.capture.title': { de: 'Trainingsdaten sammeln', en: 'Collect training data' },
  'snaptraining.capture.startCamera': { de: 'Kamera starten', en: 'Start camera' },
  'snaptraining.capture.countLabel': { de: 'Anzahl Fotos', en: 'Number of photos' },
  'snaptraining.capture.intervalLabel': { de: 'Intervall (ms)', en: 'Interval (ms)' },
  'snaptraining.capture.delayLabel': { de: 'Start-Verzögerung (s)', en: 'Start delay (s)' },
  'snaptraining.capture.start': { de: 'Serie aufnehmen', en: 'Capture series' },
  'snaptraining.capture.retake': { de: 'Serie erneut aufnehmen', en: 'Retake series' },
  'snaptraining.capture.stop': { de: 'Aufnahme stoppen', en: 'Stop capture' },
  'snaptraining.capture.countdown': { de: 'Start in {seconds}s…', en: 'Starting in {seconds}s…' },
  'snaptraining.capture.progress': { de: '{index}/{total} Fotos aufgenommen', en: '{index}/{total} photos taken' },
  'snaptraining.capture.cameraError': { de: 'Kamerazugriff fehlgeschlagen: {message}', en: 'Camera access failed: {message}' },
  'snaptraining.capture.next': { de: 'Weiter zum Labeling', en: 'Continue to labeling' },

  'snaptraining.label.title': { de: 'Fotos labeln', en: 'Label photos' },
  'snaptraining.label.hint': {
    de: 'Nach rechts wischen = Snap, nach links = Deckung. Oder Buttons nutzen.',
    en: 'Swipe right = snap, swipe left = cover. Or use the buttons.',
  },
  'snaptraining.label.btnSnap': { de: '✓ Snap', en: '✓ Snap' },
  'snaptraining.label.btnCover': { de: '✕ Deckung', en: '✕ Cover' },
  'snaptraining.label.btnIgnore': { de: 'Ignorieren', en: 'Ignore' },
  'snaptraining.label.prev': { de: '‹ Vorheriges Foto', en: '‹ Previous photo' },
  'snaptraining.label.photoCounter': { de: 'Foto {index} / {total}', en: 'Photo {index} / {total}' },
  'snaptraining.label.currentPrefix': { de: 'aktuell', en: 'current' },
  'snaptraining.label.summaryTitle': { de: 'Fotos gelabelt', en: 'Photos labeled' },
  'snaptraining.label.summaryCounts': {
    de: 'Snap: {snap} · Deckung: {cover} · Ignoriert: {ignored}',
    en: 'Snap: {snap} · Cover: {cover} · Ignored: {ignored}',
  },
  'snaptraining.label.summaryMissing': { de: 'Noch zu wenig Beispiele: {list}', en: 'Not enough examples yet: {list}' },
  'snaptraining.label.nextTrain': { de: 'Weiter zum Training', en: 'Continue to training' },

  'snaptraining.train.title': { de: 'Training', en: 'Training' },
  'snaptraining.train.running': { de: 'Training läuft…', en: 'Training…' },
  'snaptraining.train.runningProgress': { de: 'Training läuft… ({done}/{total})', en: 'Training… ({done}/{total})' },
  'snaptraining.train.done': {
    de: 'Fertig. Snapshot-Position "{name}" ist trainiert.',
    en: 'Done. Snapshot position "{name}" is trained.',
  },
  'snaptraining.train.error': { de: 'Training fehlgeschlagen: {message}', en: 'Training failed: {message}' },
  'snaptraining.train.doneBtn': { de: 'Zu den Snapshot-Positionen', en: 'Go to snapshot positions' },

  'snaptraining.live.reset': { de: 'Counter zurücksetzen', en: 'Reset counter' },
  'snaptraining.live.starting': { de: 'Kamera wird gestartet…', en: 'Starting camera…' },
  'snaptraining.live.status': { de: 'Snap: {snap}% · Deckung: {cover}%', en: 'Snap: {snap}% · Cover: {cover}%' },
  'snaptraining.live.stateSnap': { de: 'Snap!', en: 'Snap!' },
  'snaptraining.live.stateCover': { de: 'In Deckung', en: 'In cover' },
  'snaptraining.live.cameraError': { de: 'Live-Betrieb fehlgeschlagen: {message}', en: 'Live mode failed: {message}' },
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
