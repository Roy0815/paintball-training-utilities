# Snaptraining Dryrun

Snaptraining Dryrun zählt Snapshot-Wiederholungen. Du stellst das Handy so auf,
dass es deine Position sieht, und es zählt jedes Mal, wenn du aus der Deckung
kommst und wieder zurückgehst. So kannst du drillen, ohne selbst mitzuzählen.

Dafür trainierst du ein eigenes Modell für genau eine Position. Das Modell
erkennt nicht "einen Menschen", sondern den Unterschied zwischen zwei Bildern
deiner Position: du in Deckung, und du herausgesnapt. Deshalb funktioniert es
mit jeder Wand, jedem Bunker und jedem Türrahmen, und deshalb muss es neu
trainiert werden, wenn du das Handy umstellst.

Eine trainierte Position heißt **Snapshot-Position**. Du kannst beliebig viele
anlegen, eine pro Stelle, an der du regelmäßig trainierst.

## Der Ablauf auf einen Blick

1. Snapshot-Position anlegen und Kamera ausrichten.
2. Eine Serie Fotos aufnehmen, während du drillst.
3. Jedes Foto als Snap oder Deckung labeln.
4. Trainieren, das dauert Sekunden.
5. Live zählen lassen.

## 1. Snapshot-Position anlegen

Drücke **+ Neue Snapshot-Position** und gib ihr einen Namen, der dir sagt, wo
das war, zum Beispiel "Maya Tempel" oder "Dorito 1".

Wähle Front- oder Rückkamera. Der Bildschirm zeigt dir außerdem das eine, was
darüber entscheidet, ob der Trainingssatz brauchbar wird: halb Deckung, halb
Snap.

Mehr ist das Formular nicht. Die Kamera geht im nächsten Schritt auf, dort
richtest du das Handy aus.

Zur Info: die App wertet ein Quadrat aus der Bildmitte aus und nicht das ganze
Bild, weil das Erkennungsmodell ungefähr quadratische Bilder erwartet. Was
zählt, sollte also mittig liegen.

## 2. Trainingsfotos aufnehmen

Die Kamera startet von selbst, sobald dieser Bildschirm aufgeht. Weigert sich
dein Browser, sie ungefragt zu öffnen, erscheint oben ein Knopf **Kamera
starten**, den du einmal drückst und der danach verschwindet.

Stelle das Handy genau dorthin, wo es später stehen soll. Alles, was das Modell
lernt, hängt an diesem Blickwinkel. Die Vorschau zeigt genau den Ausschnitt, der
gespeichert wird. Was du siehst, ist das, was das Modell bekommt.

Drei Einstellungen:

| Einstellung | Bedeutung |
| --- | --- |
| Anzahl Fotos | Wie viele Fotos die Serie aufnimmt. 30 ist ein guter Startwert. |
| Intervall (ms) | Zeit zwischen zwei Fotos. 1000 heißt ein Foto pro Sekunde. |
| Start-Verzögerung (s) | Countdown vor dem ersten Foto, damit du in Position kommst. |

Drücke **Serie aufnehmen** und drille ganz normal, solange die Serie läuft: in
Deckung, heraussnappen, zurück in Deckung. Ziel sind **ungefähr gleich viele
Fotos in Deckung wie herausgesnapt**. Während der Serie erscheinen die Fotos als
Vorschaubilder. **Aufnahme stoppen** bricht früher ab, **Serie erneut aufnehmen**
fängt von vorn an.

Danach **Weiter zum Labeling**.

## 3. Fotos labeln

Jedes Foto erscheint als Karte:

- **Nach rechts wischen** oder **✓ Snap** drücken, wenn du auf dem Foto
  herausgesnapt bist.
- **Nach links wischen** oder **✕ Deckung** drücken, wenn du vollständig in
  Deckung bist.
- **Ignorieren** für Fotos, die keines von beidem klar zeigen, etwa eine Aufnahme
  mitten in der Bewegung. Ignorierte Fotos werden nicht trainiert.
- **‹ Vorheriges Foto** geht zurück, wenn du dich vertan hast.

Sei hier streng. Ein verwackeltes Foto auf halbem Weg, das du als Snap labelst,
bringt dem Modell bei, dass der halbe Weg schon eine Wiederholung ist, und genau
so zählt es später.

Am Ende siehst du eine Zusammenfassung mit den Anzahlen. Für das Training
brauchst du mindestens **5 Fotos pro Klasse**.

## 4. Trainieren

Drücke **Weiter zum Training**. Ein Fortschrittsbalken zeigt, wie die Fotos
verarbeitet werden. Das läuft auf dem Gerät, braucht nach dem einmaligen
Modell-Download kein Internet und dauert normalerweise wenige Sekunden.

Die Trainingsfotos werden danach gelöscht. Eines davon bleibt als Vorschaubild in
der Liste.

## 5. Live zählen

Tippe in der Liste auf eine trainierte Snapshot-Position, um die Live-Zählung zu
starten.

- Die **große Zahl** ist der aktuelle Zählerstand.
- Die **Statuszeile** darunter zeigt, wie sicher sich das Modell gerade für jede
  Klasse ist und ob es dich als herausgesnapt oder in Deckung einstuft.
- **Counter zurücksetzen** setzt den Zähler auf null.

Gezählt wird der Übergang von Deckung zu Snap, nicht jedes Einzelbild. Wer
herausgesnapt stehen bleibt, wird einmal gezählt. Die nächste Wiederholung zählt
erst, wenn die App dich wieder in Deckung gesehen hat, eine Wiederholung kann
also nie doppelt zählen.

Die App ist absichtlich etwas konservativ: ein Zustand wechselt erst, wenn er
zweimal hintereinander erkannt wurde. Das verhindert, dass ein einzelnes falsch
gelesenes Bild eine Geisterwiederholung erzeugt.

Jede zehnte Wiederholung bis 100 wird laut angesagt, damit du nicht auf den
Bildschirm schauen musst. Die Sprachclips sind noch nicht dabei, bis dahin bleibt
es still.

## Gute Ergebnisse erreichen

- **Handy genauso aufstellen wie beim Training.** Das Modell lernt einen
  Blickwinkel. Ein anderer Winkel oder Abstand ist ein anderes Bild.
- **Licht vergleichbar halten.** Bei Tageslicht trainieren und abends unter einer
  Lampe zählen ist ebenfalls ein anderes Bild.
- **Während der Serie wirklich drillen.** Gestellte Fotos bringen dem Modell
  Posen bei, keine Wiederholungen.
- **Beide Klassen ausgewogen halten.** Ungefähr gleich viele Deckungs- und
  Snap-Fotos.
- **Bewegten Hintergrund aus dem Bild halten.** Alles, was sich im Bild bewegt,
  muss das Modell ignorieren lernen.
- **Nach dem Umstellen des Handys neu trainieren.** Das dauert eine Minute und
  löst fast jedes Genauigkeitsproblem.

## Neu trainieren und löschen

**Neu trainieren** auf einer Karte behält Name und Kamera und führt direkt in
eine neue Aufnahmeserie. Nutze das, wenn sich die Position geändert hat oder
die Zählung unzuverlässig wurde.

**Löschen** entfernt die Snapshot-Position samt Zähler und Verlauf. Es gibt eine
Rückfrage, aber kein Zurück.
