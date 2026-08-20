# Overview

Paintball Training Utilities is a collection of training tools that run in the
browser on your phone. It opens on a screen with one tile per tool. Pick a tile
to start.

Right now there is one tool, [Snaptraining Dryrun](./snaptraining-dryrun), which
counts snap out reps through the camera.

## Everything stays on the device

There is no account, no server and no upload. The camera stream is processed in
the browser, the training photos are deleted once a model is trained, and the
trained model plus your counters are stored in the browser's own storage on that
one device.

Two consequences worth knowing:

- Clearing your browser data for this site deletes your snapshot positions.
- A snapshot position trained on your phone does not appear on another device.

## Installing it as an app

Open the app in your phone's browser and use "Add to home screen" (Chrome) or
"Add to Home Screen" from the share menu (Safari). It then starts like a normal
app, full screen and without a browser bar.

The first time you train or run live detection, the app downloads the image
recognition model, which is about 5 MB and needs an internet connection. After
that it is cached and everything works offline, which matters because training
usually happens somewhere without reliable signal.

## Camera access

The camera only starts when you press "Start camera" and stops when you leave
the screen. Your browser will ask for permission the first time. If you decline
it, you have to re-allow it in the browser's site settings, since the app cannot
ask again.

## Language

The header has a DE / EN switch that changes the whole app immediately. The
choice is remembered on that device. On first start the app follows your
browser's language and falls back to German.
