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
