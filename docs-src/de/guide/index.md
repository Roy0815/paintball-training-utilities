# Überblick

Paintball Training Utilities ist eine Sammlung von Trainingstools, die im
Browser auf dem Handy laufen. Die App startet mit einer Übersicht, in der jedes
Tool eine Kachel hat. Kachel antippen, los geht's.

Aktuell gibt es ein Tool: [Snaptraining Dryrun](./snaptraining-dryrun) zählt
Snapshot-Wiederholungen über die Kamera.

## Alles bleibt auf dem Gerät

Es gibt keinen Account, keinen Server und keinen Upload. Der Kamerastream wird
im Browser verarbeitet, die Trainingsfotos werden nach dem Training gelöscht,
und das trainierte Modell samt Zählerstand liegt im Speicher des Browsers auf
genau diesem einen Gerät.

Zwei Konsequenzen, die man kennen sollte:

- Wenn du die Browserdaten für diese Seite löschst, sind deine
  Snapshot-Positionen weg.
- Eine auf dem Handy trainierte Position taucht auf keinem anderen Gerät auf.

## Als App installieren

Öffne die App im Handy-Browser und nutze "Zum Startbildschirm hinzufügen"
(Chrome) beziehungsweise den gleichnamigen Eintrag im Teilen-Menü (Safari).
Danach startet sie wie eine normale App, im Vollbild und ohne Browserleiste.

Beim ersten Training oder Live-Lauf lädt die App das Bilderkennungsmodell
herunter, rund 5 MB, dafür ist eine Internetverbindung nötig. Danach ist es
zwischengespeichert und alles funktioniert offline. Das ist wichtig, weil
Training meist ohne verlässlichen Empfang stattfindet.

## Kamerazugriff

Die Kamera startet erst, wenn du "Kamera starten" drückst, und stoppt, sobald du
den Bildschirm verlässt. Der Browser fragt beim ersten Mal nach Erlaubnis. Wenn
du ablehnst, musst du sie in den Website-Einstellungen des Browsers wieder
freigeben, denn die App kann nicht erneut fragen.

## Sprache

Oben im Header gibt es einen DE/EN-Umschalter, der die gesamte App sofort
umstellt. Die Auswahl wird auf dem Gerät gemerkt. Beim ersten Start folgt die App
der Browsersprache und fällt auf Deutsch zurück.
