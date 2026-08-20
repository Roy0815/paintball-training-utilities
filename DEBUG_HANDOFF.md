# Presence-Counter Live-Detection Bug — RESOLVED

Root cause: the test phone's **GPU driver computes wrong numbers**. Not a bug in
this codebase. Fixed by verifying the backend's arithmetic at startup and
falling back to WASM when it fails.

Kept as a record because the failure mode is worth recognising again: a backend
that initializes cleanly, reports every capability flag as healthy, and then
returns garbage without ever raising an error.

## Symptom

Live detection worked on a PC (laptop webcam) but was stuck at exactly one class
= 100%, the other = 0% on a Samsung phone (One UI, Exynos, **Xclipse 940** GPU,
ANGLE on Vulkan 1.3.279) — regardless of camera content, on both cameras, never
noisy, always a hard split.

## Root cause

MobileNet embeddings computed on the phone's WebGL backend were numerically
corrupt. Once the arithmetic was checked against known answers, the phone's
WebGL backend failed on the most basic operation there is:

```
webgl: elementwise 0.9899886   <- tf.mul(x, scalar(1)) off by ~0.99
       normalize   0.0832      <- ||v / ||v|| || != 1
       matMul      0.6246
wasm:  elementwise 0           normalize 4.3e-7    matMul 9.6e-7
```

Every capability flag looked fine on that device: `float32Capable: true`,
`downloadFloatEnabled: true`, `forceF16Textures: false`, WebGL 2. The fault was
invisible to feature detection — only to actually checking results.

Downstream, corrupt embeddings produced a stuck prediction rather than random
noise: `intra-class person 0.658` was *lower* than `inter-class 0.775`, i.e. the
feature space was scrambled, while `empty` still held together at 0.952 because
blank-wall photos are near-identical images. So every query collapsed into the
empty cluster.

### Signals that identified it

- **`row L2 != 1.0`** — `knn-classifier`'s `addExample()` unit-length normalizes
  every stored row, so anything but 1.0 is proof of broken arithmetic, whatever
  produced the vector. Phone: 0.381 to 1.409. PC: exactly 1.
- **Cosine similarity of 1.676** — impossible between unit vectors.
- **Values repeating at lag 4** in the embedding (`a b c d a b …`) — one RGBA
  texel's worth. Survived disabling packed textures, so not a packing bug.
- **`zeros: 1` of 1280** — MobileNet's penultimate layer is post-ReLU and is
  normally ~10-15% zeros (PC: 139, WASM: 641). The sparsity was gone.

## The fix

`src/shared/ml-utils.js` — `selectBackend()` tries `webgl → wasm → cpu` and
keeps the first that proves it computes correctly; the last candidate is
accepted unconditionally so there is always an engine. Verification is two
staged checks in `src/shared/ml-diagnostics.js`:

- `testBackendArithmetic()` — elementwise op, reduction + division, matMul
  against known answers. The normalize check (a unit-length vector must measure
  1.0) is the general form of the invariant that failed here.
- `testModelOutput()` — small regular tensors can pass on a driver that still
  breaks on a deep convolution stack, so the loaded model is checked too: a real
  embedding, tested for NaN, unit length, sparsity, and lag-4 duplicates.

A deliberately device-agnostic approach: a driver allowlist would go stale and
would not catch the next broken device.

`profile.engine` records `{backend, engineMode, verified}` at training time.
Embeddings are only comparable to others from a correct engine, so the live
screen warns when a profile was trained on an unverified or different backend.

`@tensorflow/tfjs-backend-wasm` is a dependency; its `.wasm` binaries resolve
through Vite (`?url`, hashed) and are in the PWA precache
(`globPatterns` in `vite.config.js`), since on affected devices they *are* the
inference engine.

## Debug tooling (keep, don't rebuild)

