import { startCamera, stopCamera, captureSeries, drawCroppedFrame } from '../../capture.js';
import { toLabelItems } from '../../labeling.js';
import { DEFAULT_CAPTURE_COUNT, DEFAULT_CAPTURE_INTERVAL_MS, DEFAULT_CAPTURE_DELAY_MS } from '../../storage.js';
import { setHeader } from '../../../../app/shell.js';
import { t } from '../../../../shared/i18n.js';
import { isDebugMode } from '../../../../shared/debug.js';
import { unlockAudio, playNumber, playCameraCapture } from '../../../../shared/audio.js';
import { isCameraSoundEnabled, isNumberSoundEnabled } from '../../settings.js';

export function renderCaptureScreen(container, draft, { onBack, onNext }) {
  setHeader({ title: t('snap-dryrun.capture.title'), onBack });

  container.innerHTML = `
    <section class="screen">
      <button type="button" class="btn btn-primary" id="start-camera-btn" hidden>${t('snap-dryrun.capture.startCamera')}</button>
      <p class="error" id="error-msg" hidden></p>

      <div class="video-wrap" id="video-wrap">
        <video id="preview" playsinline muted></video>
      </div>
      <div class="crop-preview" id="crop-preview" hidden><canvas id="crop-canvas"></canvas></div>

      <div class="field-row">
        <label class="field">
          ${t('snap-dryrun.capture.countLabel')}
          <input type="number" id="count-input" min="4" max="100" value="${draft.captureCount ?? DEFAULT_CAPTURE_COUNT}" />
        </label>
        <label class="field">
          ${t('snap-dryrun.capture.intervalLabel')}
          <input type="number" id="interval-input" min="200" step="100" value="${
            draft.captureIntervalMs ?? DEFAULT_CAPTURE_INTERVAL_MS
          }" />
        </label>
        <label class="field">
          ${t('snap-dryrun.capture.delayLabel')}
          <input type="number" id="delay-input" min="0" step="1" value="${
            (draft.captureDelayMs ?? DEFAULT_CAPTURE_DELAY_MS) / 1000
          }" />
        </label>
      </div>

      <button type="button" class="btn btn-primary" id="capture-btn" disabled>${t('snap-dryrun.capture.start')}</button>
      <button type="button" class="btn" id="cancel-capture-btn" hidden>${t('snap-dryrun.capture.stop')}</button>
      <p class="hint" id="progress-text"></p>

      <button type="button" class="btn btn-primary" id="next-btn" disabled>${t('snap-dryrun.capture.next')}</button>

      <div class="thumb-grid" id="thumb-grid"></div>

      <div class="debug-tools" id="debug-tools" ${isDebugMode() ? '' : 'hidden'}>
        <button type="button" class="btn" id="debug-copy-btn">📋 Debug-Log kopieren</button>
        <pre class="debug-panel" id="debug-panel"></pre>
      </div>
    </section>
  `;

  const videoEl = container.querySelector('#preview');
  const videoWrap = container.querySelector('#video-wrap');
  const cropPreview = container.querySelector('#crop-preview');
  const cropCanvas = container.querySelector('#crop-canvas');
  const startCameraBtn = container.querySelector('#start-camera-btn');
  const captureBtn = container.querySelector('#capture-btn');
  const cancelBtn = container.querySelector('#cancel-capture-btn');
  const progressText = container.querySelector('#progress-text');
  const thumbGrid = container.querySelector('#thumb-grid');
  const errorMsg = container.querySelector('#error-msg');
  const nextBtn = container.querySelector('#next-btn');
  const countInput = container.querySelector('#count-input');
  const intervalInput = container.querySelector('#interval-input');
  const delayInput = container.querySelector('#delay-input');
  const debugPanel = container.querySelector('#debug-panel');
  const debugCopyBtn = container.querySelector('#debug-copy-btn');

  debugCopyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(debugPanel.textContent);
      debugCopyBtn.textContent = '✅ Kopiert!';
    } catch {
      debugCopyBtn.textContent = '❌ Kopieren fehlgeschlagen';
    }
    setTimeout(() => {
      debugCopyBtn.textContent = '📋 Debug-Log kopieren';
    }, 1500);
  });

  let stream = null;
  let cancelled = false;
  let capturedFrames = [];
  let previewRafId = null;

  // Redraws the exact crop captureFrameCanvas() would take, replacing the raw
  // preview. The saved photos are already cropped, so showing more than that
  // would misrepresent what actually gets captured.
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

  /**
   * Opening the camera is attempted right away, since arriving here is itself
   * the result of a tap and that activation normally still counts. It can
   * still fail, on a denied permission or a browser that insists on its own
   * gesture, so the start button appears only in that case and disappears
   * again once a stream is running.
   */
  async function openCamera() {
    errorMsg.hidden = true;
    try {
      stream = await startCamera(videoEl, draft.facingMode);
      startCameraBtn.hidden = true;
      captureBtn.disabled = false;
      debugPanel.textContent =
        `facingMode: ${draft.facingMode}\n` + `videoSize: ${videoEl.videoWidth}x${videoEl.videoHeight}`;
      console.log('[snaptraining] capture camera started:', {
        facingMode: draft.facingMode,
        videoSize: `${videoEl.videoWidth}x${videoEl.videoHeight}`,
      });
      startCropPreviewLoop();
    } catch (err) {
      errorMsg.textContent = t('snap-dryrun.capture.cameraError', { message: err.message });
      errorMsg.hidden = false;
      startCameraBtn.hidden = false;
    }
  }

  startCameraBtn.addEventListener('click', openCamera);
  openCamera();

  captureBtn.addEventListener('click', async () => {
    // Has to happen here, inside the gesture: the countdown's own ticks and
    // the capture loop's later ticks both run off setTimeout/setInterval,
    // which iOS no longer counts as user driven.
    unlockAudio();

    errorMsg.hidden = true;
    thumbGrid.innerHTML = '';
    capturedFrames = [];
    cancelled = false;
    captureBtn.hidden = true;
    cancelBtn.hidden = false;
    nextBtn.disabled = true;

    const count = Math.max(parseInt(countInput.value, 10) || DEFAULT_CAPTURE_COUNT, 1);
    const intervalMs = Math.max(parseInt(intervalInput.value, 10) || DEFAULT_CAPTURE_INTERVAL_MS, 100);
    const delayMs = Math.max(parseInt(delayInput.value, 10) || 0, 0) * 1000;
    draft.captureCount = count;
    draft.captureIntervalMs = intervalMs;
    draft.captureDelayMs = delayMs;

    // Every 5 seconds above 5, then every second from 5 down to 1, mirroring
    // the countdown text. onCountdown ticks every 100ms, so this also has to
    // dedupe repeated ticks that land on the same second.
    let lastAnnouncedSecond = null;
    const frames = await captureSeries(videoEl, {
      count,
      intervalMs,
      startDelayMs: delayMs,
      isCancelled: () => cancelled,
      onCountdown: (msRemaining) => {
        const seconds = Math.ceil(msRemaining / 1000);
        progressText.textContent = t('snap-dryrun.capture.countdown', { seconds });
        const isCheckpoint = seconds > 0 && (seconds <= 5 || seconds % 5 === 0);
        if (isCheckpoint && seconds !== lastAnnouncedSecond) {
          lastAnnouncedSecond = seconds;
          if (isNumberSoundEnabled()) playNumber(seconds);
        }
      },
      onCapture: (dataUrl, index, total) => {
        progressText.textContent = t('snap-dryrun.capture.progress', { index, total });
        if (isCameraSoundEnabled()) playCameraCapture();
        const img = document.createElement('img');
        img.src = dataUrl;
        img.className = 'thumb';
        thumbGrid.appendChild(img);
      },
    });

    capturedFrames = frames;
    captureBtn.hidden = false;
    captureBtn.textContent = t('snap-dryrun.capture.retake');
    cancelBtn.hidden = true;
    nextBtn.disabled = frames.length === 0;
  });

  cancelBtn.addEventListener('click', () => {
    cancelled = true;
  });

  nextBtn.addEventListener('click', () => {
    draft.items = toLabelItems(capturedFrames);
    stopCamera(stream);
    onNext();
  });

  return () => {
    if (previewRafId) cancelAnimationFrame(previewRafId);
    stopCamera(stream);
  };
}
