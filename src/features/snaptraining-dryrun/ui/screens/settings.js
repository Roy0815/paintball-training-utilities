import { setHeader } from '../../../../app/shell.js';
import { t } from '../../../../shared/i18n.js';
import {
  isCameraSoundEnabled,
  setCameraSoundEnabled,
  isNumberSoundEnabled,
  setNumberSoundEnabled,
} from '../../settings.js';

function renderToggleRow(id, label, hint, checked) {
  return `
    <div class="setting-row">
      <div class="setting-row-text">
        <span>${label}</span>
        <span class="hint">${hint}</span>
      </div>
      <button type="button" class="switch" id="${id}" role="switch" aria-checked="${checked}">
        <span class="switch-thumb"></span>
      </button>
    </div>
  `;
}

export function renderSettingsScreen(container, { onBack }) {
  setHeader({ title: t('feature.snaptrainingDryrun.name'), onBack });

  container.innerHTML = `
    <section class="screen">
      ${renderToggleRow(
        'camera-sound-toggle',
        t('snap-dryrun.settings.cameraSound'),
        t('snap-dryrun.settings.cameraSoundHint'),
        isCameraSoundEnabled()
      )}
      ${renderToggleRow(
        'number-sound-toggle',
        t('snap-dryrun.settings.numberSound'),
        t('snap-dryrun.settings.numberSoundHint'),
        isNumberSoundEnabled()
      )}
    </section>
  `;

  container.querySelector('#camera-sound-toggle').addEventListener('click', (event) => {
    const next = !isCameraSoundEnabled();
    setCameraSoundEnabled(next);
    event.currentTarget.setAttribute('aria-checked', String(next));
  });

  container.querySelector('#number-sound-toggle').addEventListener('click', (event) => {
    const next = !isNumberSoundEnabled();
    setNumberSoundEnabled(next);
    event.currentTarget.setAttribute('aria-checked', String(next));
  });
}
