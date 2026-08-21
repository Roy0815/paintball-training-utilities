import * as storage from '../../storage.js';
import { setHeader } from '../../../../app/shell.js';
import { unlockAudio } from '../../../../shared/audio.js';
import { t, formatDate } from '../../../../shared/i18n.js';

function formatTrainedAt(profile) {
  if (!profile.trainedAt) return t('snaptraining.list.notTrained');
  return t('snaptraining.list.trainedAt', { date: formatDate(profile.trainedAt) });
}

export function renderListScreen(container, profiles, { onCreate, onRetrain, onLive, onBack, refresh }) {
  setHeader({ title: t('feature.snaptrainingDryrun.name'), onBack });

  container.innerHTML = `
    <section class="screen">
      <div class="screen-header">
        <button type="button" class="btn btn-primary" id="new-profile-btn">${t('snaptraining.list.newPosition')}</button>
      </div>
      ${
        profiles.length === 0
          ? `<p class="hint">${t('snaptraining.list.emptyState')}</p>`
          : `<div class="profile-list">
              ${profiles
                .map(
                  (profile) => `
                    <article class="profile-card" data-id="${profile.id}" data-live="${
                      profile.classifierDataset ? '1' : '0'
                    }" ${profile.classifierDataset ? 'tabindex="0" role="button"' : ''}>
                      <h3>${profile.name}</h3>
                      <div class="profile-card-body">
                        ${
                          profile.previewImage
                            ? `<img class="profile-card-thumb" src="${profile.previewImage}" alt="" />`
                            : '<div class="profile-card-thumb profile-card-thumb-empty"></div>'
                        }
                        <div class="profile-card-actions">
                          <button type="button" class="btn" data-action="retrain">${t('snaptraining.list.retrain')}</button>
                          <button type="button" class="btn btn-danger" data-action="delete">${t(
                            'snaptraining.list.delete'
                          )}</button>
                        </div>
                      </div>
                      <p class="hint profile-card-trained">${formatTrainedAt(profile)}</p>
                      ${
                        profile.classifierDataset
                          ? `<svg class="profile-card-chevron" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                              <polyline points="9 6 15 12 9 18"></polyline>
                            </svg>`
                          : ''
                      }
                    </article>
                  `
                )
                .join('')}
            </div>`
      }
    </section>
  `;

  container.querySelector('#new-profile-btn').addEventListener('click', onCreate);

  container.querySelectorAll('.profile-card').forEach((card) => {
    const id = card.dataset.id;
    const profile = profiles.find((entry) => entry.id === id);

    // A plain click listener on the card itself, no absolutely positioned
    // overlay hitzone. Several attempts at an invisible full card target
    // (click bubbling, z-index layering, pointer-events, touch-action) each
    // broke differently on Android and iOS, so this uses the ordinary in flow
    // pattern instead.
    //
    // closest() excludes the action buttons, which keeps them independently
    // clickable without stopPropagation. It checks for 'button' specifically
    // and not the wrapping .profile-card-actions div, whose box extends past
    // its visible buttons: excluding the wrapper silently swallowed every tap
    // in that margin, which looked exactly like a dead zone.
    if (profile.classifierDataset) {
      card.addEventListener('click', (event) => {
        if (event.target.closest('button')) return;
        // Has to happen here, inside the gesture. The live screen's own
        // startup is async and by then iOS no longer counts it as user driven.
        unlockAudio();
        onLive(profile);
      });
      card.addEventListener('keydown', (event) => {
        if (event.target.closest('button')) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          unlockAudio();
          onLive(profile);
        }
      });
    }

    card.querySelector('[data-action="retrain"]').addEventListener('click', () => onRetrain(profile));

    card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (window.confirm(t('snaptraining.list.deleteConfirm', { name: profile.name }))) {
        await storage.deleteProfile(id);
        refresh();
      }
    });
  });

  return null;
}
