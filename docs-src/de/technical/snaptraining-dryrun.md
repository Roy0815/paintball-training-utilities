# Snaptraining Dryrun im Detail

Verzeichnis `src/features/presence-counter/`. Die id stammt aus der Zeit vor dem
heutigen Anzeigenamen und bleibt, damit bereits gespeicherte Profile lesbar
bleiben.

| Modul | Zuständigkeit |
| --- | --- |
| `storage.js` | Profil-CRUD, Aufnahme-Defaults, Zähleraktualisierung |
| `capture.js` | Kamera, quadratischer Mittenzuschnitt, getaktete Aufnahmeserie |
| `labeling.js` | Label-Konstanten, Zählung, Validierung |
| `training.js` | Embeddings, Klassenausgleich, KNN-Training |
| `live-counter.js` | Erkennungsschleife, Entprellung, Diagnose |
| `ui/index.js` | Wizard-Zustandsautomat und History-Handling |
| `ui/screens/*.js` | Eine Renderfunktion pro Screen |

## Das Profil

Eine Snapshot-Position ist ein Objekt in `presence-counter:profiles`:

```js
{
  id,                    // crypto.randomUUID()
  name,
  facingMode,            // 'user' oder 'environment'
  captureCount,
  captureIntervalMs,
  classifierDataset,     // serialisiertes KNN-Dataset, null bis trainiert
  trainingDiagnostics,   // Protokoll pro Foto aus dem Training
  engine,                // { backend, engineMode, verified }
  previewImage,          // ein Trainingsfoto als Vorschaubild der Liste
  counter,
  history,               // Zeitstempel gezählter Wiederholungen
  createdAt,
  trainedAt,
}
```

## Kamera und Zuschnitt, `capture.js`

`startCamera()` fordert eine feste Idealauflösung von 1280x720 an:

```js
video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }
```

Aufnahme und Live-Betrieb sind getrennte `getUserMedia`-Sitzungen, und
Handykameras handeln bereitwillig pro Sitzung eine andere Auflösung aus. Die
Bilder werden mittig quadratisch beschnitten, ein anderes Seitenverhältnis der
Quelle heißt also, dass dieses Quadrat einen anderen Bildbereich abdeckt und
Trainingsfotos und Live-Bilder nicht mehr dasselbe zeigen.

`getCropRect()` liefert genau diesen **quadratischen Zuschnitt aus der
Bildmitte**. MobileNet streckt alles, was es bekommt, ohne eigenen Zuschnitt auf
224x224 und wurde auf ungefähr quadratischen Bildern trainiert. Ein
9:16-Hochformat verzerrt also weit genug, um Embeddings zu verschieben. Ein
4:3-Webcambild ist eine milde Streckung, ein Hochformatbild vom Handy ist
doppelt so extrem in die andere Richtung.

::: warning Offene Frage
Der Mittenzuschnitt wurde aus diesem Grund eingebaut und ist fachlich richtig, er
wirft aber echte Pixel oberhalb und unterhalb der Mitte weg, was im Hochformat
einen Kopf oder eine Waffe abschneiden kann, die nicht mittig sitzt. Gegen echte
Genauigkeit gemessen wurde er nie, weil zu seiner Entstehungszeit jedes Ergebnis
durch den Backend-Fehler aus
[ML-Backend und Verifikation](./ml-backend) verfälscht war. Ein A/B-Test lohnt
sich jetzt, wo die Ergebnisse belastbar sind.
:::

Drei Einstiegspunkte teilen sich dieses Rechteck:

- `captureFrameCanvas()` legt pro Aufruf ein Canvas an, für Einzelaufnahmen und
  für jeden Live-Tick.
- `captureFrameDataUrl()` verpackt es zur Speicherung als JPEG-Data-URL.
- `drawCroppedFrame()` zeichnet in ein Canvas, das der Aufrufer besitzt, für die
  laufende Vorschau, wo eine Allokation pro Bild Verschwendung wäre.

`captureSeries()` löst mit den aufgenommenen Data-URLs auf und ist jederzeit
abbrechbar, auch während des Countdowns. Den Countdown gibt es, weil die Person
auf den Fotos meist die Person mit dem Handy in der Hand ist.

### Wo die Kamera aufgeht

