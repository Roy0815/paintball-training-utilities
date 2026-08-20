# ML backend and verification

`shared/ml-utils.js` loads MobileNet and picks a TensorFlow.js backend.
`shared/ml-diagnostics.js` holds the checks that decide whether a backend is
trustworthy, plus the inspection tooling.

## Why this exists

Live detection worked on a laptop and was stuck at exactly one class = 100%, the
other = 0% on a Samsung phone (Exynos, Xclipse 940, ANGLE on Vulkan), regardless
of what the camera saw, on both cameras, never noisy.

The cause was not in this codebase. **The phone's GPU driver computed wrong
numbers.** Once the arithmetic was checked against known answers, the WebGL
backend failed on the most basic operation there is:

```
webgl: elementwise 0.9899886   <- tf.mul(x, scalar(1)) off by ~0.99
       normalize   0.0832      <- a unit length vector did not measure 1
       matMul      0.6246
wasm:  elementwise 0           normalize 4.3e-7    matMul 9.6e-7
```

Every capability flag on that device looked healthy: `float32Capable: true`,
`downloadFloatEnabled: true`, `forceF16Textures: false`, WebGL 2. No error was
raised anywhere.

::: danger The lesson
A backend can initialize cleanly, report every capability flag as supported, and
then return garbage without ever failing. Feature detection cannot see this.
Only checking results against known answers can.
:::

Downstream, corrupt embeddings produced a stuck prediction rather than noise. The
intra class similarity for `person` was 0.658, **lower** than the inter class
similarity of 0.775, so the feature space was scrambled, while `empty` still held
together at 0.952 because blank wall photos are nearly identical images. Every
query therefore collapsed into the `empty` cluster.

### The signals that identified it

Four observations, in the order they narrowed it down. Each one is an invariant
rather than a symptom, which is what makes them reusable on the next device
that behaves this way.

- **`row L2` was not 1.0.** `addExample()` unit length normalizes every stored
  row, so any other row norm proves broken arithmetic whatever produced the
  vector. The phone measured 0.381 to 1.409, the laptop exactly 1.
- **A cosine similarity of 1.676.** Impossible between unit vectors.
- **Values repeating at a lag of 4**, one RGBA texel's worth. This survived
  disabling packed textures, so it was not a packing bug.
- **`zeros: 1` out of 1280.** MobileNet's penultimate layer is post ReLU and is
  normally 10 to 15% zeros. The laptop produced 139 and WASM 641, the phone's
  WebGL backend produced 1. The sparsity structure was simply gone.

## Backend selection

```js
const AUTO_CANDIDATES = ['webgl', 'wasm', 'cpu'];
```

`selectBackend()` walks the candidates fastest first and keeps the first that
proves it computes correctly. The last candidate is accepted unconditionally, so
there is always an engine to run on.

This is deliberately device agnostic. A driver allowlist would go stale and would
never catch the next broken device.

### Engine modes

`ENGINE_MODES` also allows forcing a backend, cycled with the ⚙️ button on the
live screen and persisted in `localStorage`:

| Mode | Meaning |
| --- | --- |
| `auto` | Verify and pick. The default and what users get. |
| `webgl` | GPU, tf.js defaults. |
| `nopack` | GPU with all `WEBGL_PACK_*` flags off, one value per texel. |
| `wasm` | SIMD accelerated CPU, no GPU driver involved. |
| `cpu` | Plain JS. Slowest and the most trustworthy of all. |

Forced modes **skip verification on purpose**, so they can produce wrong results.
They exist for A/B testing on a specific device.

## The two checks

### `testBackendArithmetic()`

Runs on the raw backend before the model is loaded, on a 1280 value vector, the
same width as a MobileNet embedding:

| Check | What it mirrors |
| --- | --- |
| elementwise | `tf.mul(x, scalar(1))` must return `x` |
| normalize | a reduction feeding a division, which is what unit length normalization is |
| matMul | the KNN's entire similarity search |

The normalize check is the general form of the invariant that broke here. A
normalized vector whose length is not 1.0 proves broken arithmetic no matter what
produced it. Tolerance is `1e-3`.

### `testModelOutput()`

