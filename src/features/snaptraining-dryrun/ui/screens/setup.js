import { MIN_EXAMPLES_PER_CLASS } from '../../labeling.js';
import { setHeader } from '../../../../app/shell.js';
import { t } from '../../../../shared/i18n.js';

export function renderSetupScreen(container, draft, { onBack, onNext }) {
  setHeader({ title: t('snap-dryrun.setup.title'), onBack });

  container.innerHTML = `
    <section class="screen">
      <label class="field" id="name-field">
        ${t('snap-dryrun.setup.nameLabel')}
        <input type="text" id="name-input" placeholder="${t('snap-dryrun.setup.namePlaceholder')}" value="${draft.name}" />
        <p class="error" id="name-error" hidden></p>
      </label>

      <label class="field">
        ${t('snap-dryrun.setup.cameraLabel')}
        <select id="facing-select">
          <option value="environment" ${draft.facingMode === 'environment' ? 'selected' : ''}>${t(
            'snap-dryrun.setup.cameraRear',
          )}</option>
          <option value="user" ${draft.facingMode === 'user' ? 'selected' : ''}>${t('snap-dryrun.setup.cameraFront')}</option>
        </select>
      </label>

      <div class="class-hint">
        <p class="class-hint-title">${t('snap-dryrun.setup.classTitle', { min: MIN_EXAMPLES_PER_CLASS })}</p>
        <div class="class-bar" aria-hidden="true">
          <span class="class-bar-cover">${t('label.cover')} ≥ ${MIN_EXAMPLES_PER_CLASS}</span>
          <span class="class-bar-snap">${t('label.snap')} ≥ ${MIN_EXAMPLES_PER_CLASS}</span>
        </div>
        <p class="hint">${t('snap-dryrun.setup.classHint', { min: MIN_EXAMPLES_PER_CLASS })}</p>
      </div>

      <button type="button" class="btn btn-primary" id="next-btn" aria-disabled="true">${t('snap-dryrun.setup.next')}</button>
    </section>
  `;

  const nameField = container.querySelector('#name-field');
  const nameInput = container.querySelector('#name-input');
  const nameError = container.querySelector('#name-error');
  const facingSelect = container.querySelector('#facing-select');
  const nextBtn = container.querySelector('#next-btn');

  // The camera is not started here. It only ever mattered on this screen for
  // aiming and for the region selector, both of which are gone, so the capture
  // screen opens it directly instead.

  function isNameValid() {
    return !!nameInput.value.trim();
  }

  function clearNameError() {
    nameField.classList.remove('field-invalid');
    nameError.hidden = true;
  }

  function showNameError() {
    nameField.classList.add('field-invalid');
    nameError.textContent = t('snap-dryrun.setup.nameRequired');
    nameError.hidden = false;
  }

  // next-btn is never truly disabled: a disabled button doesn't fire click at
  // all, which would leave no way to explain what's blocking it when tapped.
  // aria-disabled keeps it clickable while still looking and announcing as
  // disabled, and the click handler below does the actual gating.
  nextBtn.setAttribute('aria-disabled', String(!isNameValid()));

  nameInput.addEventListener('input', () => {
    draft.name = nameInput.value;
    nextBtn.setAttribute('aria-disabled', String(!isNameValid()));
    if (isNameValid()) clearNameError();
  });

  nextBtn.addEventListener('click', () => {
    if (!isNameValid()) {
      showNameError();
      return;
    }
    draft.name = nameInput.value.trim();
    draft.facingMode = facingSelect.value;
    onNext();
  });

  return null;
}
