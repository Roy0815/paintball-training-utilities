# Snaptraining Dryrun internals

Directory `src/features/snaptraining-dryrun/`. The id predates the current display
name and is kept so existing stored profiles stay readable.

| Module | Responsibility |
| --- | --- |
| `storage.js` | Profile CRUD, capture defaults, counter and peek duration updates |
| `capture.js` | Camera, center square cropping, timed capture series |
| `labeling.js` | Label constants, counting, validation |
| `training.js` | Embeddings, class balancing, KNN training |
| `live-counter.js` | Detection loop, debouncing, diagnostics |
| `settings.js` | Camera and number sound flags |
| `ui/index.js` | Wizard state machine and history handling |
| `ui/screens/*.js` | One render function per screen |

## The profile

A snapshot position is one object in `snaptraining-dryrun:profiles`:

```js
{
  id,                    // crypto.randomUUID()
  name,
  facingMode,            // 'user' or 'environment'
  captureCount,
  captureIntervalMs,
  classifierDataset,     // serialized KNN dataset, null until trained
  trainingDiagnostics,   // per photo record from training time
  engine,                // { backend, engineMode, verified }
  previewImage,          // one training photo as the list thumbnail
  counter,
  history,               // timestamps of counted reps
  peekDurations,         // ms durations of completed peeks
  createdAt,
  trainedAt,
}
```

## Camera and cropping, `capture.js`

`startCamera()` asks for a fixed ideal resolution of 1280x720:

```js
video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }
```

Capture and live mode are separate `getUserMedia` sessions, and phone cameras
readily negotiate a different resolution per session. Frames are cropped to a
square from the middle, so a different source aspect ratio means that square
covers a different field of view, and the training photos and the live frames
would no longer show the same thing.

`getCropRect()` returns that **center square crop**. MobileNet stretches whatever
it receives to 224x224 without cropping and was trained on roughly square images,
so a 9:16 portrait frame distorts far enough to shift embeddings. A 4:3 webcam
frame is a mild stretch, a portrait phone frame is twice as extreme in the other
direction.

::: warning Open question
The center square crop was added for that reason and is sound, but it does throw
away real pixels above and below center, which on a portrait frame can cut off a
head or a weapon that is not vertically centered. It has never been measured
against real accuracy, because every result during the period it was added was
corrupted by the backend bug described in
[ML backend and verification](./ml-backend). Worth an A/B test now that results
are trustworthy.
:::

Three entry points share that rect:

- `captureFrameCanvas()` allocates a canvas per call, used for single captures
  and for each live tick.
- `captureFrameDataUrl()` wraps it into a JPEG data URL for storage.
- `drawCroppedFrame()` draws into a canvas the caller owns, for the continuously
  updating preview, where allocating per frame would be wasteful.

`captureSeries()` resolves with the captured data URLs and is cancellable at any
point, including during the countdown. The countdown exists because the person
in the photos is usually the person holding the phone.

### Where the camera opens

Only on the capture and live screens. Setup used to open one too, for aiming and
for the region selector that no longer exists, and handed its stream on so the
selection and the photos came from the same feed. With both gone, setup is a
plain form and the capture screen opens the camera itself.

It tries as soon as it mounts, since arriving there is the result of a tap and
that activation normally still counts. A start button appears only if that
throws, on a denied permission or a browser that insists on its own gesture, and
disappears again once a stream is running. The capture button stays disabled
until then, so a series can never be recorded against a dead video element.

### Training sounds

The capture screen, `ui/screens/capture.js`, plays two more clips through
`shared/audio.js`: `playCameraCapture()` for a shutter sound on every photo,
and `playNumber()` again for the countdown before a series starts, every five
seconds down to five remaining, then every second from five to one. Both check
`snaptraining-dryrun/settings.js` before playing and default to on.

`unlockAudio()` gets its own call here, on the capture button's own click,
because the existing call lived only on the profile list's tap into live mode.
Without it, the first clip this screen ever plays, whichever one fires first
depending on whether a start delay is set, would be the one iOS blocks.

## Labeling, `labeling.js`

Two classes: `LABELS.PERSON` for snap, `LABELS.EMPTY` for cover. The internal
names are historical, the display strings come from i18n.

Ignored photos keep `label: null`, so the training filter drops them without a
second flag. `validateLabels()` enforces `MIN_EXAMPLES_PER_CLASS` (6, matched to the k of the
live vote so a class can supply every neighbour) per class
and returns what is still missing, which the summary screen shows directly.

## Training, `training.js`

For each labeled photo: decode it, run MobileNet up to the penultimate layer for
a 1280 value embedding, and add it to the KNN classifier. The classifier dataset
is then serialized into typed arrays plus shapes, because tensors cannot go into
IndexedDB but typed arrays survive structured clone.

### Why classes are not balanced

Training used to cap both classes to the size of the smaller one. The KNN picks
its k nearest neighbours from all examples pooled together and votes by raw
count, so a class with more examples can win on density alone even when its
examples are not particularly similar to the query.

