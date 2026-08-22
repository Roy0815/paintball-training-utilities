import { startCamera, stopCamera, drawCroppedFrame } from '../../capture.js';
import { startLiveDetection } from '../../live-counter.js';
import {
  recordDetection,
  resetCounter,
  recordPeekDuration,
  removeLastPeekDuration,
  DEFAULT_LIVE_START_DELAY_MS,
} from '../../storage.js';
import { ENGINE_MODES, getEngineMode, setEngineMode } from '../../../../shared/ml-utils.js';
import { setHeader } from '../../../../app/shell.js';
import { t } from '../../../../shared/i18n.js';
import { unlockAudio, playNumber } from '../../../../shared/audio.js';
import { isDebugMode } from '../../../../shared/debug.js';
import { isNumberSoundEnabled } from '../../settings.js';

// Every 10th confirmed snap gets a spoken callout, up to 100. Beyond that no
// clip is defined (see public/audio/numbers/README.md), so it stops rather
// than reaching for a number that was never recorded.
const MILESTONE_STEP = 10;
const MILESTONE_MAX = 100;

export function renderLiveScreen(container, profile, { onBack }) {
  setHeader({ title: profile.name, onBack });

  container.innerHTML = `
    <section class="screen">
      <div class="video-wrap" id="video-wrap">
        <video id="preview" playsinline muted></video>
      </div>
      <div class="crop-preview" id="crop-preview" hidden><canvas id="crop-canvas"></canvas></div>

      <p class="counter-value counter-live" id="counter-display">${profile.counter}</p>

      <p class="hint" id="peek-stats-line"></p>

      <p class="hint" id="status-line">${t('snap-dryrun.live.starting')}</p>

      <div class="idle-controls" id="idle-controls">
        <button type="button" class="btn btn-primary" id="start-training-btn">${t('snap-dryrun.live.startTraining')}</button>
        <div class="field-row">
          <label class="field">
            ${t('snap-dryrun.live.delayLabel')}
            <input type="number" id="live-delay-input" min="0" step="1" value="${DEFAULT_LIVE_START_DELAY_MS / 1000}" />
          </label>
        </div>
      </div>

      <button type="button" class="btn btn-primary" id="stop-training-btn" hidden>${t('snap-dryrun.live.stopTraining')}</button>

      <button type="button" class="btn" id="remove-peek-btn">${t('snap-dryrun.live.removePeek')}</button>
      <button type="button" class="btn" id="reset-btn">${t('snap-dryrun.live.reset')}</button>
      <p class="warning" id="engine-warning" hidden></p>
      <p class="error" id="error-msg" hidden></p>

      <div class="debug-tools" id="debug-tools" ${isDebugMode() ? '' : 'hidden'}>
        <button type="button" class="btn" id="debug-copy-btn">📋 Debug-Log kopieren</button>
        <button type="button" class="btn" id="diagnose-btn">🔬 Diagnose ausführen</button>
        <button type="button" class="btn" id="backend-btn"></button>
        <pre class="debug-panel" id="debug-panel"></pre>
        <pre class="debug-panel" id="diagnostic-panel" hidden></pre>
      </div>
    </section>
  `;

  const videoEl = container.querySelector('#preview');
  const videoWrap = container.querySelector('#video-wrap');
  const cropPreview = container.querySelector('#crop-preview');
  const cropCanvas = container.querySelector('#crop-canvas');
  const counterDisplay = container.querySelector('#counter-display');
  const peekStatsLine = container.querySelector('#peek-stats-line');
  const removePeekBtn = container.querySelector('#remove-peek-btn');
  const statusLine = container.querySelector('#status-line');
  const idleControls = container.querySelector('#idle-controls');
  const delayInput = container.querySelector('#live-delay-input');
  const startTrainingBtn = container.querySelector('#start-training-btn');
  const stopTrainingBtn = container.querySelector('#stop-training-btn');
  const errorMsg = container.querySelector('#error-msg');
  const engineWarning = container.querySelector('#engine-warning');
  const debugPanel = container.querySelector('#debug-panel');
  const debugCopyBtn = container.querySelector('#debug-copy-btn');
  const diagnosePanel = container.querySelector('#diagnostic-panel');
  const diagnoseBtn = container.querySelector('#diagnose-btn');
  const backendBtn = container.querySelector('#backend-btn');
  let debugStartInfo = '';
  let previewRafId = null;
  let countdownTimer = null;

  // The raw camera preview only shows until this starts, after which the
  // cropped frame replaces it, so the screen never shows more than the model
  // sees. Deliberately independent of the classification loop, which produces
  // one frame per tick and would look like a choppy 8 to 10 fps preview on an
  // unaccelerated backend. Redrawing at paint rate keeps it smooth however
  // slow classification runs.
  function startCropPreviewLoop() {
    videoWrap.hidden = true;
    cropPreview.hidden = false;
    function drawFrame() {
      if (videoEl.readyState >= 2) {
        drawCroppedFrame(videoEl, cropCanvas);
      }
      previewRafId = requestAnimationFrame(drawFrame);
    }
    drawFrame();
  }

  // The engine mode only takes effect when MobileNet loads, so cycling it has
  // to go through a reload. It applies to training too: a profile has to be
  // retrained under the mode it will run live in, otherwise its stored
  // embeddings come from a different engine.
  const ENGINE_LABELS = {
    auto: 'Auto (geprüft)',
    webgl: 'WebGL erzwungen',
    nopack: 'WebGL ohne Packing',
    wasm: 'WASM',
    cpu: 'CPU',
  };
  backendBtn.textContent = `⚙️ Engine: ${ENGINE_LABELS[getEngineMode()]} (wechseln, lädt neu)`;
  backendBtn.addEventListener('click', () => {
    const next = ENGINE_MODES[(ENGINE_MODES.indexOf(getEngineMode()) + 1) % ENGINE_MODES.length];
    setEngineMode(next);
    window.location.reload();
  });

  debugCopyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`${debugPanel.textContent}\n\n${diagnosePanel.textContent}`.trim());
      debugCopyBtn.textContent = '✅ Kopiert!';
    } catch {
      debugCopyBtn.textContent = '❌ Kopieren fehlgeschlagen';
    }
    setTimeout(() => {
      debugCopyBtn.textContent = '📋 Debug-Log kopieren';
    }, 1500);
  });

  let stream = null;
  let detection = null;

  function renderPeekStats(durations) {
    const list = durations ?? [];
    removePeekBtn.disabled = list.length === 0;
    if (list.length === 0) {
      peekStatsLine.textContent = t('snap-dryrun.live.peekStats', { avg: '-', min: '-', max: '-' });
      return;
    }
    const avg = Math.round(list.reduce((sum, value) => sum + value, 0) / list.length);
    const min = Math.min(...list);
    const max = Math.max(...list);
    peekStatsLine.textContent = t('snap-dryrun.live.peekStats', { avg, min, max });
  }
  renderPeekStats(profile.peekDurations);

  container.querySelector('#reset-btn').addEventListener('click', async () => {
    const updated = await resetCounter(profile.id);
    counterDisplay.textContent = updated.counter;
    renderPeekStats(updated.peekDurations);
  });

  removePeekBtn.addEventListener('click', async () => {
    const updated = await removeLastPeekDuration(profile.id);
    renderPeekStats(updated.peekDurations);
  });

  /** Starts the classifier loop, wiring the same callbacks the live screen has always used, plus onPeekComplete. */
  async function beginDetection() {
    detection = await startLiveDetection(videoEl, {
      classifierDataset: profile.classifierDataset,
      trainingDiagnostics: profile.trainingDiagnostics,
      onReady: ({ numClasses, exampleCounts, k, confidenceThreshold, ...backendInfo }) => {
        debugStartInfo +=
          `\nnumClasses: ${numClasses}\n` +
          `exampleCounts: ${JSON.stringify(exampleCounts)}\n` +
          `k: ${k}, threshold: ${confidenceThreshold}\n` +
          Object.entries(backendInfo)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
        debugPanel.textContent = debugStartInfo;

        // Embeddings are only comparable to others from an engine that
        // computes correctly. A profile trained on an unverified backend, or
        // on a different one than is running now, holds a feature space this
        // session cannot match against however healthy it looks.
        const trained = profile.engine;
        if (!trained?.verified || trained.backend !== backendInfo.backend) {
          engineWarning.textContent =
            `⚠️ Trainiert mit "${trained?.backend ?? 'unbekannt'}"` +
            `${trained && !trained.verified ? ' (ungeprüft)' : ''}, ` +
            `läuft jetzt auf "${backendInfo.backend}". Bitte neu trainieren.`;
          engineWarning.hidden = false;
        }
      },
      onDetect: async () => {
        const updated = await recordDetection(profile.id);
        counterDisplay.textContent = updated.counter;
        counterDisplay.classList.add('flash');
        setTimeout(() => counterDisplay.classList.remove('flash'), 400);
        if (isNumberSoundEnabled() && updated.counter % MILESTONE_STEP === 0 && updated.counter <= MILESTONE_MAX) {
          playNumber(updated.counter);
        }
      },
      onPeekComplete: async (durationMs) => {
        const updated = await recordPeekDuration(profile.id, durationMs);
        renderPeekStats(updated.peekDurations);
      },
      onTick: ({ confidences, present, canvasWidth, canvasHeight, inferenceMs, avgInferenceMs, maxInferenceMs, intervalMs }) => {
        const personPct = Math.round((confidences.person ?? 0) * 100);
        const emptyPct = Math.round((confidences.empty ?? 0) * 100);
        statusLine.textContent = `${t('snap-dryrun.live.status', { snap: personPct, cover: emptyPct })} · ${
          present ? t('snap-dryrun.live.stateSnap') : t('snap-dryrun.live.stateCover')
        }`;
        debugPanel.textContent =
          `${debugStartInfo}\n\ncanvas: ${canvasWidth}x${canvasHeight}\nconfidences: ${JSON.stringify(
            confidences
          )}\n` +
          `inference: ${inferenceMs.toFixed(0)}ms (avg ${avgInferenceMs.toFixed(0)}ms, max ${maxInferenceMs.toFixed(
            0
          )}ms) / target interval ${intervalMs}ms`;
      },
    });
    diagnoseBtn.disabled = false;
  }

  /**
   * The lead in before detection goes live, so the person holding the phone
   * has time to walk back into cover. Mirrors captureSeries()'s countdown in
   * ../../capture.js (100ms ticks, same checkpoint cadence for the spoken
   * countdown) but stays local here since that helper is tightly coupled to
   * photo capture.
   */
  function startTrainingCountdown() {
    // Has to happen here, inside the gesture: the countdown's own ticks and
    // detection's later ticks both run off setTimeout, which iOS no longer
    // counts as user driven.
    unlockAudio();

    idleControls.hidden = true;
    stopTrainingBtn.hidden = false;

    const delayMs = Math.max(parseInt(delayInput.value, 10) || 0, 0) * 1000;
    let remaining = delayMs;
    let lastAnnouncedSecond = null;

    function renderCountdown() {
      const seconds = Math.ceil(remaining / 1000);
      statusLine.textContent = t('snap-dryrun.live.countdown', { seconds });
      const isCheckpoint = seconds > 0 && (seconds <= 5 || seconds % 5 === 0);
      if (isCheckpoint && seconds !== lastAnnouncedSecond) {
        lastAnnouncedSecond = seconds;
        if (isNumberSoundEnabled()) playNumber(seconds);
      }
    }

    if (delayMs <= 0) {
      beginDetection();
      return;
    }

    renderCountdown();
    countdownTimer = setInterval(() => {
      remaining -= 100;
      if (remaining <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        beginDetection();
        return;
      }
      renderCountdown();
    }, 100);
  }

  startTrainingBtn.addEventListener('click', startTrainingCountdown);

  stopTrainingBtn.addEventListener('click', () => {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (detection) {
      detection.stop();
      detection = null;
    }
    diagnoseBtn.disabled = true;
    stopTrainingBtn.hidden = true;
    idleControls.hidden = false;
    statusLine.textContent = '';
  });

  (async () => {
    try {
      stream = await startCamera(videoEl, profile.facingMode);
      debugStartInfo =
        `facingMode: ${profile.facingMode}\n` +
        `videoSize: ${videoEl.videoWidth}x${videoEl.videoHeight}\n` +
        `trainedAt: ${profile.trainedAt ? new Date(profile.trainedAt).toLocaleString('de-DE') : '-'}`;
      debugPanel.textContent = debugStartInfo;
      console.log('[snaptraining] live camera started:', {
        facingMode: profile.facingMode,
        videoSize: `${videoEl.videoWidth}x${videoEl.videoHeight}`,
        trainedAt: profile.trainedAt,
      });
      startCropPreviewLoop();
      statusLine.textContent = '';
    } catch (err) {
      errorMsg.textContent = t('snap-dryrun.live.cameraError', { message: err.message });
      errorMsg.hidden = false;
    }
  })();

  diagnoseBtn.disabled = true;
  diagnoseBtn.addEventListener('click', async () => {
    if (!detection) return;
    diagnoseBtn.disabled = true;
    diagnoseBtn.textContent = '🔬 Diagnose läuft…';
    diagnosePanel.hidden = false;
    try {
      diagnosePanel.textContent = await detection.runDiagnostic();
    } catch (err) {
      diagnosePanel.textContent = `Diagnose fehlgeschlagen: ${err.stack ?? err.message}`;
    }
    diagnoseBtn.textContent = '🔬 Diagnose ausführen';
    diagnoseBtn.disabled = false;
  });

  async function teardown() {
    if (countdownTimer) clearInterval(countdownTimer);
    if (previewRafId) cancelAnimationFrame(previewRafId);
    if (detection) detection.stop();
    stopCamera(stream);
  }

  return teardown;
}
