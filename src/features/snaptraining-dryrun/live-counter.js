import {
  loadMobileNet,
  createClassifier,
  embedImage,
  embedCanvasViaImageData,
  loadDatasetIntoClassifier,
  getBackendInfo,
} from '../../shared/ml-utils.js';
import {
  describeTensor,
  formatValueStats,
  describeCanvasPixels,
  formatCanvasPixels,
  cosineSimilarity,
  classifierSimilarityReport,
  formatSimilarityReport,
  datasetSelfReport,
  formatDatasetSelfReport,
  formatTrainingDiagnostics,
} from '../../shared/ml-diagnostics.js';
import { captureFrameCanvas } from './capture.js';
import { LABELS } from './labeling.js';

/**
 * Classifies frames from `videoEl` in a loop and tracks a debounced presence
 * state. A raw snap/cover prediction only flips the confirmed state once it
 * has repeated for `confirmFrames` consecutive frames, which absorbs single
 * frame misclassifications. onDetect() and onPeekComplete() both fire once
 * per confirmed snap-to-cover transition, i.e. once a peek is over and the
 * person is back in cover, not when they first appear, and are awaited in
 * that order rather than fired concurrently, since both typically persist to
 * the same stored profile and a concurrent read-modify-write would lose
 * whichever update saved first. That means a peek still open when stop() is
 * called never fires either callback, since that requires a later tick that
 * will never run, so an in-progress peek is never counted and never
 * contributes a duration. onPeekComplete() receives that peek's duration in
 * ms.
 *
 * Returns { stop, runDiagnostic }.
 *
 * The confidence a prediction comes back with is literally the share of the k
 * most similar training photos that belong to that class, so the reachable
 * values are the k-ths and nothing in between. k is passed explicitly because
 * knn-classifier defaults to 3, where the only steps are 0, 1/3, 2/3 and 1.
 *
 * With k = 6 the steps are sixths, and there is none at 0.6, so the threshold
 * effectively asks for 4 of 6, or 66.7%. An even k can also tie 3 to 3, which
 * resolves to whichever class was concatenated first, but a tie is 0.5 and
 * therefore below the threshold either way.
 *
 * intervalMs is a pause after each tick, not a period, so the real time
 * between frames is inferenceMs + intervalMs. It only needs to be long enough
 * to yield to the browser between ticks. Inference itself already paces the
 * loop, which was not true back when WebGL made it near free.
 */
