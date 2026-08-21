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
  'home.settingsLabel': { de: 'Einstellungen', en: 'Settings' },

  'notFound.title': { de: 'Nicht gefunden', en: 'Not found' },
  'notFound.message': { de: 'Feature nicht gefunden.', en: 'Feature not found.' },

  'settings.title': { de: 'Einstellungen', en: 'Settings' },
  'settings.debugToggle': { de: 'Debug-Modus', en: 'Debug mode' },
  'settings.debugHint': {
    de: 'Blendet Debug-Logs, Diagnose und den Engine-Wechsel in den Tools ein.',
    en: 'Shows debug logs, diagnostics and the engine switch in the tools.',
  },

  'feature.snaptrainingDryrun.name': { de: 'Snaptraining Dryrun', en: 'Snaptraining Dryrun' },
  'feature.snaptrainingDryrun.description': {
    de: 'Erkennt per Kamera und selbst trainiertem Modell, wie viele Snapshot Wiederholungen du gemacht hast.',
    en: 'Uses your camera and a self-trained model to detect how many snapshot reps you’ve done.',
  },

  // Words reused across several screens (tags, buttons, status lines, counts).
  'label.snap': { de: 'Snap', en: 'Snap' },
  'label.cover': { de: 'Deckung', en: 'Cover' },
  'label.ignored': { de: 'Ignoriert', en: 'Ignored' },

  'snap-dryrun.list.newPosition': { de: '+ Neue Snapshot-Position', en: '+ New snapshot position' },
  'snap-dryrun.list.emptyState': {
    de: 'Noch keine Snapshot-Positionen. Lege eine neue an, um ein Szenario zu trainieren.',
    en: 'No snapshot positions yet. Create one to train a scenario.',
  },
  'snap-dryrun.list.trainedAt': { de: 'Bildmodell trainiert am {date}', en: 'Image model trained on {date}' },
  'snap-dryrun.list.notTrained': { de: 'Noch nicht trainiert', en: 'Not trained yet' },
  'snap-dryrun.list.retrain': { de: 'Neu trainieren', en: 'Retrain' },
  'snap-dryrun.list.delete': { de: 'Löschen', en: 'Delete' },
  'snap-dryrun.list.deleteConfirm': {
    de: 'Snapshot-Position "{name}" wirklich löschen?',
    en: 'Really delete snapshot position "{name}"?',
  },

  'snap-dryrun.setup.title': { de: 'Neue Snapshot-Position', en: 'New snapshot position' },
  'snap-dryrun.setup.nameLabel': { de: 'Name des Szenarios', en: 'Scenario name' },
  'snap-dryrun.setup.namePlaceholder': {
    de: 'Maya Tempel / Dorito 1 / Eingangstür',
    en: 'Maya temple / dorito 1 / entrance door',
  },
  'snap-dryrun.setup.cameraLabel': { de: 'Kamera', en: 'Camera' },
  'snap-dryrun.setup.cameraRear': { de: 'Rückkamera', en: 'Rear camera' },
  'snap-dryrun.setup.cameraFront': { de: 'Frontkamera', en: 'Front camera' },
  'snap-dryrun.setup.next': { de: 'Weiter zur Aufnahme', en: 'Continue to capture' },
  'snap-dryrun.setup.classTitle': {
    de: 'Mindestens {min} Fotos pro Zustand',
    en: 'At least {min} photos per state',
  },
  'snap-dryrun.setup.classHint': {
    de: 'Mindestens {min} Fotos von der leeren Deckung und {min} pro Snap-Position. Je mehr, desto besser. Drille im nächsten Schritt ganz normal: rein in die Deckung, heraussnappen, zurück.',
    en: 'At least {min} photos of the empty cover and {min} per snap position. The more the better. In the next step just drill normally: into cover, snap out, back again.',
  },

  'snap-dryrun.capture.title': { de: 'Trainingsdaten sammeln', en: 'Collect training data' },
  'snap-dryrun.capture.startCamera': { de: 'Kamera starten', en: 'Start camera' },
  'snap-dryrun.capture.countLabel': { de: 'Anzahl Fotos', en: 'Number of photos' },
  'snap-dryrun.capture.intervalLabel': { de: 'Intervall (ms)', en: 'Interval (ms)' },
  'snap-dryrun.capture.delayLabel': { de: 'Start-Verzögerung (s)', en: 'Start delay (s)' },
  'snap-dryrun.capture.start': { de: 'Serie aufnehmen', en: 'Capture series' },
  'snap-dryrun.capture.retake': { de: 'Serie erneut aufnehmen', en: 'Retake series' },
  'snap-dryrun.capture.stop': { de: 'Aufnahme stoppen', en: 'Stop capture' },
  'snap-dryrun.capture.countdown': { de: 'Start in {seconds}s…', en: 'Starting in {seconds}s…' },
  'snap-dryrun.capture.progress': { de: '{index}/{total} Fotos aufgenommen', en: '{index}/{total} photos taken' },
  'snap-dryrun.capture.cameraError': { de: 'Kamerazugriff fehlgeschlagen: {message}', en: 'Camera access failed: {message}' },
  'snap-dryrun.capture.next': { de: 'Weiter zum Labeling', en: 'Continue to labeling' },

  'snap-dryrun.label.title': { de: 'Fotos labeln', en: 'Label photos' },
  'snap-dryrun.label.hint': {
    de: 'Nach rechts wischen = Snap, nach links = Deckung. Oder Buttons nutzen.',
    en: 'Swipe right = snap, swipe left = cover. Or use the buttons.',
  },
  'snap-dryrun.label.btnSnap': { de: '✓ Snap', en: '✓ Snap' },
  'snap-dryrun.label.btnCover': { de: '✕ Deckung', en: '✕ Cover' },
  'snap-dryrun.label.btnIgnore': { de: 'Ignorieren', en: 'Ignore' },
  'snap-dryrun.label.prev': { de: '‹ Vorheriges Foto', en: '‹ Previous photo' },
  'snap-dryrun.label.photoCounter': { de: 'Foto {index} / {total}', en: 'Photo {index} / {total}' },
  'snap-dryrun.label.currentPrefix': { de: 'aktuell', en: 'current' },
  'snap-dryrun.label.summaryTitle': { de: 'Fotos gelabelt', en: 'Photos labeled' },
  'snap-dryrun.label.summaryCounts': {
    de: 'Snap: {snap} · Deckung: {cover} · Ignoriert: {ignored}',
    en: 'Snap: {snap} · Cover: {cover} · Ignored: {ignored}',
  },
  'snap-dryrun.label.summaryMissing': { de: 'Noch zu wenig Beispiele: {list}', en: 'Not enough examples yet: {list}' },
  'snap-dryrun.label.nextTrain': { de: 'Weiter zum Training', en: 'Continue to training' },

  'snap-dryrun.train.title': { de: 'Training', en: 'Training' },
  'snap-dryrun.train.running': { de: 'Training läuft…', en: 'Training…' },
  'snap-dryrun.train.runningProgress': { de: 'Training läuft… ({done}/{total})', en: 'Training… ({done}/{total})' },
  'snap-dryrun.train.done': {
    de: 'Fertig. Snapshot-Position "{name}" ist trainiert.',
    en: 'Done. Snapshot position "{name}" is trained.',
  },
  'snap-dryrun.train.error': { de: 'Training fehlgeschlagen: {message}', en: 'Training failed: {message}' },
  'snap-dryrun.train.doneBtn': { de: 'Zu den Snapshot-Positionen', en: 'Go to snapshot positions' },

  'snap-dryrun.live.reset': { de: 'Counter zurücksetzen', en: 'Reset counter' },
  'snap-dryrun.live.starting': { de: 'Kamera wird gestartet…', en: 'Starting camera…' },
  'snap-dryrun.live.status': { de: 'Snap: {snap}% · Deckung: {cover}%', en: 'Snap: {snap}% · Cover: {cover}%' },
  'snap-dryrun.live.stateSnap': { de: 'Snap!', en: 'Snap!' },
  'snap-dryrun.live.stateCover': { de: 'In Deckung', en: 'In cover' },
  'snap-dryrun.live.cameraError': { de: 'Live-Betrieb fehlgeschlagen: {message}', en: 'Live mode failed: {message}' },

  'snap-dryrun.settings.cameraSound': { de: 'Kamera-Sound', en: 'Camera sound' },
  'snap-dryrun.settings.cameraSoundHint': {
    de: 'Spielt einen Auslöser-Ton bei jedem aufgenommenen Trainingsfoto.',
    en: 'Plays a shutter sound for every training photo taken.',
  },
  'snap-dryrun.settings.numberSound': { de: 'Zahlen-Sound', en: 'Number sound' },
  'snap-dryrun.settings.numberSoundHint': {
    de: 'Sagt den Countdown vor der Aufnahme an und jede zehnte Wiederholung im Live-Training.',
    en: 'Announces the countdown before capture and every tenth rep during live training.',
  },
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
