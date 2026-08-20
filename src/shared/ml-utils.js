import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import { testBackendArithmetic, testModelOutput } from './ml-diagnostics.js';

let mobilenetPromise = null;

const ENGINE_MODE_KEY = 'ptu:engine-mode';

/**
 * Which TF.js backend runs the model.
 *
 * 'auto':   try each candidate in turn and keep the first that proves it
 *           computes correctly (see selectBackend). The default, and what
 *           real users get.
 * 'webgl':  GPU, tf.js defaults.
 * 'nopack': GPU, but one value per texel instead of four packed into an RGBA
 *           texel.
 * 'wasm':   SIMD accelerated CPU. No GPU driver involved, roughly an order of
 *           magnitude faster than the plain JS backend.
 * 'cpu':    plain JS. Slowest, and the most trustworthy fallback of all.
 *
 * The non-auto modes exist for A/B debugging on a specific device. They skip
 * verification entirely, so a forced mode can produce wrong results on purpose.
 */
export const ENGINE_MODES = ['auto', 'webgl', 'nopack', 'wasm', 'cpu'];

const AUTO_CANDIDATES = ['webgl', 'wasm', 'cpu'];

// All WEBGL_PACK_* flags default to whatever WEBGL_PACK is, but they cache
// that on first read, so they are set explicitly rather than relied upon.
const PACK_FLAGS = [
  'WEBGL_PACK',
  'WEBGL_PACK_NORMALIZATION',
  'WEBGL_PACK_CLIP',
  'WEBGL_PACK_DEPTHWISECONV',
  'WEBGL_PACK_BINARY_OPERATIONS',
  'WEBGL_PACK_UNARY_OPERATIONS',
  'WEBGL_PACK_ARRAY_OPERATIONS',
  'WEBGL_PACK_IMAGE_OPERATIONS',
  'WEBGL_PACK_REDUCE',
  'WEBGL_PACK_CONV2DTRANSPOSE',
  'WEBGL_LAZILY_UNPACK',
  'WEBGL_CONV_IM2COL',
];

let engineReport = { mode: getEngineMode(), attempts: [] };

