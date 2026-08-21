# Fehlerbehebung

## "Kamerazugriff fehlgeschlagen"

- Die Seite muss über HTTPS laufen. Browser erlauben Kamerazugriff nur in einem
  sicheren Kontext, die veröffentlichte App läuft bereits über HTTPS.
- Prüfe die Kameraberechtigung in den Website-Einstellungen des Browsers. Einmal
  abgelehnt, kann die App nicht erneut fragen.
- Schließe andere Apps, die die Kamera benutzen. Auf manchen Handys darf immer
  nur eine App gleichzeitig auf die Kamera zugreifen.
- Probiere die andere Kamera. Manche Geräte lehnen einen bestimmten Kameramodus
  ab.

## Der Zähler bewegt sich nicht

Der Reihe nach durchgehen:

1. **Statuszeile ansehen.** Zeigt sie sinnvolle Prozentwerte, die sich bei
   Bewegung ändern, funktioniert das Modell und nur die Schwelle wird nicht
   erreicht. Komm weiter aus der Deckung heraus oder trainiere mit klareren
   Fotos neu.
2. **Prüfen, ob das Handy dort steht, wo es beim Training stand.** Das ist mit
   Abstand die häufigste Ursache. Ein anderer Winkel oder Abstand ist für das
   Modell ein anderes Bild.
3. **Licht prüfen.** Gleicher Grund.
4. **Position neu trainieren.** Schneller als jede Analyse und behebt die
   meisten Fälle.

## Die Prozentwerte hängen bei 100 und 0

Wenn eine Klasse bei 100% steht, egal was die Kamera sieht, reagiert die Vorhersage
gar nicht mehr auf das Bild. Das ist ein anderes Problem als schlechte
Genauigkeit.

Schau nach einer Warnung unter dem Zähler, die die Engine betrifft (siehe
nächster Abschnitt), und trainiere in dem Fall neu. Gibt es keine Warnung,
schalte den **Debug-Modus** ein (Zahnradsymbol auf der Startseite,
Einstellungen), um den Button **🔬 Diagnose ausführen** auf dem
Live-Bildschirm einzublenden. Er erzeugt einen technischen Bericht, und
**📋 Debug-Log kopieren** legt ihn in die Zwischenablage, sodass er in einen
Fehlerbericht passt. Die [technische Doku](/de/technical/ml-backend) erklärt,
wie man ihn liest.

## Warnung: mit einer Engine trainiert, läuft auf einer anderen

Die App wählt den schnellsten Weg, das Modell auszuführen, der auf deinem Gerät
zusätzlich eine Korrektheitsprüfung besteht. Ändert sich diese Wahl zwischen
Training und Live-Betrieb, sprechen gespeichertes Modell und laufende Engine
nicht mehr dieselbe Sprache, und die Vorhersagen werden nicht nur schlechter,
sondern bedeutungslos.

Die Lösung ist immer dieselbe: **Snapshot-Position neu trainieren.** Die Warnung
erscheint auch, wenn du die Engine manuell mit dem ⚙️-Button umgestellt hast,
der erst auftaucht, wenn der Debug-Modus in den Einstellungen eingeschaltet
ist, und nicht für den normalen Betrieb gedacht ist.

## Kein Ton bei jeder zehnten Wiederholung

Prüfe zuerst die Lautstärke des Handys und den Stummschalter, die App hat keine
eigene Lautstärkeregelung. Prüfe außerdem, ob **Zahlen-Sound** in den
Einstellungen unter Snaptraining Dryrun noch an ist. Angesagt wird nur jede
zehnte Wiederholung bis 100, dazwischen bleibt es absichtlich still.

Auf dem iPhone ist Ton erst erlaubt, nachdem du etwas angetippt hast. Der Tap
auf die Snapshot-Position zählt dafür, öffne den Live-Bildschirm also darüber
und nicht durch einen Reload.

## Kein Auslöser-Ton bei der Aufnahme

Prüfe, ob **Kamera-Sound** in den Einstellungen unter Snaptraining Dryrun an
ist und ob das Handy nicht stummgeschaltet ist. Wie beim Countdown und den
Wiederholungsansagen funktioniert der allererste Ton auf diesem Bildschirm auf
dem iPhone nur, wenn er nah genug auf einen Tap folgt, um noch als deine
Erlaubnis zu zählen.

## Wiederholungen werden übersehen

Die Statuszeile aktualisiert sich einmal pro klassifiziertem Bild. Ist das Handy
langsam, liegt zwischen zwei Bildern eine echte Lücke, und ein sehr schnelles
Heraussnappen kann dazwischenfallen. Halte oben in der Bewegung kurz inne.

## Offline geht gar nichts

Das Bilderkennungsmodell wird einmalig beim ersten Training oder Live-Lauf
geladen und ist rund 5 MB groß. Solange das nicht einmal mit Internetverbindung
passiert ist, kann die App nicht offline laufen. Alles andere ist bereits bei der
Installation zwischengespeichert.

## Meine Snapshot-Positionen sind weg

Sie liegen im Browserspeicher genau dieses einen Geräts. Browserdaten für die
Seite löschen, die installierte App deinstallieren oder die App in einem anderen
Browser oder auf einem anderen Handy öffnen bedeutet jeweils: leere Liste. Es
gibt keine Synchronisation und kein Backup.
