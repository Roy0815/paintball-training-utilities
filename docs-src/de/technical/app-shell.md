# App-Shell

## Header, `app/shell.js`

`renderShell(root)` baut den Header einmalig und gibt das `#view`-Element
zurück, in das der Router rendert. Der Header enthält genau einen Zurück-Button,
den Titel und den Sprachumschalter.

`setHeader({ title, onBack, forceLeftAlign })` ist der einzige Weg, die
Kopfleiste zu ändern. Jeder eingehängte Screen ruft es einmal auf. Screens
rendern nie einen eigenen Zurück-Button, und genau das hält die Kopfleiste über
alle Wizard-Schritte eines Features hinweg identisch.

- `onBack: null` blendet den Zurück-Button aus. Der Trainingsbildschirm nutzt
  das, weil ein Abbruch mittendrin nicht sicher ist.
- `forceLeftAlign` ist für die Startseite, die linksbündig sein soll, als feste
  Regel und nicht als Messergebnis.

### Titelzentrierung

Der Titel wird absolut über die volle Headerbreite zentriert, nicht im
Flex-Zwischenraum, weil Zurück-Button und Sprachumschalter unterschiedlich breit
sind und ein flexzentrierter Titel je nach Sichtbarkeit verrutschen würde.

Ein zentrierter Titel wirkt nur so lange gewollt, wie er passt.
`updateTitleAlignment()` vergleicht nach jedem Rendern `scrollWidth` mit
`clientWidth` und fällt auf das normale linksbündige Flex-Layout zurück, sobald
der Text abgeschnitten wird. Das muss gemessen statt angenommen werden, weil
Titel übersetzt sind und auf dem Live-Bildschirm aus Profilnamen bestehen, die
Nutzer selbst eingeben.

Die Breite dieses zentrierten Bereichs wird ebenfalls gemessen, von
`fitCenteredTitle()`, anhand der rechten Kante des Zurück-Buttons und der linken
Kante des Sprachumschalters. Früher stand dafür ein fester Wert im CSS, und der
war in beide Richtungen falsch: lange deutsche Titel wie "Trainingsdaten
sammeln" stießen an die Sprachpillen, während auf der Seite des Zurück-Buttons
Platz verschenkt wurde, der schmaler und manchmal gar nicht vorhanden ist. Da
der Titel absolut positioniert ist, beeinflusst er diese Messung nicht, beide
Kanten lassen sich also direkt auslesen.

Das dabei gesetzte Inline-`max-width` muss vor dem Umschalten auf die
linksbündige Klasse gelöscht werden, sonst gewinnt es gegen die Klassenregel,
die es aufheben soll.

### Sprachwechsel außerhalb des Outlets

Der Router rendert `#view` bei einem Sprachwechsel neu, der Header liegt aber
außerhalb und wird genau einmal gebaut. Deshalb abonniert er `onLangChange`
selbst, um das `aria-label` des Zurück-Buttons und die aktive Sprachpille zu
aktualisieren.

## Routing, `app/router.js`

Hash-basiert, damit GitHub Pages keine Rewrite-Regeln braucht.

```
#/                    Startseite
#/feature/<id>        dieses Feature einhängen
alles andere          Startseite
```

Der Router hat einen einzigen Vertrag: `feature.mount(container)` darf eine
Cleanup-Funktion zurückgeben, und der Router wartet sie ab, bevor er etwas
anderes rendert. So werden Kamerastreams und Erkennungsschleifen bei Navigation
abgebaut.

Ein Sprachwechsel ruft `render()` erneut auf, genau wie eine Navigation. Ohne
Reaktivitätsschicht ist das erneute Ausführen der Route der einfachste Weg, jeden
String neu zu rendern.

## Feature-Registry, `features/index.js`

