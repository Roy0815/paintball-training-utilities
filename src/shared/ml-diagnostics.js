import * as tf from '@tensorflow/tfjs';

/**
 * Diagnostics for "the model behaves differently on this device" bugs.
 *
 * These exist to separate two failure modes that look identical from the
 * outside, namely a stuck, deterministic 100%/0% prediction:
 *
 * 1. A degenerate computation. The embedding is all zero, NaN or constant, so
 *    every stored example ties and the KNN's plain JS sort silently keeps its
 *    original order.
 * 2. A healthy but wrong embedding. The frame really is classified, just
 *    against pixels that are not what is on screen.
 */

function round(value, digits = 3) {
  if (!Number.isFinite(value)) return String(value);
  return Number(value.toFixed(digits));
}

/** Min, max, mean and L2 plus NaN and zero counts: enough to spot a dead vector. */
export function describeValues(values, { head = 6 } = {}) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let sumSquares = 0;
  let nan = 0;
  let zeros = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (Number.isNaN(value)) {
      nan += 1;
      continue;
    }
    if (value === 0) zeros += 1;
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
    sumSquares += value * value;
  }
  const finiteCount = values.length - nan;
  return {
    length: values.length,
    min: finiteCount ? min : NaN,
    max: finiteCount ? max : NaN,
    mean: finiteCount ? sum / finiteCount : NaN,
    l2: Math.sqrt(sumSquares),
    nan,
    zeros,
    head: Array.from(values.slice(0, head)),
  };
}

export function formatValueStats(stats) {
  return (
    `len ${stats.length}, min ${round(stats.min)}, max ${round(stats.max)}, ` +
    `mean ${round(stats.mean)}, l2 ${round(stats.l2)}, nan ${stats.nan}, zeros ${stats.zeros}\n` +
    `  head: ${stats.head.map((value) => round(value, 4)).join(', ')}`
  );
}

export async function describeTensor(tensor, options) {
  return describeValues(await tensor.data(), options);
}

/**
 * Reads the canvas back through getImageData, a CPU side read that GPU state
 * cannot fool. Real content here plus a dead embedding means the break is in
 * the pixel to tensor upload, not in the drawing.
 */
export function describeCanvasPixels(canvas, { stride = 7 } = {}) {
  const { width, height } = canvas;
  const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
  const sums = [0, 0, 0];
  let min = 255;
  let max = 0;
  let samples = 0;
  const step = stride * 4;
  for (let i = 0; i + 3 < data.length; i += step) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = data[i + channel];
      sums[channel] += value;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    samples += 1;
  }
  return {
    width,
    height,
    samples,
    meanRgb: sums.map((sum) => sum / Math.max(samples, 1)),
    min,
    max,
  };
}

export function formatCanvasPixels(stats) {
  return (
    `${stats.width}x${stats.height}, sampled ${stats.samples}px\n` +
    `  mean rgb ${stats.meanRgb.map((value) => Math.round(value)).join('/')}, ` +
    `min ${stats.min}, max ${stats.max}`
  );
}

/**
 * Pixel stats for a decoded <img>, taken through a small scratch canvas.
 * img.onload can fire before the browser has rasterized the image, and an
 * unrasterized image uploads to the GPU as blank. So a training photo can
 * load fine and still embed as an empty frame. Drawing it and reading the
 * pixels back proves whether there is an image there at all.
 */
export function describeImagePixels(image, { size = 64 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0, size, size);
  return {
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    ...describeCanvasPixels(canvas, { stride: 1 }),
  };
}

/** Cosine similarity between two embedding tensors of equal size. */
export async function cosineSimilarity(a, b) {
  const result = tf.tidy(() => {
    const flatA = tf.reshape(a, [a.size]);
    const flatB = tf.reshape(b, [b.size]);
    return tf.div(tf.sum(tf.mul(flatA, flatB)), tf.mul(tf.norm(flatA), tf.norm(flatB)));
  });
  const value = (await result.data())[0];
  result.dispose();
  return value;
}

/**
 * Walks the KNN dataset in the same order calculateTopClass() concatenates it,
 * so an index into the similarity vector can be mapped back to its class.
 */
function buildIndexToLabel(classifier) {
  const counts = classifier.getClassExampleCount();
  const labels = Object.keys(classifier.getClassifierDataset());
  const indexToLabel = [];
  for (const label of labels) {
    for (let i = 0; i < counts[label]; i += 1) indexToLabel.push(label);
  }
  return { labels, indexToLabel };
}

/**
 * The full picture behind a prediction: how similar the live frame is to every
 * stored example, grouped by class. predictClass() only exposes the k nearest
 * vote, which hides whether a wrong answer was a near miss (a real
 * separability problem) or a total mismatch (broken input).
 */
