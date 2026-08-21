import { MIN_EXAMPLES_PER_CLASS } from '../../labeling.js';
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

      <div class="class-hint">
        <p class="class-hint-title">${t('pc.setup.classTitle', { min: MIN_EXAMPLES_PER_CLASS })}</p>
        <div class="class-bar" aria-hidden="true">
          <span class="class-bar-cover">${t('label.cover')} ≥ ${MIN_EXAMPLES_PER_CLASS}</span>
          <span class="class-bar-snap">${t('label.snap')} ≥ ${MIN_EXAMPLES_PER_CLASS}</span>
        </div>
        <p class="hint">${t('pc.setup.classHint', { min: MIN_EXAMPLES_PER_CLASS })}</p>
      </div>

      <button type="button" class="btn btn-primary" id="next-btn" disabled>${t('pc.setup.next')}</button>
    </section>
  `;

  const nameInput = container.querySelector('#name-input');
  const facingSelect = container.querySelector('#facing-select');
  const nextBtn = container.querySelector('#next-btn');

  // The camera is not started here. It only ever mattered on this screen for
  // aiming and for the region selector, both of which are gone, so the capture
  // screen opens it directly instead.
  nextBtn.disabled = !draft.name.trim();

  nameInput.addEventListener('input', () => {
    draft.name = nameInput.value;
    nextBtn.disabled = !nameInput.value.trim();
  });

  nextBtn.addEventListener('click', () => {
    draft.name = nameInput.value.trim();
    draft.facingMode = facingSelect.value;
    onNext();
  });

  return null;
}