That capping is gone. It threw away labeled photos, sometimes most of them, and
the capture guidance now asks for a minimum per class rather than an even split,
which makes an imbalance intentional: one set of cover photos can stand against
several different snap positions.

::: warning Untested
The bias balancing fixed was real, but it was only ever observed while the
backend was computing wrong numbers, so whether a lopsided training set skews
the vote on a correct feature space has never been measured. The `intra-class
sim` and `inter-class sim` lines in the diagnostic report are where it would
show up.
:::

### Why diagnostics are recorded at training time

The labeled photos are discarded once training finishes. Without a record, a
classifier trained from blank or undecoded images is indistinguishable at live
time from a correct one, and the source images are gone.

So each photo contributes an entry with its pixel statistics and its embedding
statistics (L2 norm, mean, NaN count). `formatTrainingDiagnostics()` renders it
inside the live screen's diagnostic report.

`getEngineSignature()` is stored alongside, because embeddings are only
comparable to others computed by the same, verified engine.

## Live detection, `live-counter.js`

`startLiveDetection(videoEl, options)` returns `{ stop, runDiagnostic }`.

### Counting logic

A raw prediction per frame, then a debounce:

```
isPersonFrame = label === 'person' && confidence >= 0.6

if isPersonFrame === confirmedPresent   reset the pending streak
else                                    grow the streak
  streak >= confirmFrames (2)           flip confirmedPresent
                                        confirmedPresent true:  note the start time
                                        confirmedPresent false: count, report the peek duration
```

