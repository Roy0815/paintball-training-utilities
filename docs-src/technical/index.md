# Architecture

A Vite built PWA with no framework and no backend. Everything runs client side,
including model training and inference, and it is served as static files from
GitHub Pages.

## Principles

**No backend.** There is nothing to authenticate against, nothing to pay for and
no privacy question about camera footage, because frames never leave the device.
It also means every constraint is a browser constraint: storage is IndexedDB,
compute is whatever the phone has, and offline support is a service worker.

**Vanilla JS.** Screens render through template strings into `innerHTML`. There
is no reactivity layer, so a language change re-renders the current screen
instead of updating bound values. The app is small enough that a framework would
mostly add bundle size next to TensorFlow.js, which dominates it anyway.

**Features are self-contained.** Each tool lives under `src/features/<name>/`
with its own entry point, screens and storage. The app shell knows only what the
registry tells it.

**Correctness is verified, not assumed.** The ML layer proves that the device
computes correct numbers before trusting any inference result. See
[ML backend and verification](./ml-backend) for why that is not paranoia.

## Layers

```
main.js
  └── app/shell.js        persistent header, single back button, title
      └── app/router.js   hash routing, screen cleanup, language re-render
          └── features/index.js      registry, dynamic imports
              └── features/presence-counter/ui/index.js
                    wizard state machine, history handling
                    └── ui/screens/*.js    one render function per screen
                          └── feature modules: capture, labeling,
                              training, live-counter, storage
                                └── shared: ml-utils, ml-diagnostics,
                                    db, i18n, audio
```

Dependencies point downwards only. A screen may use shared modules, but nothing
shared knows about a feature.

## Runtime flow

1. `main.js` renders the shell and starts the router.
2. The router parses the hash. `#/` renders the home screen from the registry,
   `#/feature/<id>` dynamically imports that feature and calls `mount()`.
3. `mount()` returns a cleanup function. The router awaits it before rendering
   anything else, which is what stops cameras and detection loops.
4. Inside a feature, screens are swapped by the feature itself, not by the
   router. The URL does not change during a wizard.

## Data flow of the ML pipeline

```
camera frame
  └── center square crop                     capture.js
      └── JPEG data URL                      one per captured photo
          └── label: snap / cover / ignore   labeling.js
              └── MobileNet embedding        1280 floats per photo
                  └── KNN classifier         training.js
                      └── serialized dataset stored in IndexedDB

live frame
  └── same crop
      └── MobileNet embedding
          └── KNN predictClass, k = 5
              └── debounce, then count on the cover to snap edge
```

No gradient training happens. MobileNet is used purely as a feature extractor,
and the classifier is a nearest neighbour lookup over stored embeddings. That is
what makes training on a phone take seconds.

## Where the interesting decisions live

| Topic | Page |
| --- | --- |
| Folder layout, build and deployment | [Project structure](./project-structure) |
| Router, header, i18n, navigation state | [App shell](./app-shell) |
| Camera, training and counting internals | [Snaptraining Dryrun internals](./snaptraining-dryrun) |
| Backend selection and its verification | [ML backend and verification](./ml-backend) |
| Dev loop, device testing, conventions | [Development workflow](./development) |