Nur auf dem Aufnahme- und dem Live-Bildschirm. Das Setup hat früher ebenfalls
eine geöffnet, zum Ausrichten und für die Bereichsauswahl, die es nicht mehr
gibt, und den Stream weitergereicht, damit Auswahl und Fotos aus derselben
Quelle stammen. Beides ist weg, das Setup ist ein reines Formular und der
Aufnahme-Screen öffnet die Kamera selbst.

Er versucht es sofort beim Einhängen, denn der Weg dorthin ist das Ergebnis
eines Taps, und dessen Aktivierung zählt normalerweise noch. Ein Startknopf
erscheint nur, wenn das fehlschlägt, etwa bei abgelehnter Berechtigung oder
einem Browser, der auf seiner eigenen Geste besteht, und verschwindet wieder,
sobald ein Stream läuft. Der Aufnahmeknopf bleibt bis dahin deaktiviert, damit
keine Serie gegen ein totes Videoelement aufgezeichnet werden kann.

## Labeling, `labeling.js`

Zwei Klassen: `LABELS.PERSON` für Snap, `LABELS.EMPTY` für Deckung. Die internen
Namen sind historisch, die Anzeigetexte kommen aus i18n.

Ignorierte Fotos behalten `label: null`, damit der Trainingsfilter sie ohne
zweites Flag verwirft. `validateLabels()` erzwingt `MIN_EXAMPLES_PER_CLASS` (5)
pro Klasse und liefert zurück, was noch fehlt, was der Zusammenfassungsbildschirm
direkt anzeigt.

## Training, `training.js`

Pro gelabeltem Foto: dekodieren, MobileNet bis zur vorletzten Schicht laufen
lassen und das entstehende Embedding aus 1280 Werten dem KNN hinzufügen. Das
Dataset wird anschließend in typisierte Arrays plus Shapes serialisiert, weil
Tensoren nicht in IndexedDB passen, typisierte Arrays aber Structured Clone
überstehen.

### Klassenausgleich

`balanceClasses()` deckelt beide Klassen vor dem Training auf dieselbe, zufällig
gemischte Anzahl.

Das KNN wählt seine k nächsten Nachbarn aus allen Beispielen gemeinsam und
stimmt dann nach roher Anzahl pro Klasse ab. Eine Klasse mit mehr Beispielen
gewinnt allein über die Dichte, auch wenn ihre Beispiele der Anfrage gar nicht
besonders ähnlich sind. Ein unausgewogener Trainingssatz verschiebt also jede
Vorhersage zur größeren Klasse.

::: tip Offene Frage
Der Ausgleich hat eine echte, beobachtete Verzerrung behoben, wurde seit der
Korrektur des Backend-Fehlers aber nie erneut geprüft. Ob er für einen korrekt
berechneten Merkmalsraum noch nötig ist, ist unbekannt.
:::

### Warum Diagnosedaten beim Training entstehen

Die gelabelten Fotos werden nach dem Training verworfen. Ohne Protokoll ist ein
aus leeren oder undekodierten Bildern trainierter Klassifikator zur Laufzeit
nicht von einem korrekten zu unterscheiden, und die Ausgangsbilder gibt es nicht
mehr.

Deshalb liefert jedes Foto einen Eintrag mit Pixelstatistik und
Embedding-Statistik (L2-Norm, Mittelwert, NaN-Anzahl).
`formatTrainingDiagnostics()` rendert das im Diagnosebericht des
Live-Bildschirms.

`getEngineSignature()` wird mitgespeichert, weil Embeddings nur mit anderen
derselben, verifizierten Engine vergleichbar sind.

## Live-Erkennung, `live-counter.js`

`startLiveDetection(videoEl, options)` gibt `{ stop, runDiagnostic }` zurück.

### Zähllogik

Eine rohe Vorhersage pro Bild, danach eine Entprellung:

```
isPersonFrame = label === 'person' && confidence >= 0.6

wenn isPersonFrame === confirmedPresent   laufende Serie zurücksetzen
sonst                                     Serie erhöhen
  Serie >= confirmFrames (2)               confirmedPresent umschalten
                                           beim Umschalten auf präsent zählen
```

Eine Wiederholung ist ein Übergang von Deckung zu Snap. Wer herausgesnapt bleibt,
zählt einmal, und die nächste Wiederholung braucht eine bestätigte Deckung
dazwischen. Doppelt zählt nichts.

### k und die Schwelle

