import { trainFromLabeledItems } from '../../training.js';
import { createProfileDraft, getProfile, saveProfile } from '../../storage.js';
import { setHeader } from '../../../../app/shell.js';
import { t } from '../../../../shared/i18n.js';

export function renderTrainScreen(container, draft, { onDone }) {
  setHeader({ title: t('snap-dryrun.train.title'), onBack: null });

  container.innerHTML = `
    <section class="screen">
      <h2>${t('snap-dryrun.train.title')}</h2>
      <p class="hint" id="status">${t('snap-dryrun.train.running')}</p>
      <progress id="progress" max="1" value="0"></progress>
      <p class="error" id="error-msg" hidden></p>
      <button type="button" class="btn btn-primary" id="done-btn" hidden>${t('snap-dryrun.train.doneBtn')}</button>
    </section>
  `;

  const statusEl = container.querySelector('#status');
  const progressEl = container.querySelector('#progress');
  const errorMsg = container.querySelector('#error-msg');
  const doneBtn = container.querySelector('#done-btn');

  let cancelled = false;

  (async () => {
    try {
      const {
        dataset: classifierDataset,
        diagnostics,
        engine,
        previewImage,
      } = await trainFromLabeledItems(draft.items, {
        onProgress: (done, total) => {
          if (cancelled) return;
          statusEl.textContent = t('snap-dryrun.train.runningProgress', { done, total });
          progressEl.max = total;
          progressEl.value = done;
        },
      });
      if (cancelled) return;

      const existing = draft.profileId ? await getProfile(draft.profileId) : null;
      const profile = existing ?? createProfileDraft({ name: draft.name, facingMode: draft.facingMode });
      profile.name = draft.name;
      profile.facingMode = draft.facingMode;
      profile.classifierDataset = classifierDataset;
      profile.trainingDiagnostics = diagnostics;
      profile.engine = engine;
      profile.previewImage = previewImage;
      profile.trainedAt = Date.now();
      await saveProfile(profile);

      statusEl.textContent = t('snap-dryrun.train.done', { name: profile.name });
      progressEl.hidden = true;
      doneBtn.hidden = false;
    } catch (err) {
      if (cancelled) return;
      errorMsg.textContent = t('snap-dryrun.train.error', { message: err.message });
      errorMsg.hidden = false;
      progressEl.hidden = true;
    }
  })();

  doneBtn.addEventListener('click', onDone);

  return () => {
    cancelled = true;
  };
}