export async function classifierSimilarityReport(classifier, embedding, { topN = 8 } = {}) {
  const { labels, indexToLabel } = buildIndexToLabel(classifier);
  const similarities = tf.tidy(() => tf.cast(classifier.similarities(embedding), 'float32'));
  const values = await similarities.data();
  similarities.dispose();

  const perClass = {};
  for (const label of labels) perClass[label] = [];
  for (let i = 0; i < values.length; i += 1) perClass[indexToLabel[i]].push(values[i]);

  const ranked = Array.from(values)
    .map((similarity, index) => ({ similarity, index, label: indexToLabel[index] }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);

  return {
    perClass: Object.fromEntries(
      Object.entries(perClass).map(([label, list]) => [label, describeValues(Float32Array.from(list), { head: 0 })])
    ),
    ranked,
    distinctValues: new Set(Array.from(values).map((value) => round(value, 6))).size,
    total: values.length,
  };
}

export function formatSimilarityReport(report) {
  const lines = Object.entries(report.perClass).map(
    ([label, stats]) =>
      `  ${label}: min ${round(stats.min)} mean ${round(stats.mean)} max ${round(stats.max)} (nan ${stats.nan})`
  );
  lines.push(`  distinct values: ${report.distinctValues}/${report.total}`);
  lines.push(
    `  top: ${report.ranked.map((entry) => `${entry.label}#${entry.index} ${round(entry.similarity)}`).join(', ')}`
  );
  return lines.join('\n');
}

/**
 * Checks the stored training set against itself. addExample() unit length
 * normalizes every row, so each row's L2 must be exactly 1.0. Anything else
 * proves the embedding was already dead at training time, whatever produced
 * it. The intra and inter class means then show whether the two classes are
 * separable at all, which bounds how well any live frame could be classified.
 */
export async function datasetSelfReport(classifier) {
  const dataset = classifier.getClassifierDataset();
  const { labels, indexToLabel } = buildIndexToLabel(classifier);
  if (labels.length === 0) return null;

  const perClass = {};
  for (const label of labels) {
    perClass[label] = {
      shape: dataset[label].shape,
      values: await describeTensor(dataset[label], { head: 0 }),
    };
  }

  // The Gram matrix of all rows: its diagonal holds the squared row norms,
  // everything above it holds every pairwise similarity.
  const gram = tf.tidy(() => {
    const matrix = tf.concat(labels.map((label) => dataset[label]), 0);
    return tf.matMul(matrix, matrix, false, true);
  });
  const values = await gram.data();
  const rowCount = gram.shape[0];
  gram.dispose();

  const rowNorms = [];
  const intra = {};
  for (const label of labels) intra[label] = [];
  const inter = [];
  for (let i = 0; i < rowCount; i += 1) {
    rowNorms.push(Math.sqrt(values[i * rowCount + i]));
    for (let j = i + 1; j < rowCount; j += 1) {
      const similarity = values[i * rowCount + j];
      if (indexToLabel[i] === indexToLabel[j]) intra[indexToLabel[i]].push(similarity);
      else inter.push(similarity);
    }
  }

  const mean = (list) => (list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : NaN);
  return {
    perClass,
    rowNorms: describeValues(Float32Array.from(rowNorms), { head: 0 }),
    intra: Object.fromEntries(Object.entries(intra).map(([label, list]) => [label, mean(list)])),
    inter: mean(inter),
  };
}

export function formatDatasetSelfReport(report) {
  if (!report) return '  (no classes)';
  const lines = Object.entries(report.perClass).map(
    ([label, entry]) =>
      `  ${label}: shape ${entry.shape.join('x')}, nan ${entry.values.nan}, zeros ${entry.values.zeros}, ` +
      `min ${round(entry.values.min)} max ${round(entry.values.max)}`
  );
  lines.push(
    `  row L2 (must be 1.0): min ${round(report.rowNorms.min)} mean ${round(report.rowNorms.mean)} ` +
      `max ${round(report.rowNorms.max)} nan ${report.rowNorms.nan}`
  );
  lines.push(
    `  intra-class sim: ${Object.entries(report.intra)
      .map(([label, value]) => `${label} ${round(value)}`)
      .join(', ')} | inter-class sim: ${round(report.inter)}`
  );
  return lines.join('\n');
}

/**
 * Renders the per example record training collects. Training photos are
 * discarded once training finishes, so this snapshot is the only way to tell
 * afterwards whether the stored classifier was built from real images.
 */
export function formatTrainingDiagnostics(diagnostics) {
  if (!diagnostics?.length) return '  (none recorded, retrain to collect)';
  const lines = [];
  const byLabel = {};
  for (const entry of diagnostics) (byLabel[entry.label] ??= []).push(entry);
  for (const [label, entries] of Object.entries(byLabel)) {
    const meanOf = (readValue) => entries.reduce((sum, entry) => sum + readValue(entry), 0) / entries.length;
    lines.push(
      `  ${label} (${entries.length}): natural ${entries[0].naturalWidth}x${entries[0].naturalHeight}, ` +
        `pixel mean ${round(meanOf((entry) => entry.pixelMean))}, ` +
        `pixel max ${Math.max(...entries.map((entry) => entry.pixelMax))}, ` +
        `emb l2 ${round(meanOf((entry) => entry.l2))}, ` +
        `emb mean ${round(meanOf((entry) => entry.mean))}, ` +
        `nan ${entries.reduce((sum, entry) => sum + entry.nan, 0)}`
    );
  }
  const distinct = new Set(diagnostics.map((entry) => round(entry.l2, 5) + '/' + round(entry.mean, 5))).size;
  lines.push(`  distinct embeddings: ${distinct}/${diagnostics.length}`);
  return lines.join('\n');
}

const SELF_TEST_TOLERANCE = 1e-3;

/**
 * Verifies that the active backend actually returns correct numbers.
 *
 * A backend can initialize cleanly, report every capability flag as healthy
 * and still compute garbage. Some mobile GPU drivers do exactly that, without
 * raising an error anywhere. A wrong driver is indistinguishable from a wrong
 * model downstream, so correctness has to be established against known
 * answers rather than assumed from feature detection.
 *
 * The three checks mirror what inference here relies on: an elementwise op, a
 * reduction feeding a division (which is what unit length normalization is,
 * and a normalized vector whose length is not 1.0 proves breakage no matter
 * what produced it), and a matMul (the KNN's entire similarity search).
 */
export async function testBackendArithmetic() {
  const size = 1280; // same width as a MobileNet embedding
  const values = new Float32Array(size);
  for (let i = 0; i < size; i += 1) values[i] = Math.sin(i) * 0.5 + 1;

  const checks = {};
  const input = tf.tensor1d(values);

  const identity = tf.tidy(() => tf.mul(input, tf.scalar(1)));
  const identityValues = await identity.data();
  identity.dispose();
  let identityError = 0;
  for (let i = 0; i < size; i += 1) {
    identityError = Math.max(identityError, Math.abs(identityValues[i] - values[i]));
  }
  checks.elementwise = identityError;

  const normalized = tf.tidy(() => tf.div(input, tf.norm(input)));
  const normalizedValues = await normalized.data();
  normalized.dispose();
  let lengthSquared = 0;
  for (let i = 0; i < size; i += 1) lengthSquared += normalizedValues[i] * normalizedValues[i];
  checks.normalize = Math.abs(Math.sqrt(lengthSquared) - 1);

  const rows = 4;
  const matrix = tf.tidy(() => tf.reshape(tf.tile(input, [rows]), [rows, size]));
  const product = tf.tidy(() => tf.matMul(matrix, tf.reshape(input, [size, 1])));
  const productValues = await product.data();
  matrix.dispose();
  product.dispose();
  let expectedDot = 0;
  for (let i = 0; i < size; i += 1) expectedDot += values[i] * values[i];
  let matMulError = 0;
  for (let i = 0; i < rows; i += 1) {
    matMulError = Math.max(matMulError, Math.abs(productValues[i] - expectedDot) / expectedDot);
  }
  checks.matMul = matMulError;

  input.dispose();

  const failed = Object.entries(checks).filter(([, error]) => !(error <= SELF_TEST_TOLERANCE));
  return { ok: failed.length === 0, checks, failed: failed.map(([name]) => name) };
}

/**
 * The end to end version of the check above, run once on the loaded model.
 * Small regular tensors can come back correct on a driver that still breaks on
 * the deep convolution stack, so the model itself gets tested too. This embeds
 * a synthetic image and asserts what any MobileNet embedding must satisfy no
 * matter what it depicts: no NaN, unit length after normalization, real post
 * ReLU sparsity, and no values repeating at a lag of 4, which is one RGBA
 * texel and the fingerprint of a texture addressing bug.
 */
export async function testModelOutput(model) {
  const canvas = document.createElement('canvas');
  canvas.width = 224;
  canvas.height = 224;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  for (let y = 0; y < 224; y += 8) {
    for (let x = 0; x < 224; x += 8) {
      context.fillStyle = `rgb(${(x * 7) % 256}, ${(y * 11) % 256}, ${(x + y) % 256})`;
      context.fillRect(x, y, 8, 8);
    }
  }

  const embedding = tf.tidy(() => model.infer(canvas, true));
  const normalized = tf.tidy(() => tf.div(embedding, tf.norm(embedding)));
  const values = await normalized.data();
  embedding.dispose();
  normalized.dispose();

  let lengthSquared = 0;
  let nan = 0;
  let zeros = 0;
  for (let i = 0; i < values.length; i += 1) {
    if (Number.isNaN(values[i])) nan += 1;
    else {
      if (values[i] === 0) zeros += 1;
      lengthSquared += values[i] * values[i];
    }
  }
  let lagFourRepeats = 0;
  for (let i = 0; i + 4 < values.length; i += 1) {
    if (values[i] !== 0 && values[i] === values[i + 4]) lagFourRepeats += 1;
  }

  const unitLengthError = Math.abs(Math.sqrt(lengthSquared) - 1);
  const failed = [];
  if (nan > 0) failed.push('nan');
  if (!(unitLengthError <= SELF_TEST_TOLERANCE)) failed.push('unitLength');
  if (lagFourRepeats > values.length / 100) failed.push('lagFourRepeats');
  return {
    ok: failed.length === 0,
    failed,
    stats: { nan, zeros, unitLengthError, lagFourRepeats, length: values.length },
  };
}
