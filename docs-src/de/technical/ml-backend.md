# ML-Backend und Verifikation

`shared/ml-utils.js` lädt MobileNet und wählt ein TensorFlow.js-Backend.
`shared/ml-diagnostics.js` enthält die Prüfungen, die entscheiden, ob ein
Backend vertrauenswürdig ist, sowie die Diagnosewerkzeuge.

## Warum es das gibt

Die Live-Erkennung funktionierte auf einem Laptop und hing auf einem
Samsung-Handy (Exynos, Xclipse 940, ANGLE auf Vulkan) bei exakt einer Klasse =
100%, der anderen = 0%, unabhängig davon, was die Kamera sah, auf beiden Kameras,
nie verrauscht.

Die Ursache lag nicht in diesem Code. **Der GPU-Treiber des Handys hat falsche
Zahlen berechnet.** Sobald die Arithmetik gegen bekannte Ergebnisse geprüft
wurde, scheiterte das WebGL-Backend an der elementarsten Operation überhaupt:

```
webgl: elementwise 0.9899886   <- tf.mul(x, scalar(1)) um ~0.99 daneben
       normalize   0.0832      <- ein Einheitsvektor maß nicht 1
       matMul      0.6246
wasm:  elementwise 0           normalize 4.3e-7    matMul 9.6e-7
```

Jedes Capability-Flag auf diesem Gerät sah gesund aus: `float32Capable: true`,
`downloadFloatEnabled: true`, `forceF16Textures: false`, WebGL 2. Nirgends wurde
ein Fehler geworfen.

::: danger Die Lehre
Ein Backend kann sauber initialisieren, jedes Capability-Flag als unterstützt
melden und trotzdem Müll zurückgeben, ohne je zu scheitern. Feature Detection
sieht das nicht. Nur der Abgleich von Ergebnissen mit bekannten Antworten sieht
es.
:::

Weiter unten in der Kette erzeugten die korrupten Embeddings eine festhängende
Vorhersage statt Rauschen. Die klasseninterne Ähnlichkeit für `person` lag bei
0.658 und damit **niedriger** als die klassenübergreifende von 0.775, der
Merkmalsraum war also durcheinander, während `empty` mit 0.952 zusammenhielt,
weil Fotos einer leeren Wand einander fast gleichen. Jede Anfrage fiel damit in
den `empty`-Cluster.

### Die Signale, die es aufgedeckt haben

Vier Beobachtungen, in der Reihenfolge, in der sie eingegrenzt haben. Jede davon
ist eine Invariante und kein Symptom, und genau deshalb sind sie auf dem
nächsten Gerät mit diesem Verhalten wieder brauchbar.

- **`row L2` war nicht 1.0.** `addExample()` normalisiert jede gespeicherte
  Zeile auf Einheitslänge, jede andere Zeilennorm beweist also falsche
  Arithmetik, egal woher der Vektor kommt. Das Handy maß 0.381 bis 1.409, der
  Laptop exakt 1.
- **Eine Kosinusähnlichkeit von 1.676.** Zwischen Einheitsvektoren unmöglich.
- **Werte, die sich mit Abstand 4 wiederholen**, also genau ein RGBA-Texel. Das
  blieb auch nach dem Abschalten gepackter Texturen bestehen, war also kein
  Packing-Fehler.
- **`zeros: 1` von 1280.** Die vorletzte Schicht von MobileNet liegt hinter
  einem ReLU und hat normalerweise 10 bis 15% Nullen. Der Laptop lieferte 139,
  WASM 641, das WebGL-Backend des Handys 1. Die Sparsity-Struktur war schlicht
  verschwunden.

## Backendauswahl

```js
const AUTO_CANDIDATES = ['webgl', 'wasm', 'cpu'];
```

`selectBackend()` geht die Kandidaten vom schnellsten zum langsamsten durch und
behält den ersten, der nachweist, dass er korrekt rechnet. Der letzte Kandidat
wird bedingungslos akzeptiert, damit es immer eine lauffähige Engine gibt.

Das ist bewusst geräteunabhängig. Eine Treiber-Allowlist würde veralten und das
nächste kaputte Gerät nie erwischen.

### Engine-Modi