```js
export const features = [
  {
    id: 'snaptraining-dryrun',
    nameKey: 'feature.snaptrainingDryrun.name',
    icon: '📷',
    descriptionKey: 'feature.snaptrainingDryrun.description',
    async mount(container) {
      const { mount } = await import('./snaptraining-dryrun/ui/index.js');
      return mount(container);
    },
  },
];
```

`mount` ist ein dynamischer Import, damit die Abhängigkeiten eines Features erst
geladen werden, wenn man es öffnet. Sonst würde die Startseite ganz TensorFlow.js
mitziehen.

Name und Beschreibung sind i18n-**Schlüssel**, keine Strings. Dieses Modul ist
statisch und wird ausgewertet, bevor eine Sprache feststeht, deshalb muss der
Lookup zur Renderzeit in dem Screen passieren, der sie anzeigt.

Ein neues Tool heißt: `src/features/<name>/` mit einem `mount(container)`
anlegen, die Strings in `i18n.js` ergänzen und hier einen Eintrag hinzufügen. An
der Shell ändert sich nichts.

## Internationalisierung, `shared/i18n.js`

Eine flache Tabelle von punktgetrennten Schlüsseln auf `{ de, en }`, bewusst
nicht verschachtelt, damit ein Lookup ein einziger Property-Zugriff ist, auf
einem Pfad, der bei jedem Screen-Rendern läuft.

```js
t('snaptraining.list.deleteConfirm', { name: profile.name });
```

`t()` ersetzt `{name}`-Platzhalter und warnt bei einem fehlenden Schlüssel,
statt zu werfen. `formatDate()` formatiert über `toLocaleString` in der aktiven
Sprache.

Die Sprache wird beim ersten Start aus `navigator.language` erkannt, fällt auf
Deutsch zurück und wird danach in `localStorage` gemerkt. Jeder Speicherzugriff
liegt in `try/catch`: Browser im privaten Modus werfen, und eine verlorene
Spracheinstellung ist kein Grund, die App zu zerlegen.

`setLang()` benachrichtigt die Listener, wodurch Router und Header neu rendern.

### Scrollposition und Scroll-Hinweis

`setHeader()` scrollt zusätzlich nach oben. Jeder Screen ruft es beim Einhängen
genau einmal auf, damit ist es die einzige Stelle, die sowohl Router-Navigation
als auch die Wizard-Schritte eines Features abdeckt. Ohne das übernimmt ein
neuer Screen die Scrollposition des vorherigen und öffnet irgendwo in seiner
Mitte.

Die Shell besitzt außerdem einen Scroll-Hinweis: ein Verlauf mit Pfeil, fest am
unteren Rand, sichtbar nur solange darunter noch Inhalt kommt, und am Seitenende
ausgeblendet, damit er nie auf dem letzten Element liegt. Die Screens hier sind
auf einem Handy lang genug zum Scrollen, und ein wichtiger Button knapp unter
der Kante wirkt nicht versteckt, sondern schlicht nicht vorhanden.

Gesteuert wird er über die Scrollwerte des Dokuments und nicht über einen
Scroll-Container, weil die Seite als Ganzes scrollt. Ein `ResizeObserver` auf
`#view` deckt die Fälle ab, in denen weder ein Scroll- noch ein Resize-Event
feuert: Screens tauschen ihren Inhalt ohne Navigation, und eine Kameravorschau
ändert ihre Höhe, sobald der Stream seine Auflösung meldet. Scroll und Resize
werden auf den nächsten Frame gebündelt, weil der Handler Layout liest.

Zwei zugehörige CSS-Details stehen in `style.css`: `#app` nutzt `100dvh` neben
`100vh`, weil `vh` den Streifen hinter den Browserleisten mitzählt und Screens
dadurch unter der sichtbaren Kante endeten, und `main#view` hat unten ein
Padding aus `env(safe-area-inset-bottom)` plus etwas Zugabe, damit der letzte
Button die Home-Anzeige des Telefons freihält.

## Navigation innerhalb eines Features, `snaptraining-dryrun/ui/index.js`