export async function startLiveDetection(
  videoEl,
  {
    classifierDataset,
    trainingDiagnostics,
    intervalMs = 10,
    confirmFrames = 2,
    k = 6,
    confidenceThreshold = 0.6,
    onDetect,
    onPeekComplete,
    onTick,
    onReady,
  }
) {
  const model = await loadMobileNet();
  const classifier = createClassifier();
  loadDatasetIntoClassifier(classifier, classifierDataset);

  const readyInfo = {
    numClasses: classifier.getNumClasses(),
    exampleCounts: classifier.getClassExampleCount(),
    k,
    confidenceThreshold,
    ...getBackendInfo(),
  };
  console.log('[snaptraining] live classifier loaded:', readyInfo);
  onReady?.(readyInfo);

  let stopped = false;
  let paused = false;
  let timeoutId = null;
  let confirmedPresent = false;
  let pendingLabelIsPerson = null;
  let pendingStreak = 0;
  let peekStartTime = null;

  // A rolling window rather than an all time average. The first few ticks
  // after a cold start (JIT warmup, first WASM calls) run much slower and
  // would permanently skew the number away from the steady state speed, which
  // is what actually decides whether reps get missed.
  const INFERENCE_WINDOW_TICKS = 20;
  const inferenceTimes = [];

  async function tick() {
    if (stopped) return;
    if (!paused && videoEl.readyState >= 2 && classifier.getNumClasses() > 0) {
      const tickStart = performance.now();
      const canvas = captureFrameCanvas(videoEl);
      const embedding = embedImage(model, canvas);
      const result = await classifier.predictClass(embedding, k);
      embedding.dispose();

      const inferenceMs = performance.now() - tickStart;
      inferenceTimes.push(inferenceMs);
      if (inferenceTimes.length > INFERENCE_WINDOW_TICKS) inferenceTimes.shift();
      const avgInferenceMs = inferenceTimes.reduce((sum, value) => sum + value, 0) / inferenceTimes.length;
      const maxInferenceMs = Math.max(...inferenceTimes);

      const confidence = result.confidences[result.label] ?? 0;
      const isPersonFrame = result.label === LABELS.PERSON && confidence >= confidenceThreshold;

      if (isPersonFrame === confirmedPresent) {
        pendingLabelIsPerson = null;
        pendingStreak = 0;
      } else {
        if (pendingLabelIsPerson === isPersonFrame) {
          pendingStreak += 1;
        } else {
          pendingLabelIsPerson = isPersonFrame;
          pendingStreak = 1;
        }
        if (pendingStreak >= confirmFrames) {
          confirmedPresent = isPersonFrame;
          pendingLabelIsPerson = null;
          pendingStreak = 0;
          if (confirmedPresent) {
            peekStartTime = Date.now();
          } else if (peekStartTime !== null) {
            // Awaited in sequence, not fired together: both callbacks do a
            // read-modify-write on the same stored profile, and running them
            // concurrently let the second one read a stale copy and overwrite
            // the first one's update, silently losing the counter increment.
            await onDetect?.();
            await onPeekComplete?.(Date.now() - peekStartTime);
            peekStartTime = null;
          }
        }
      }

      onTick?.({
        label: result.label,
        confidence,
        confidences: result.confidences,
        present: confirmedPresent,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        canvas,
        inferenceMs,
        avgInferenceMs,
        maxInferenceMs,
        intervalMs,
      });
    }
    if (!stopped) timeoutId = setTimeout(tick, intervalMs);
  }

  /**
   * One shot deep inspection of a single frame. predictClass() collapses
   * everything into a k-of-n vote, which hides the two failure modes that look
   * identical from outside: a degenerate embedding (all zero or NaN, so every
   * similarity ties and the KNN's plain JS sort keeps its original index
   * order, giving a hard content independent 100%/0%) and a healthy embedding
   * computed from the wrong pixels. Printing the raw embedding stats, the same
   * embedding through a CPU side ImageData readback, the stored training set's
   * own health and the full per example similarity spread separates them.
   */
  async function runDiagnostic() {
    // The polling loop shares this classifier and model, so pausing it keeps
    // the report describing one frame instead of racing the next tick.
    paused = true;
    try {
      return await collectDiagnostic();
    } finally {
      paused = false;
    }
  }

  async function collectDiagnostic() {
    const canvas = captureFrameCanvas(videoEl);
    const canvasEmbedding = embedImage(model, canvas);
    const imageDataEmbedding = embedCanvasViaImageData(model, canvas);
    const videoEmbedding = embedImage(model, videoEl);

    const lines = [`=== DIAGNOSE ${new Date().toLocaleTimeString('de-DE')} ===`];
    lines.push(`ua: ${navigator.userAgent}`);
    lines.push(`video: ${videoEl.videoWidth}x${videoEl.videoHeight}`);
    lines.push(`backend: ${JSON.stringify(getBackendInfo())}`);

    lines.push('', '-- canvas pixels (CPU readback) --');
    lines.push(formatCanvasPixels(describeCanvasPixels(canvas)));

    lines.push('', '-- embedding from canvas element (the live path) --');
    lines.push(formatValueStats(await describeTensor(canvasEmbedding)));

    lines.push('', '-- embedding from ImageData (CPU-side pixels) --');
    lines.push(formatValueStats(await describeTensor(imageDataEmbedding)));

    lines.push('', '-- embedding from video element directly --');
    lines.push(formatValueStats(await describeTensor(videoEmbedding)));

    lines.push('', '-- cross-check --');
    // Same pixels through two upload paths, so anything below ~0.99 means the
    // canvas to texture upload is not seeing what was drawn.
    lines.push(`  canvas vs imageData (expect ~1.0): ${(await cosineSimilarity(canvasEmbedding, imageDataEmbedding)).toFixed(4)}`);
    // Different framing (square crop against full frame), so a value well
    // below 1.0 is normal. Only ~1.0 or ~0 is informative here.
    lines.push(`  canvas vs video (differs by crop): ${(await cosineSimilarity(canvasEmbedding, videoEmbedding)).toFixed(4)}`);

    lines.push('', '-- training-time record (per photo, captured while training) --');
    lines.push(formatTrainingDiagnostics(trainingDiagnostics));

    lines.push('', '-- stored training set --');
    // The KNN's topK() sorts with a plain JS comparator, so tied similarities
    // keep their original index order and the vote lands entirely on whichever
    // class was concatenated first. Naming the order makes that case obvious.
    lines.push(`  class order (ties resolve to the first): ${Object.keys(classifier.getClassifierDataset()).join(', ')}`);
    lines.push(formatDatasetSelfReport(await datasetSelfReport(classifier)));

    lines.push('', '-- similarities: canvas embedding --');
    lines.push(formatSimilarityReport(await classifierSimilarityReport(classifier, canvasEmbedding)));

    lines.push('', '-- similarities: ImageData embedding --');
    lines.push(formatSimilarityReport(await classifierSimilarityReport(classifier, imageDataEmbedding)));

    canvasEmbedding.dispose();
    imageDataEmbedding.dispose();
    videoEmbedding.dispose();

    const report = lines.join('\n');
    console.log(report);
    return report;
  }

  tick();

  return {
    stop() {
      stopped = true;
      clearTimeout(timeoutId);
      classifier.dispose();
    },
    runDiagnostic,
  };
}
