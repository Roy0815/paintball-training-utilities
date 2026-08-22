import { features } from '../features/index.js';
import { setHeader } from './shell.js';
import { t } from '../shared/i18n.js';

function renderTileIcon(feature) {
  if (feature.iconUrl) return `<img src="${feature.iconUrl}" alt="" />`;
  return feature.icon ?? '';
}

export function renderHome(container) {
  setHeader({ title: t('shell.appTitle'), onBack: null, forceLeftAlign: true });

  container.innerHTML = `
    <section class="home">
      <div class="home-header">
        <p class="subtitle">${t('home.subtitle')}</p>
        <a class="icon-btn" href="#/settings" aria-label="${t('home.settingsLabel')}">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </a>
      </div>
      <div class="tile-grid">
        ${features
          .map(
            (feature) => `
              <a class="tile" href="#/feature/${feature.id}">
                <span class="tile-text">
                  <span class="tile-name">${t(feature.nameKey)}</span>
                  <span class="tile-desc">${t(feature.descriptionKey)}</span>
                </span>
                <span class="tile-icon">${renderTileIcon(feature)}</span>
              </a>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
}