`ENGINE_MODES` erlaubt zusätzlich, ein Backend zu erzwingen. Der ⚙️-Button auf
dem Live-Bildschirm schaltet durch, die Wahl liegt in `localStorage`:

| Modus | Bedeutung |
| --- | --- |
| `auto` | Prüfen und wählen. Standard und das, was Nutzer bekommen. |
| `webgl` | GPU mit tf.js-Standardeinstellungen. |
| `nopack` | GPU mit allen `WEBGL_PACK_*`-Flags aus, ein Wert pro Texel. |
| `wasm` | SIMD-beschleunigte CPU, kein GPU-Treiber beteiligt. |
| `cpu` | Reines JS. Am langsamsten und am vertrauenswürdigsten. |

Erzwungene Modi **überspringen die Verifikation absichtlich** und können daher
falsche Ergebnisse liefern. Sie existieren für A/B-Tests auf einem bestimmten
Gerät.

## Die zwei Prüfungen

### `testBackendArithmetic()`

Läuft auf dem rohen Backend, bevor das Modell geladen wird, auf einem Vektor mit
1280 Werten, also derselben Breite wie ein MobileNet-Embedding:

| Prüfung | Wofür sie steht |
| --- | --- |
| elementwise | `tf.mul(x, scalar(1))` muss `x` zurückgeben |
| normalize | eine Reduktion gefolgt von einer Division, genau das ist Normalisierung auf Einheitslänge |
| matMul | die gesamte Ähnlichkeitssuche des KNN |

Die Normalisierungsprüfung ist die allgemeine Form der Invariante, die hier
gebrochen war: ein normalisierter Vektor, dessen Länge nicht 1.0 ist, beweist
falsche Arithmetik, egal woher er kommt. Die Toleranz liegt bei `1e-3`.

### `testModelOutput()`

Kleine, regelmäßige Tensoren können auf einem Treiber durchgehen, der an einem
tiefen Faltungsstapel trotzdem scheitert. Deshalb wird auch das geladene Modell
geprüft. Ein synthetisches Bild wird eingebettet und das Ergebnis gegen das
geprüft, was jedes MobileNet-Embedding unabhängig vom Inhalt erfüllen muss:

- kein NaN,
- Einheitslänge nach Normalisierung,
- keine Werte, die sich mit Abstand 4 wiederholen, denn das ist genau ein
  RGBA-Texel und der Fingerabdruck eines Texturadressierungsfehlers.

Die Anzahl der Nullen wird daneben ausgegeben, aber bewusst nicht geprüft. Die
vorletzte Schicht liegt hinter einem ReLU, ein gesundes Embedding ist also
dünn besetzt, wie stark hängt jedoch vom Backend ab: dasselbe synthetische Bild
ergibt 139 Nullen auf dem WebGL des Laptops und 641 auf WASM. Ein einzelner
Schwellwert passt auf beides nicht, während sich das defekte Gerät mit 1 Null
von 1280 selbst verraten hat. Es bleibt ein Signal für den, der den Bericht
liest, keine Schranke.

Scheitert die Modellprüfung, wird das Backend verworfen und der nächste Kandidat
bekommt ein frisch geladenes Modell.

## Die Engine-Signatur

```js
{ backend: 'wasm', engineMode: 'auto', verified: true }
```

Wird mit jedem trainierten Profil gespeichert. Embeddings sind nur mit anderen
aus einer korrekt rechnenden Engine vergleichbar. Ein Profil, das auf einem
unverifizierten oder anderen Backend trainiert wurde, enthält also einen
Merkmalsraum, gegen den die aktuelle Sitzung nicht vergleichen kann, so gesund er
auch aussieht.

Der Live-Bildschirm vergleicht die gespeicherte Signatur mit dem laufenden
Backend und zeigt bei jeder Abweichung eine Aufforderung zum Neutrainieren. Das
ist keine weiche Warnung: das gespeicherte Modell ist in diesem Zustand
tatsächlich wertlos.

## WASM-Binaries

`@tensorflow/tfjs-backend-wasm` ist eine echte Abhängigkeit, kein optionales
Extra. Auf betroffenen Geräten **ist** es die Inferenz-Engine.

