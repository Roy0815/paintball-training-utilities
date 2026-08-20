import { startCamera, stopCamera, attachRoiSelector } from '../../capture.js';
import { setHeader } from '../../../../app/shell.js';
import { t } from '../../../../shared/i18n.js';

export function renderSetupScreen(container, draft, { onBack, onNext }) {
  setHeader({ title: t('pc.setup.title'), onBack });

  container.innerHTML = `
    <section class="screen">
      <label class="field">
        ${t('pc.setup.nameLabel')}
        <input type="text" id="name-input" placeholder="${t('pc.setup.namePlaceholder')}" value="${draft.name}" />
      </label>

      <label class="field">
        ${t('pc.setup.cameraLabel')}
        <select id="facing-select">
          <option value="environment" ${draft.facingMode === 'environment' ? 'selected' : ''}>${t(
    'pc.setup.cameraRear'
  )}</option>
          <option value="user" ${draft.facingMode === 'user' ? 'selected' : ''}>${t('pc.setup.cameraFront')}</option>
        </select>
      </label>

      <button type="button" class="btn" id="start-camera-btn">${t('pc.setup.startCamera')}</button>
      <p class="error" id="error-msg" hidden></p>
      <button type="button" class="btn btn-primary" id="next-btn" disabled>${t('pc.setup.next')}</button>

      <div class="video-wrap" id="video-wrap" hidden>
        <video id="preview" playsinline muted></video>
        <div class="roi-overlay" id="roi-overlay"></div>
      </div>
      <p class="hint">${t('pc.setup.roiHint')}</p>
      <button type="button" class="btn" id="clear-roi-btn" hidden>${t('pc.setup.clearRoi')}</button>
    </section>
  `;

  const videoEl = container.querySelector('#preview');
  const videoWrap = container.querySelector('#video-wrap');
  const overlayEl = container.querySelector('#roi-overlay');
  const errorMsg = container.querySelector('#error-msg');
  const nextBtn = container.querySelector('#next-btn');
  const clearRoiBtn = container.querySelector('#clear-roi-btn');
  const nameInput = container.querySelector('#name-input');
  const facingSelect = container.querySelector('#facing-select');

  let stream = null;
  let roiSelector = null;

  container.querySelector('#start-camera-btn').addEventListener('click', async () => {
    errorMsg.hidden = true;
    draft.facingMode = facingSelect.value;
    try {
      stopCamera(stream);
      stream = await startCamera(videoEl, draft.facingMode);
      videoWrap.hidden = false;
      clearRoiBtn.hidden = false;
      roiSelector?.destroy();
      videoEl.addEventListener('loadedmetadata', () => roiSelector?.refresh(), { once: true });
      roiSelector = attachRoiSelector(overlayEl, videoEl, draft.roi);
      nextBtn.disabled = !draft.name.trim();
    } catch (err) {
      errorMsg.textContent = t('pc.setup.cameraError', { message: err.message });
      errorMsg.hidden = false;
    }
  });

  clearRoiBtn.addEventListener('click', () => roiSelector?.clear());

  nameInput.addEventListener('input', () => {
    draft.name = nameInput.value;
    nextBtn.disabled = !nameInput.value.trim() || !stream;
  });

  nextBtn.addEventListener('click', () => {
    draft.name = nameInput.value.trim();
    draft.roi = roiSelector?.getRoi() ?? null;
    // Hand the live stream to the capture screen instead of stopping it, so
    // the ROI (drawn against this stream's resolution) and the capture itself
    // use the exact same feed. See startCamera() for why that matters.
    draft.stream = stream;
    stream = null;
    onNext();
  });

  return () => {
    roiSelector?.destroy();
    stopCamera(stream);
  };
}