Small regular tensors can pass on a driver that still breaks on a deep
convolution stack, so the loaded model is checked too. A synthetic image is
embedded and the result is asserted against what any MobileNet embedding must
satisfy regardless of content:

- no NaN,
- unit length after normalization,
- no values repeating at a lag of 4, which is one RGBA texel and the fingerprint
  of a texture addressing bug.

The zero count is reported next to those but deliberately not asserted. The
penultimate layer sits behind a ReLU, so a healthy embedding is sparse, but how
sparse depends on the backend: the same synthetic image gives 139 zeros on the
laptop's WebGL and 641 on WASM. No single threshold fits both, while the broken
device gave itself away with 1 zero out of 1280. It stays a signal for whoever
reads the report rather than a gate.

If the model check fails, the backend is dropped and the next candidate gets a
freshly loaded model.

## The engine signature

```js
{ backend: 'wasm', engineMode: 'auto', verified: true }
```

Stored with every trained profile. Embeddings are only comparable to others from
an engine that computes correctly, so a profile trained on an unverified or
different backend holds a feature space the current session cannot match against,
however healthy it looks.

The live screen compares the stored signature against the running backend and
shows a retrain warning on any mismatch. It is not a soft warning: the stored
model is genuinely worthless in that state.

## WASM binaries

`@tensorflow/tfjs-backend-wasm` is a real dependency, not an optional extra. On
affected devices it **is** the inference engine.

The backend is imported dynamically, so devices that never need it do not
download it. Its `.wasm` binaries are resolved through Vite with `?url` so they
get hashed and served like any other asset, and `wasm` is in the service worker's
`globPatterns` so offline inference works on exactly the devices that depend on
it.

## Reading a diagnostic report

The **🔬 Diagnose** button on the live screen captures one frame and reports
everything behind a single prediction. `predictClass()` collapses all of it into
a k-of-n vote, which hides the two failure modes that look identical from
outside: a degenerate embedding, and a healthy embedding of the wrong pixels.

What to look at, in order:

| Line | Healthy value | What a bad value means |
| --- | --- | --- |
| `row L2 (must be 1.0)` | exactly 1.0 | `addExample()` unit normalizes every stored row, so anything else is proof of broken arithmetic at training time |
| `canvas vs imageData` | ~1.0 | the same pixels through two upload paths, so a lower value means the canvas to texture upload is not seeing what was drawn |
| `intra-class sim` vs `inter-class sim` | intra clearly higher | intra below inter means the feature space is scrambled |
| `distinct values` | close to the total | few distinct similarities means everything is tying, which produces a hard content independent 100%/0% |
| `zeros` in an embedding | roughly 10 to 15% of 1280 | near zero sparsity means the ReLU structure is gone |
| `nan` | 0 | anything else is a dead computation |
| head values repeating every 4th | no repeats | a texture addressing bug |

Cosine similarity above 1.0 between unit vectors is impossible and is itself
proof of broken arithmetic.

**📋 Debug-Log kopieren** copies the panels to the clipboard, which exists
because the test phone had no working USB remote debugging and everything had to
be readable on screen.

## Ruled out along the way

All of the following was investigated and verified not to be the cause. It is
listed so the same ground does not get covered twice:

ROI or resolution mismatch between the setup and capture sessions, class count
imbalance biasing the KNN vote, `k = 3` making the confidence threshold
unreachable, inverted label buttons, MobileNet's internal resize, portrait
aspect ratio distortion, WebGL float precision flags, front camera post
processing, `knn-classifier`'s internal indexing, vector normalization,
training loop closure bugs, canvas to texture upload (`canvas vs imageData`
measured 1.0000 on both devices) and packed WebGL textures.

Several of those turned out to be real bugs even though none of them was this
one, and their fixes were kept: the
[stream handoff](./snaptraining-dryrun#stream-handoff),
[class balancing](./snaptraining-dryrun#class-balancing),
[k = 5 with a 0.6 threshold](./snaptraining-dryrun#k-and-the-threshold) and the
[center square crop](./snaptraining-dryrun#camera-and-cropping-capture-js).

## Expected outcome per device

Worth knowing before treating a backend choice as a fault: a desktop or laptop
with a normal GPU selects `webgl`. The Samsung test phone selects `wasm`, and
that is the correct outcome rather than a degraded one.
