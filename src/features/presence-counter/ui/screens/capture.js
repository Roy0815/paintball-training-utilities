import { startCamera, stopCamera, captureSeries, drawCroppedFrame } from '../../capture.js';
import { toLabelItems } from '../../labeling.js';
import { DEFAULT_CAPTURE_COUNT, DEFAULT_CAPTURE_INTERVAL_MS, DEFAULT_CAPTURE_DELAY_MS } from '../../storage.js';
import { setHeader } from '../../../../app/shell.js';
import { t } from '../../../../shared/i18n.js';

export function renderCaptureScreen(container, draft, { onBack, onNext }) {
  setHeader({ title: t('pc.capture.title'), onBack });

  container.innerHTML = `
    <section class="screen">
      <div class="ratio-hint">
        <p class="ratio-hint-title">${t('pc.capture.ratioTitle')}</p>
        <div class="ratio-bar" aria-hidden="true">
          <span class="ratio-bar-cover">${t('label.cover')} 50%</span>
          <span class="ratio-bar-snap">${t('label.snap')} 50%</span>
        </div>
        <p class="hint">${t('pc.capture.hint', { name: draft.name })}</p>
      </div>

      <div class="video-wrap" id="video-wrap">
        <video id="preview" playsinline muted></video>
      </div>
      <div class="crop-preview" id="crop-preview" hidden><canvas id="crop-canvas"></canvas></div>

      <div class="field-row">
        <label class="field">
          ${t('pc.capture.countLabel')}
          <input type="number" id="count-input" min="4" max="100" value="${draft.captureCount ?? DEFAULT_CAPTURE_COUNT}" />
        </label>
        <label class="field">
          ${t('pc.capture.intervalLabel')}
          <input type="number" id="interval-input" min="200" step="100" value="${
            draft.captureIntervalMs ?? DEFAULT_CAPTURE_INTERVAL_MS
          }" />
        </label>
        <label class="field">
          ${t('pc.capture.delayLabel')}
          <input type="number" id="delay-input" min="0" step="1" value="${
            (draft.captureDelayMs ?? DEFAULT_CAPTURE_DELAY_MS) / 1000
          }" />
        </label>
      </div>

      <button type="button" class="btn btn-primary" id="capture-btn">${t('pc.capture.start')}</button>
      <button type="button" class="btn" id="cancel-capture-btn" hidden>${t('pc.capture.stop')}</button>
      <p class="hint" id="progress-text"></p>
      <p class="error" id="error-msg" hidden></p>

      <button type="button" class="btn btn-primary" id="next-btn" disabled>${t('pc.capture.next')}</button>

      <div class="thumb-grid" id="thumb-grid"></div>

      <button type="button" class="btn" id="debug-copy-btn">📋 Debug-Log kopieren</button>
      <pre class="debug-panel" id="debug-panel"></pre>
    </section>
  `;

  const videoEl = container.querySelector('#preview');
  const videoWrap = container.querySelector('#video-wrap');
  const cropPreview = container.querySelector('#crop-preview');
  const cropCanvas = container.querySelector('#crop-canvas');
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
        drawCroppedFrame(videoEl, draft.roi, cropCanvas);
      }
      previewRafId = requestAnimationFrame(drawFrame);
    }
    drawFrame();
  }

  (async () => {
    let reusedStreamFromSetup = false;
    try {
      if (draft.stream) {
        // Reuse the stream handed off from the setup screen so the ROI
        // (drawn against that stream's resolution) still lines up here.
        stream = draft.stream;
        draft.stream = null;
        reusedStreamFromSetup = true;
        videoEl.srcObject = stream;
        await videoEl.play();
      } else {
        stream = await startCamera(videoEl, draft.facingMode);
      }
      debugPanel.textContent =
        `facingMode: ${draft.facingMode}\n` +
        `videoSize: ${videoEl.videoWidth}x${videoEl.videoHeight}\n` +
        `roi: ${JSON.stringify(draft.roi)}\n` +
        `reusedStreamFromSetup: ${reusedStreamFromSetup}`;
      console.log('[presence-counter] capture camera started:', {
        facingMode: draft.facingMode,
        videoSize: `${videoEl.videoWidth}x${videoEl.videoHeight}`,
        roi: draft.roi,
      });
      startCropPreviewLoop();
    } catch (err) {
      errorMsg.textContent = t('pc.capture.cameraError', { message: err.message });
      errorMsg.hidden = false;
    }
  })();

  captureBtn.addEventListener('click', async () => {
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

    const frames = await captureSeries(videoEl, {
      count,
      intervalMs,
      roi: draft.roi,
      startDelayMs: delayMs,
      isCancelled: () => cancelled,
      onCountdown: (msRemaining) => {
        progressText.textContent = t('pc.capture.countdown', { seconds: Math.ceil(msRemaining / 1000) });
      },
      onCapture: (dataUrl, index, total) => {
        progressText.textContent = t('pc.capture.progress', { index, total });
        const img = document.createElement('img');
        img.src = dataUrl;
        img.className = 'thumb';
        thumbGrid.appendChild(img);
      },
    });

    capturedFrames = frames;
    captureBtn.hidden = false;
    captureBtn.textContent = t('pc.capture.retake');
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