export function getEngineMode() {
  try {
    const stored = localStorage.getItem(ENGINE_MODE_KEY);
    return ENGINE_MODES.includes(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

export function setEngineMode(mode) {
  try {
    if (mode && mode !== 'auto') localStorage.setItem(ENGINE_MODE_KEY, mode);
    else localStorage.removeItem(ENGINE_MODE_KEY);
  } catch {
    /* storage unavailable, the engine mode is a debug only override */
  }
}

/** What selectBackend() decided and why, surfaced in the debug panel. */
export function getEngineReport() {
  return engineReport;
}

/**
 * Identifies the engine a set of embeddings was produced with. Embeddings are
 * only comparable to others from an engine that computes correctly, so a
 * profile records this at training time: one trained on a backend that failed
 * verification is silently worthless and has to be retrained rather than
 * trusted. `verified` is false for forced modes, which skip the checks.
 */
export function getEngineSignature() {
  return {
    backend: tf.getBackend(),
    engineMode: getEngineMode(),
    verified: engineReport.modelCheck?.ok === true,
  };
}

async function activateBackend(name) {
  if (name === 'wasm') {
    // Dynamically imported so devices that never need it do not download the
    // backend at all. The .wasm binaries go through Vite, so they are hashed,
    // served and precached like any other asset.
    const [{ setWasmPaths }, plain, simd, threadedSimd] = await Promise.all([
      import('@tensorflow/tfjs-backend-wasm'),
      import('@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm?url'),
      import('@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm-simd.wasm?url'),
      import('@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm-threaded-simd.wasm?url'),
    ]);
    setWasmPaths({
      'tfjs-backend-wasm.wasm': plain.default,
      'tfjs-backend-wasm-simd.wasm': simd.default,
      'tfjs-backend-wasm-threaded-simd.wasm': threadedSimd.default,
    });
    return tf.setBackend('wasm');
  }
  if (name === 'nopack') {
    for (const flag of PACK_FLAGS) tf.env().set(flag, false);
    return tf.setBackend('webgl');
  }
  return tf.setBackend(name);
}

/**
 * Picks a backend that demonstrably works on this device.
 *
 * The naive approach, using WebGL whenever it is available, is what broke this
 * feature: a GPU driver that initializes fine, reports every capability as
 * supported and then returns arithmetically wrong values with no error. Since
 * a wrong embedding is indistinguishable from a wrong model downstream,
 * correctness is established up front on every device rather than assumed.
 * Candidates are ordered fastest first, and the last one is accepted
 * unconditionally so there is always an engine to run on.
 */
async function selectBackend(mode) {
  if (mode !== 'auto') {
    await activateBackend(mode);
    await tf.ready();
    engineReport = { mode, attempts: [{ backend: mode, forced: true }] };
    return;
  }

  const attempts = [];
  for (const candidate of AUTO_CANDIDATES) {
    const isLastCandidate = candidate === AUTO_CANDIDATES[AUTO_CANDIDATES.length - 1];
    try {
      if (!(await activateBackend(candidate))) throw new Error('backend unavailable');
      await tf.ready();
      const arithmetic = await testBackendArithmetic();
      attempts.push({ backend: candidate, ...arithmetic });
      if (arithmetic.ok || isLastCandidate) {
        engineReport = { mode, attempts };
        return;
      }
      console.warn(`[ml] backend "${candidate}" failed its arithmetic self-test:`, arithmetic);
    } catch (err) {
      attempts.push({ backend: candidate, ok: false, error: err.message });
      console.warn(`[ml] backend "${candidate}" unavailable:`, err);
    }
  }
  engineReport = { mode, attempts };
}

/**
 * Loads MobileNet once and reuses it across features and screens.
 *
 * In 'auto' mode the loaded model gets one more check that the raw arithmetic
 * test cannot cover: small regular tensors can come back correct on a driver
 * that still breaks on the deep convolution stack. If the model's own output
 * fails, the backend is dropped and the next candidate gets a fresh model.
 */
export function loadMobileNet() {
  if (!mobilenetPromise) {
    mobilenetPromise = (async () => {
      const mode = getEngineMode();
      await selectBackend(mode);
      let model = await mobilenet.load({ version: 2, alpha: 1.0 });
      if (mode !== 'auto') return model;

      const tried = new Set(engineReport.attempts.map((attempt) => attempt.backend));
      for (;;) {
        const output = await testModelOutput(model);
        engineReport.modelCheck = { backend: tf.getBackend(), ...output };
        if (output.ok) return model;
        console.warn(`[ml] backend "${tf.getBackend()}" passed arithmetic but failed on the model:`, output);
        const next = AUTO_CANDIDATES.find((candidate) => !tried.has(candidate));
        if (!next) return model;
        tried.add(next);
        model.model?.dispose?.();
        await activateBackend(next);
        await tf.ready();
        engineReport.attempts.push({ backend: next, ok: true, note: 'model-check fallback' });
        model = await mobilenet.load({ version: 2, alpha: 1.0 });
      }
    })();
  }
  return mobilenetPromise;
}

export function createClassifier() {
  return knnClassifier.create();
}

/** Runs MobileNet up to the penultimate layer to get an embedding tensor. */
export function embedImage(model, imageSource) {
  return tf.tidy(() => model.infer(imageSource, true));
}

/**
 * The same embedding, but routed through an explicit ImageData readback
 * instead of handing the canvas element straight to the backend.
 * tf.browser.fromPixels() uploads a canvas as a GPU texture, while
 * getImageData() forces a CPU side read of the pixels actually drawn. If the
 * two embeddings disagree, the texture upload is what is broken on this
 * device, not the drawing and not the model.
 */
export function embedCanvasViaImageData(model, canvas) {
  const imageData = canvas
    .getContext('2d', { willReadFrequently: true })
    .getImageData(0, 0, canvas.width, canvas.height);
  return tf.tidy(() => model.infer(imageData, true));
}

/**
 * KNN datasets hold one tensor per label, and tensors cannot go into
 * IndexedDB. Pulling the raw values out as typed arrays works because
 * structured clone supports those natively. The shape is kept to rebuild them.
 */
export async function serializeDataset(classifier) {
  const dataset = classifier.getClassifierDataset();
  const serialized = {};
  for (const [label, tensor] of Object.entries(dataset)) {
    serialized[label] = { data: await tensor.data(), shape: tensor.shape };
  }
  return serialized;
}

export function loadDatasetIntoClassifier(classifier, serialized) {
  if (!serialized) return;
  const dataset = {};
  for (const [label, { data, shape }] of Object.entries(serialized)) {
    dataset[label] = tf.tensor(data, shape);
  }
  classifier.setClassifierDataset(dataset);
}

/**
 * Mobile GPUs often support only reduced (16 bit) WebGL texture precision,
 * unlike desktop GPUs which almost always support full 32 bit float. With a
 * network as deep as MobileNet that precision loss alone can degrade
 * embeddings, so the active backend and precision are surfaced to tell a phone
 * only classification bug apart from a data or logic one.
 */
export function getBackendInfo() {
  const env = tf.env();
  const info = {
    backend: tf.getBackend(),
    engineMode: getEngineMode(),
    engineSelection: JSON.stringify(getEngineReport()),
    renderer: getRenderer(),
  };
  for (const [key, flag] of [
    ['webglVersion', 'WEBGL_VERSION'],
    ['float32Capable', 'WEBGL_RENDER_FLOAT32_CAPABLE'],
    ['forceF16Textures', 'WEBGL_FORCE_F16_TEXTURES'],
    ['maxTextureSize', 'WEBGL_MAX_TEXTURE_SIZE'],
    // Reading float data back off the GPU is a separate capability from
    // rendering to a float texture. When downloads are unsupported, tf.js
    // encodes floats into a byte texture instead, and every value that crosses
    // back to JS (serialized embeddings, KNN similarities) takes that path. A
    // device can report float32Capable: true and still download badly.
    ['downloadFloatEnabled', 'WEBGL_DOWNLOAD_FLOAT_ENABLED'],
    ['pack', 'WEBGL_PACK'],
    ['packDepthwise', 'WEBGL_PACK_DEPTHWISECONV'],
    ['cpuForward', 'WEBGL_CPU_FORWARD'],
  ]) {
    try {
      info[key] = env.get(flag);
    } catch {
      info[key] = 'n/a';
    }
  }
  return info;
}

/** Unmasked GPU name, so device specific driver bugs can be matched to a real chip. */
function getRenderer() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return 'n/a';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch {
    return 'n/a';
  }
}