`k = 5` wird explizit übergeben, weil `knn-classifier` standardmäßig 3 nutzt. Bei
drei Nachbarn kann die Konfidenz nur 0, 1/3, 2/3 oder 1 sein, eine Schwelle von
0.75 verlangt damit still eine einstimmige Abstimmung und wird fast nie erreicht.
Mit `k = 5` und Schwelle 0.6 entscheiden drei von fünf.

### Timing der Schleife

`intervalMs` ist eine Pause **nach** jedem Tick, keine Periode. Die tatsächliche
Bildrate ist `1000 / (inferenceMs + intervalMs)`.

Dieser Unterschied hat sich real ausgewirkt. Mit dem alten Standardwert von
100ms maß die WASM-Inferenz auf dem Testhandy rund 85ms im Mittel und 118ms im
Maximum, die Schleife lief damit bei etwa 5 Hz statt der angenommenen 10 Hz und
kostete zusätzlich rund 370ms Bestätigungsverzögerung. Der Standard liegt jetzt
bei 10ms, weil die Inferenz die Schleife ohnehin taktet.

Danach auf demselben Handy erneut gemessen, bei 720x720 Zuschnitt: 45ms im
Mittel und 54ms im Maximum, also rund 18 Hz und etwa 110ms
Bestätigungsverzögerung bei `confirmFrames = 2`. Die Inferenz selbst hat sich
ebenfalls halbiert, das wurde aber nicht isoliert: im selben Zeitraum ist das
Logging pro Tick entfallen, was der wahrscheinliche Grund ist.

Wird bei dieser Rate weiterhin ein Snap übersehen, ist der nächste Hebel
MobileNets `alpha`, das nicht die Schleife, sondern das Netz verkleinert.

Die Tick-Zeiten werden als gleitender Mittelwert über 20 Ticks ausgegeben,
bewusst nicht über die gesamte Laufzeit: JIT- und WASM-Aufwärmen machen die
ersten Ticks deutlich langsamer und würden den Wert dauerhaft von der
Dauerlaufgeschwindigkeit wegziehen, die darüber entscheidet, ob Wiederholungen
verloren gehen.

### Entkoppelte Vorschau

Der Live-Bildschirm zeichnet seine Zuschnittvorschau in einer eigenen
`requestAnimationFrame`-Schleife neu, nicht im Takt der Klassifikation. An die
Inferenz gekoppelt wirkte sie auf einem unbeschleunigten Backend wie eine
ruckelige Vorschau mit 8 bis 10 fps.

## Screens

| Screen | Datei | Anmerkung |
| --- | --- | --- |
| Profilliste | `screens/profileList.js` | Klick auf die Karte startet den Live-Betrieb, Buttons über `closest('button')` ausgenommen |
| Setup | `screens/setup.js` | Name, Kamerawahl, der 50/50-Hinweis, keine Kamera |
| Aufnahme | `screens/capture.js` | Öffnet die Kamera, Serieneinstellungen, Zuschnittvorschau, Vorschaubilder, Debug-Panel |
| Labeln | `screens/label.js` | Wischkarten über Pointer-Events, Ignorieren, Zurück |
| Training | `screens/train.js` | Fortschritt, speichert das Profil, kein Zurück-Ziel |
| Live | `screens/live.js` | Zähler, Statuszeile, Engine-Warnung, Debug-Werkzeuge |

::: warning Das Klickziel der Profilkarte
Die Karte nutzt einen einfachen Click-Listener auf einem Element im normalen
Fluss, keine absolut positionierte Overlay-Fläche. Mehrere Versuche mit einer
solchen Overlay-Fläche brachen auf Android und iOS jeweils unterschiedlich.

Der Fehler, der alle Versuche überlebt hat, war gar kein CSS-Problem. Die
Ausnahmeprüfung für die Aktionsbuttons traf `.profile-card-actions`, also das
umgebende div, dessen Box auf schmalen Bildschirmen breiter ist als die
sichtbaren Buttons. Taps in diesem Rand wurden verschluckt und sahen exakt wie
eine tote Zone aus. `closest('button')` hat es behoben.

Gefunden wurde es mit einem Touch-Event-Logger direkt auf dem Bildschirm,
nachdem drei plausible CSS-Korrekturen auf den beiden Plattformen
unterschiedlich gescheitert waren. Für einen UI-Fehler auf echter Hardware, der
mehrere Rateversuche übersteht, gilt: erst den Logger aufs Gerät bringen, dann
die nächste Korrektur.
:::
