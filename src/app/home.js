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
      <p class="subtitle">${t('home.subtitle')}</p>
      <div class="tile-grid">
        ${features
          .map(
            (feature) => `
              <a class="tile" href="#/feature/${feature.id}">
                <span class="tile-icon">${renderTileIcon(feature)}</span>
                <span class="tile-name">${t(feature.nameKey)}</span>
                <span class="tile-desc">${t(feature.descriptionKey)}</span>
              </a>
            `
          )
          .join('')}
      </div>
    </section>
  `;
}