Das Backend wird dynamisch importiert, damit Geräte, die es nie brauchen, es auch
nicht herunterladen. Die `.wasm`-Dateien laufen mit `?url` durch Vite, werden
also gehasht und wie jedes andere Asset ausgeliefert, und `wasm` steht in den
`globPatterns` des Service Workers, damit Offline-Inferenz genau auf den Geräten
funktioniert, die darauf angewiesen sind.

## Einen Diagnosebericht lesen

Der Button **🔬 Diagnose ausführen** auf dem Live-Bildschirm nimmt ein Bild auf
und berichtet alles, was hinter einer einzelnen Vorhersage steckt.
`predictClass()` presst all das in eine k-aus-n-Abstimmung und verdeckt damit
die zwei Fehlerbilder, die von außen identisch aussehen: ein degeneriertes
Embedding und ein gesundes Embedding der falschen Pixel.

Worauf man in welcher Reihenfolge schaut:

| Zeile | Gesunder Wert | Was ein schlechter Wert bedeutet |
| --- | --- | --- |
| `row L2 (must be 1.0)` | exakt 1.0 | `addExample()` normalisiert jede gespeicherte Zeile auf Einheitslänge, alles andere beweist falsche Arithmetik zur Trainingszeit |
| `canvas vs imageData` | ~1.0 | dieselben Pixel über zwei Upload-Wege, ein niedrigerer Wert heißt, der Canvas-zu-Textur-Upload sieht nicht, was gezeichnet wurde |
| `intra-class sim` gegen `inter-class sim` | intra deutlich höher | intra unter inter heißt, der Merkmalsraum ist durcheinander |
| `distinct values` | nahe am Gesamtwert | wenige verschiedene Ähnlichkeiten heißt, alles liegt gleichauf, was ein hartes, inhaltsunabhängiges 100%/0% erzeugt |
| `zeros` in einem Embedding | grob 10 bis 15% von 1280 | fast keine Sparsity heißt, die ReLU-Struktur ist weg |
| `nan` | 0 | alles andere ist eine tote Berechnung |
| Kopfwerte, die sich alle 4 wiederholen | keine Wiederholung | ein Texturadressierungsfehler |

Eine Kosinusähnlichkeit über 1.0 zwischen Einheitsvektoren ist unmöglich und
selbst schon ein Beweis für falsche Arithmetik.

**📋 Debug-Log kopieren** legt die Panels in die Zwischenablage. Den Button gibt
es, weil das Testhandy kein funktionierendes USB-Remote-Debugging hatte und alles
auf dem Bildschirm lesbar sein musste.

## Unterwegs ausgeschlossen

Alles Folgende wurde untersucht und als Ursache ausgeschlossen. Aufgelistet,
damit dieselbe Strecke nicht zweimal abgelaufen wird:

Zuschnitt- oder Auflösungsunterschiede zwischen Setup- und Aufnahmesitzung, Verzerrung
der KNN-Abstimmung durch ungleiche Klassenanzahlen, `k = 3`, das die
Konfidenzschwelle unerreichbar macht, vertauschte Label-Buttons, MobileNets
interne Skalierung, Verzerrung durch das Hochformat, WebGL-Flags zur
Float-Genauigkeit, Nachbearbeitung der Frontkamera, die interne Indizierung von
`knn-classifier`, Vektornormalisierung, Closure-Fehler in der Trainingsschleife,
der Canvas-zu-Textur-Upload (`canvas vs imageData` maß auf beiden Geräten
1.0000) und gepackte WebGL-Texturen.

Mehrere davon waren echte Fehler, auch wenn keiner dieser eine war, und ihre
Korrekturen sind geblieben: der
[Klassenausgleich](./snaptraining-dryrun#klassenausgleich),
[k = 5 mit Schwelle 0.6](./snaptraining-dryrun#k-und-die-schwelle) und der
[Mittenzuschnitt](./snaptraining-dryrun#kamera-und-zuschnitt-capture-js). Eine
weitere, die Übergabe des Kamerastreams vom Setup an die Aufnahme, damit beide
dieselbe Auflösung sehen, hat sich erledigt: das Setup öffnet gar keine Kamera
mehr.

## Erwartetes Ergebnis je Gerät

Bevor man eine Backendwahl für einen Fehler hält: ein Desktop oder Laptop mit
normaler GPU wählt `webgl`. Das Samsung-Testhandy wählt `wasm`, und das ist das
richtige Ergebnis, keine Verschlechterung.