- **🔬 Diagnose** on the live screen (`live-counter.js` `runDiagnostic()`):
  raw embedding stats, the same frame embedded three ways (canvas element,
  ImageData, video element) with cross-checks, the stored training set's own
  health (row L2, intra/inter-class similarity), and the full per-example
  similarity spread. This is what found the bug — `predictClass()` collapses
  everything into a k-of-n vote and hides all of it.
- **⚙️ Engine** button cycles `auto/webgl/nopack/wasm/cpu`. Forced modes skip
  verification on purpose, for A/B testing on a specific device.
- **📋 Debug-Log kopieren** copies both panels (the phone had no working USB
  remote debugging, so everything is on-screen).
- `profile.trainingDiagnostics` — per-photo record (rasterized pixel mean,
  embedding L2/mean/NaN) written at training time, because the labeled photos
  are discarded afterwards and are otherwise not inspectable.
- `getBackendInfo()` — backend, engine mode, full selection report, unmasked GPU
  renderer, and the WebGL capability flags.
- Debug panel's `inference:` line — per-tick time plus a rolling 20-tick
  avg/max (`live-counter.js`), against the configured target interval. Cold
  start is excluded from the average on purpose (JIT/WASM warmup on the first
  few ticks would otherwise permanently skew it away from steady-state speed).

## Ruled out along the way (all verified, none were the cause)

ROI/resolution mismatch between setup and capture sessions · class-count
imbalance biasing the KNN vote · `k=3` making the confidence threshold
unreachable · inverted label buttons · MobileNet's internal resize · portrait
aspect-ratio distortion · WebGL float precision flags · front-camera
post-processing · `knn-classifier` internal indexing · vector normalization ·
training-loop closure bugs · canvas-to-texture upload (`canvas vs imageData` was
1.0000 on both devices) · packed WebGL textures.

Several of these were real bugs and the fixes are worth keeping (stream handoff
in `setup.js`/`capture.js`, `balanceClasses()` in `training.js`, `k=5` +
threshold 0.6, center-square-crop in `captureFrameCanvas()`).

## Environment

- Dev machine: Windows PC running WSL2 (Ubuntu). WSL2's NAT network means the
  phone cannot reach the dev server via LAN IP.
- `npm run dev:phone` starts Vite + a `cloudflared` quick tunnel and prints a QR
  code (`scripts/tunnel-qr.mjs`). Tunnel URL changes every run.
- `cloudflared` lives at `~/.local/bin/cloudflared` (manual install, on PATH).
- Expected backends: PC `webgl`, test phone `wasm` (auto-selected).

## Open follow-ups

- Test training **without** `balanceClasses()` now that live detection works —
  it fixed a real but different symptom (class-count bias) and has never been
  shown to matter for a correctly-computed feature space.
- WASM inference on the test phone measured avg 85ms / max 118ms per tick
  (debug panel's `inference:` line). `intervalMs` is a pause *after* each
  tick, not a period, so the real rate was `1000 / (inferenceMs + intervalMs)`
  - at the old `intervalMs=100` default (sized for near-instant WebGL
  inference) that was ~5.4 Hz, not the assumed 10 Hz, costing ~370ms of
  confirm latency (`confirmFrames=2`) on top. Dropped the default to 10ms
  (`live-counter.js`) since inference itself now paces the loop; re-measure
  on the phone to confirm the new avg/max, and if a real snap-out is still
  getting missed, lower MobileNet's `alpha` next.
- A/B test the center-square-crop in `captureFrameCanvas()` (`capture.js`)
  against real accuracy, not just against the stuck-prediction bug. It was
  added mid-debugging for a sound, independent reason (MobileNet stretches
  non-square input without cropping, and expects roughly-square images) and
  never caused the phone bug - toggling it made no difference while the
  backend's arithmetic was still broken. But it also throws away real pixels
  above/below center on a portrait frame, e.g. cutting off a head or weapon
  that isn't vertically centered when snapping out. That tradeoff was never
  cleanly measured, since every result during debugging was corrupted by the
  backend bug anyway. Worth a real comparison now that results are trustworthy.