One rep is one full cover-snap-cover cycle, counted on the return to cover
rather than the moment of leaving it: only then is the peek actually over, and
only then is its duration known. Holding a snap counts once regardless of how
long it lasts, and the next rep needs a confirmed cover in between, so nothing
double counts. See [peek duration](#peek-duration) below for what "count" and
"report" mean concretely.

### Peek duration

`peekStartTime` is set to `Date.now()` the moment `confirmedPresent` flips to
`true`, and read back the moment it flips to `false` again, so `onDetect()`
and `onPeekComplete(durationMs)` fire together, in that order, with the
elapsed time between the two. Both live in the same branch of the debounce, so
a peek still open when `stop()` is called never fires either one: the falling
edge needs a later tick that will never run, since `stop()` sets
`stopped = true` and clears the pending `setTimeout`. That is deliberate, not
an edge case worth guarding separately. It is what keeps a snap-out
interrupted by pressing "Training stoppen" mid-peek, most commonly the walk
back into frame to reach the phone, from being counted as a rep or recorded as
an unusually slow peek at all.

`storage.js` persists completed durations on the profile as `peekDurations: []`,
appended by `recordPeekDuration()` on every `onPeekComplete`, mirroring
`recordDetection()`'s counter update as an independent write. A profile saved
before this field existed loads with `peekDurations === undefined`, so
`recordPeekDuration()` and `removeLastPeekDuration()` both self heal with
`profile.peekDurations ??= []` rather than depending on a migration step.
`resetCounter()` clears `peekDurations` alongside `counter` and `history`, so
the two can never disagree about whether a session has started.
`removeLastPeekDuration()` pops the most recent entry, for the live screen's
manual "Remove last value" control, and is unrelated to the automatic
exclusion above: that one is for a peek that never completed, this one is for
a completed peek the person judges was not representative anyway.

### k and the threshold

The confidence attached to a prediction is not a probability. `predictClass()`
takes the cosine similarity of the frame against every stored example, sorts
them, keeps the k highest and returns `votes for the class / k`. Only multiples
of 1/k are reachable, so k and the threshold have to be chosen together.

`k = 6` is passed explicitly because `knn-classifier` defaults to 3, where the
only steps are 0, 1/3, 2/3 and 1 and a 0.75 threshold silently demands a
unanimous vote. With sixths there is no step at 0.6 either, so the 0.6 threshold
effectively asks for **4 of 6, or 66.7%**.

An even k can tie 3 to 3. `calculateTopClass()` keeps the first class it sees
with a strictly higher share, so a tie resolves to whichever class was
concatenated first, which is arbitrary. It does not matter here: a tie is 0.5
and falls below the threshold whichever way it lands.

### Loop timing

`intervalMs` is a pause **after** each tick, not a period. The real frame rate is
`1000 / (inferenceMs + intervalMs)`.

That distinction mattered in practice. With the old default of 100ms, WASM
inference on the test phone measured about 85ms average and 118ms peak, so the
loop ran at roughly 5 Hz rather than the assumed 10 Hz and cost about 370ms of
confirm latency on top. The default is now 10ms, since inference itself paces
the loop.

Measured again on the same phone afterwards, on a 720x720 crop: 45ms average and
54ms peak, so about 18 Hz and roughly 110ms of confirm latency at
`confirmFrames = 2`. Inference itself also halved, which was not isolated: the
per tick console log was removed in the same period and is the likely candidate.

If a snap out is still missed at that rate, the next lever is MobileNet's
`alpha`, which shrinks the network rather than the loop.

Tick timing is reported as a rolling 20 tick average, deliberately not an all
time one: JIT and WASM warmup make the first few ticks much slower and would
permanently skew the number away from the steady state speed, which is what
actually decides whether reps get missed.

### Spoken callouts

Every tenth confirmed rep up to 100 is announced through `shared/audio.js`,
gated by the same number sound flag as the capture screen's countdown (see
[training sounds](#training-sounds)), in `snaptraining-dryrun/settings.js`.

iOS only plays audio that a user gesture started, and grants that per element
rather than per page, so all clips share one `Audio` whose `src` is swapped
instead of one element per number. `unlockAudio()` primes that element from
inside the tap on the profile card, because by the time the live screen has
imported its module and opened the camera the gesture no longer counts. Android
never needs it and is unaffected.

What it primes with is 50ms of inlined PCM silence, not a real clip turned
down. iOS ignores `muted` on an audio element the same way it makes `volume`
read only, so the first attempt at this announced "one" at full volume on an
iPhone. Silence has to come from the content.

### Preview decoupling

The live screen redraws its crop preview on its own `requestAnimationFrame`
loop, not on classification ticks. Tied to inference it looked like a choppy 8 to
10 fps preview on an unaccelerated backend.

## Live screen states, `ui/screens/live.js`

The screen used to start the camera and detection together, unconditionally,
on mount. It now separates the two: the camera still starts immediately, so
the phone can be positioned, but `startLiveDetection()` is not called until
the person presses **Training starten** and a configurable start timer
(seconds in the UI, converted to ms, default `DEFAULT_LIVE_START_DELAY_MS`)
has counted down. That gives them time to get back into position, the same
problem the capture screen's own start delay solves for the person being
photographed, though the two delays are kept as separate constants since they
serve unrelated screens and have no reason to change together.

Three states, tracked as which of `#idle-controls` (the delay input plus
**Training starten**) and `#stop-training-btn` is visible, never both at once:

- **idle** — camera running, nothing counted yet, `#idle-controls` visible.
- **counting down** — `#idle-controls` hidden, `#stop-training-btn` already
  visible so the countdown itself can be aborted, status line shows the
  countdown text.
- **running** — `startLiveDetection()` active, status line shows the live
  snap/cover percentages.

Stopping, whether during the countdown or while running, clears the countdown
`setInterval` if one is pending, calls `detection.stop()` if a classifier is
loaded, and returns to idle without touching the camera stream or the crop
preview loop, both of which run for the entire lifetime of the screen. Calling
`startLiveDetection()` again on a later start is safe and cheap: MobileNet is
memoized at module scope in `ml-utils.js`, so it is not reloaded, and `stop()`
disposes the previous classifier's tensors before a new one is created.

::: warning `[hidden]` on an element with its own `display`
`#idle-controls` needs `display: flex` to lay out the delay field above the
start button, and an authored `display` on the same class beats the browser's
`[hidden] { display: none }` rule on the specificity tie, the same pitfall
already documented for `.back-link` and others, see
[CSS conventions](./app-shell#css-conventions-style-css). Without the
override the element stayed visible and clickable after being hidden, which
is what let "Training starten" fire more than once per session. The fix is
the same one used everywhere else: an explicit
`.idle-controls[hidden] { display: none; }` rule.
:::

## Screens

| Screen | File | Notes |
| --- | --- | --- |
| Profile list | `screens/profileList.js` | Card click starts live mode, buttons excluded via `closest('button')` |
| Setup | `screens/setup.js` | Name, camera choice, the per class minimum, no camera |
| Capture | `screens/capture.js` | Opens the camera, series settings, crop preview, thumbnails, debug panel |
| Label | `screens/label.js` | Swipe cards with pointer events, ignore, previous |
| Train | `screens/train.js` | Progress, saves the profile, no back target |
| Live | `screens/live.js` | Counter, peek stats, delayed start with a cancellable countdown, engine warning, debug tooling |
| Settings | `screens/settings.js` | Camera and number sound switches, reached from the app's settings screen |

::: warning The profile card click target
The card uses a plain click listener on an in flow element, not an absolutely
positioned overlay hitzone. Several attempts at such an overlay broke differently
on Android and iOS.

The bug that survived all of them was not CSS at all. The exclusion check for the
action buttons matched `.profile-card-actions`, the wrapper div, whose box is
wider than the visible buttons on a narrow screen. Taps in that margin were
swallowed and looked exactly like a dead zone. Checking `closest('button')` fixed
it.

It was found by putting a touch event logger on the screen, after three plausible
CSS fixes had failed in different ways on the two platforms. For a real device UI
bug that resists several rounds of guessing, build the on device logger before
trying another blind fix.
:::