Der Wizard ist ein kleiner Zustandsautomat im Speicher: `goList`, `goSetup`,
`goCapture`, `goLabel`, `goTrain`, `goLive`. Jede Funktion baut den vorherigen
Screen ab, rendert den nächsten und gibt ihm ein `onBack`-Ziel mit.

### Warum die Schritte nicht in der URL stehen

Der Router hängt bei jeder Hash-Änderung das gesamte Feature neu ein, was eine
laufende Aufnahme- oder Labeling-Sitzung löschen würde. Deshalb tauchen die
Wizard-Schritte bewusst nicht im Hash auf.

Damit war der komplette Wizard ein einziger History-Eintrag, und die
Android-Zurück-Geste sprang unabhängig von der Tiefe direkt aus dem Feature auf
die Startseite. Die Lösung ist manuelles History-Handling:

- jeder Vorwärtsschritt ruft `pushState` mit derselben URL auf, rein um
  Stack-Tiefe zu erzeugen,
- ein `popstate`-Listener spielt dasselbe `onBack`-Ziel ab, das der aktuelle
  Screen ohnehin an den App-internen Zurück-Button hängt,
- ein Screen ohne Zurück-Ziel (laufendes Training) schiebt den gerade
  entfernten Eintrag wieder drauf, damit sichtbarer Screen und History-Position
  synchron bleiben.

Systemgeste und App-Pfeil tun dadurch immer dasselbe.

### Der Übergangs-Guard

`goTrain` und `goLive` importieren ihr Screen-Modul dynamisch, wodurch eine echte
asynchrone Lücke entsteht, in der der auslösende Button noch sichtbar und noch
klickbar ist. Zwei Dinge decken diese Lücke ab:

- ein Spinner, damit der Tap nicht ignoriert wirkt,
- ein `transitioning`-Flag, das nicht kosmetisch ist. Ein zweiter Tap auf
  "Weiter zum Training" führte früher `goTrain` doppelt aus, und da jeder Lauf
  eine eigene Profil-id anlegt und speichert, entstanden aus einem
  Labeling-Durchlauf zwei Profile in der Liste.

## CSS-Konventionen, `style.css`

Ein Stylesheet, Design-Tokens als Custom Properties ganz oben, nur ein dunkles
Theme.

::: warning Die `[hidden]`-Falle
Ein Element mit dem Attribut `hidden` wird trotzdem gerendert, wenn irgendeine
eigene Regel `display` auf derselben Klasse setzt. Ein Ein-Klassen-Selektor liegt
mit der Browserregel `[hidden] { display: none }` gleichauf, dann entscheidet die
Reihenfolge, und die eigene Regel gewinnt.

Das ist dreimal passiert, bei `.back-link`, `.crop-preview` und `.lang-switch`.
Jede betroffene Klasse trägt jetzt einen expliziten Override:

```css
.crop-preview[hidden] {
  display: none;
}
```

Jede neue Klasse, die `display` setzt und über `hidden` umgeschaltet wird,
braucht dieselbe Zeile.
:::

::: warning Ein Block über die volle Breite skalieren
Ein `transform: scale()` löst kein Reflow aus, es überläuft aber sehr wohl. Ein
Blockelement in einer Flex-Spalte wird standardmäßig auf die volle
Containerbreite gestreckt, beim Hochskalieren schieben sich seine Kanten also
auf beiden Seiten über den Viewport hinaus. Genau das tat der Flash des
Live-Zählers: auf Android eine horizontale Scrollbar, auf iOS ein Reflow, der
den Button darunter verschoben hat.

Die Lösung ist, das Element seinen Inhalt umschließen zu lassen, hier
`align-self: center`, damit das Wachstum ein Anteil der Textbreite ist und nicht
der Bildschirmbreite. `#app` trägt zusätzlich `overflow-x: clip` als Auffangnetz,
clip statt hidden, damit der sticky Header und der fixierte Scroll-Hinweis
weiter funktionieren.
:::
