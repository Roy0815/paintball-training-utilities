# App shell

## Header, `app/shell.js`

`renderShell(root)` builds the header once and returns the `#view` outlet the
router renders into. The header holds a single back button, the title and the
language switch.

`setHeader({ title, onBack, forceLeftAlign })` is the only way to change the top
bar. Every mounted screen calls it once. Screens never render a back button of
their own, which is what keeps the top bar identical across a feature's internal
wizard steps.

- `onBack: null` hides the back button. The training screen uses this, since
  interrupting a run mid way is not safe.
- `forceLeftAlign` is for the home screen, which wants left alignment as a rule
  rather than as a measurement result.

### Title centering

The title is absolutely centered on the header's full width, not centered in the
flex gap, because the back button and the language switch are not the same width
and a flex centered title would drift depending on which of them is visible.

A centered title only looks intentional while it fits. `updateTitleAlignment()`
compares `scrollWidth` against `clientWidth` after each render, and falls back to
the plain left aligned flex layout when the text is being clipped. It has to be
measured rather than assumed, because titles are translated and, on the live
screen, are user entered profile names.

The width of that centered slot is measured too, by `fitCenteredTitle()`, from
the back button's right edge and the language switch's left edge. It used to be
a fixed reserve in CSS, which was wrong in both directions: it left long German
titles such as "Trainingsdaten sammeln" touching the language pill, while
wasting room on the back button's side, which is narrower and sometimes not
there at all. Since the title is absolutely positioned it does not affect that
measurement, so both edges can be read directly.

The inline `max-width` this writes has to be cleared before switching to the
left aligned class, otherwise it would beat the class rule that removes it.

### Language changes outside the outlet

The router re-renders `#view` on a language switch, but the header lives outside
it and is built exactly once. It therefore subscribes to `onLangChange` itself to
refresh the back button's `aria-label` and the active language pill.

## Routing, `app/router.js`

Hash based, so GitHub Pages needs no rewrite rules.

```
#/                    home screen
#/feature/<id>        mount that feature
anything else         home screen
```

The router owns one contract: `feature.mount(container)` may return a cleanup
function, and the router awaits it before rendering anything else. That is how
camera streams and detection loops get torn down on navigation.

A language switch calls `render()` again, exactly like a navigation would. With
no reactivity layer, re-running the route is the simplest way to get every string
re-rendered.

## Feature registry, `features/index.js`

```js
export const features = [
  {
    id: 'presence-counter',
    nameKey: 'feature.presenceCounter.name',
    icon: '📷',
    descriptionKey: 'feature.presenceCounter.description',
    async mount(container) {
      const { mount } = await import('./presence-counter/ui/index.js');
      return mount(container);
    },
  },
];
```

`mount` is a dynamic import so a feature's dependencies load only when it is
opened. Without that, the home screen would pull in all of TensorFlow.js.

Names and descriptions are i18n **keys**, not strings. This module is static and
evaluated before a language is picked, so the lookup has to happen at render
time in whichever screen displays them.

Adding a tool means creating `src/features/<name>/` with a `mount(container)`
entry point, adding its strings to `i18n.js`, and adding one entry here. Nothing
in the shell changes.

## Internationalisation, `shared/i18n.js`

A flat table of dot namespaced keys to `{ de, en }`, deliberately not nested, so
a lookup is one property access on a path that runs for every rendered screen.

```js
t('pc.list.deleteConfirm', { name: profile.name });
```

`t()` substitutes `{name}` placeholders and warns on a missing key rather than
throwing. `formatDate()` formats through `toLocaleString` in the active locale.

The language is detected from `navigator.language` on first start, defaults to
German, and is then persisted in `localStorage`. Every storage access is wrapped
in `try/catch`: private mode browsers throw, and losing a persisted preference is
not a reason to break the app.

`setLang()` notifies listeners, which is what makes the router and the header
re-render.

### Scroll position and the scroll hint

`setHeader()` also scrolls back to the top. Every screen calls it exactly once
on mount, which makes it the single place that catches both router navigation
and a feature's own wizard steps. Without it a new screen inherits the previous
screen's scroll position and can open somewhere in its middle.

The shell also owns a scroll hint, a fade with a chevron fixed to the bottom
edge, shown only while there is more content below and hidden at the end of the
page so it never covers the last element. Screens here are long enough to scroll
on a phone, and a primary button just below the fold reads as a missing button
rather than a hidden one.

It is driven by the document's own scroll metrics rather than a scroll
container, because the page scrolls as a whole. A `ResizeObserver` on `#view`
covers the cases where no scroll or resize event fires at all: screens swap
their content without navigating, and a camera preview changes height once the
stream reports its resolution. Both scroll and resize are coalesced onto the
next animation frame, since the handler reads layout.

Two related CSS details live in `style.css`: `#app` uses `100dvh` alongside
`100vh`, because `vh` includes the strip behind the mobile browser's own bars
and made screens end below the fold, and `main#view` carries a bottom padding
of `env(safe-area-inset-bottom)` plus some, so the last button clears the phone's
home indicator.

## Navigation inside a feature, `presence-counter/ui/index.js`

The wizard is a small in memory state machine: `goList`, `goSetup`, `goCapture`,
`goLabel`, `goTrain`, `goLive`. Each function tears down the previous screen,
renders the next one, and passes it an `onBack` target.

### Why the steps are not in the URL

The router remounts the whole feature on any hash change, which would wipe an in
progress capture or labeling session. So wizard steps deliberately do not appear
in the hash.

That left the entire wizard as a single history entry, so the Android back
gesture jumped straight out of the feature to the home screen no matter how deep
the user was. The fix is manual history management:

- each forward step calls `pushState` with the same URL, purely to add stack
  depth,
- a `popstate` listener replays the same `onBack` target the current screen
  already wires to the in-app back button,
- a screen with no back target (training in progress) re-pushes the entry that
  was just popped, so the visible screen and the history position stay in sync.

The system back gesture and the in-app arrow therefore always do the same thing.

### The transition guard

`goTrain` and `goLive` import their screen module dynamically, which leaves a
real async gap during which the triggering button is still on screen and still
clickable. Two things cover that gap:

- a spinner, so the tap does not look ignored,
- a `transitioning` flag, which is not cosmetic. A second tap on "continue to
  training" used to run `goTrain` twice, and since each run creates and saves its
  own profile id, one labeling pass produced two profiles in the list.

## CSS conventions, `style.css`

One stylesheet, design tokens as custom properties at the top, dark theme only.

::: warning The `[hidden]` pitfall
An element with the `hidden` attribute still renders if any authored rule sets
`display` on the same class. A single class selector ties with the user agent's
`[hidden] { display: none }` rule, and source order decides, so the authored rule
wins.

This was hit three separate times, on `.back-link`, `.crop-preview` and
`.lang-switch`. Every such class now carries an explicit override:

```css
.crop-preview[hidden] {
  display: none;
}
```

Any new class that sets `display` and is toggled with `hidden` needs the same
line.
:::

::: warning Scaling a full width block
A `transform: scale()` does not reflow anything, but it does overflow. A block
level element in a flex column stretches to the full container width by default,
so scaling it up pushes its edges past the viewport on both sides. That is what
the live counter's flash did: a horizontal scrollbar on Android, and on iOS a
reflow that shifted the button underneath it.

The fix is to let the element hug its content, `align-self: center` here, so the
growth is a share of the text width rather than of the screen width. `#app` also
carries `overflow-x: clip` as a backstop, clip rather than hidden so the sticky
header and the fixed scroll hint keep working.
:::
