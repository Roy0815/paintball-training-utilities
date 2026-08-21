# Snaptraining Dryrun internals

Directory `src/features/presence-counter/`. The id predates the current display
name and is kept so existing stored profiles stay readable.

| Module | Responsibility |
| --- | --- |
| `storage.js` | Profile CRUD, capture defaults, counter updates |
| `capture.js` | Camera, center square cropping, timed capture series |
| `labeling.js` | Label constants, counting, validation |
| `training.js` | Embeddings, class balancing, KNN training |
| `live-counter.js` | Detection loop, debouncing, diagnostics |
| `ui/index.js` | Wizard state machine and history handling |
| `ui/screens/*.js` | One render function per screen |

## The profile

A snapshot position is one object in `presence-counter:profiles`:

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
                                        count on a flip to present
```

One rep is one cover to snap transition. Holding a snap counts once, and the next
rep needs a confirmed cover in between, so nothing double counts.

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

### Preview decoupling

The live screen redraws its crop preview on its own `requestAnimationFrame`
loop, not on classification ticks. Tied to inference it looked like a choppy 8 to
10 fps preview on an unaccelerated backend.

## Screens

| Screen | File | Notes |
| --- | --- | --- |
| Profile list | `screens/profileList.js` | Card click starts live mode, buttons excluded via `closest('button')` |
| Setup | `screens/setup.js` | Name, camera choice, the per class minimum, no camera |
| Capture | `screens/capture.js` | Opens the camera, series settings, crop preview, thumbnails, debug panel |
| Label | `screens/label.js` | Swipe cards with pointer events, ignore, previous |
| Train | `screens/train.js` | Progress, saves the profile, no back target |
| Live | `screens/live.js` | Counter, status line, engine warning, debug tooling |

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
