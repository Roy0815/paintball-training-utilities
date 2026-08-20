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
- real post ReLU sparsity, since the penultimate layer is normally 10 to 15%
  zeros and the broken device produced 1 zero out of 1280,
- no values repeating at a lag of 4, which is one RGBA texel and the fingerprint
  of a texture addressing bug.

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

## Further reading

`DEBUG_HANDOFF.md` in the repository root is the full investigation record: the
symptoms, the signals that identified the cause, everything that was ruled out
along the way, and the follow-ups that are still open. This page describes the
system as it stands, that file describes how it got here.
