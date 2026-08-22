import { getFeature } from '../features/index.js';
import { renderHome } from './home.js';
import { renderSettings } from './settings.js';
import { setHeader } from './shell.js';
import { t, onLangChange } from '../shared/i18n.js';

let currentCleanup = null;

function parseRoute(hash) {
  const path = hash.replace(/^#/, '') || '/';
  const featureMatch = path.match(/^\/feature\/([^/]+)/);
  if (featureMatch) return { name: 'feature', featureId: featureMatch[1] };
  const settingsMatch = path.match(/^\/settings\/([^/]+)/);
  if (settingsMatch)
    return { name: 'feature-settings', featureId: settingsMatch[1] };
  if (path === '/settings') return { name: 'settings' };
  return { name: 'home' };
}

async function render(container) {
  if (currentCleanup) {
    await currentCleanup();
    currentCleanup = null;
  }
  container.innerHTML = '';

  const route = parseRoute(window.location.hash);

  if (route.name === 'feature') {
    const feature = getFeature(route.featureId);
    if (!feature) {
      setHeader({
        title: t('notFound.title'),
        onBack: () => {
          window.location.hash = '#/';
        },
      });
      container.innerHTML = `<p class="error">${t('notFound.message')}</p>`;
      return;
    }
    const cleanup = await feature.mount(container);
    if (typeof cleanup === 'function') currentCleanup = cleanup;
    return;
  }

  if (route.name === 'feature-settings') {
    const feature = getFeature(route.featureId);
    if (!feature?.mountSettings) {
      setHeader({
        title: t('notFound.title'),
        onBack: () => {
          window.location.hash = '#/settings';
        },
      });
      container.innerHTML = `<p class="error">${t('notFound.message')}</p>`;
      return;
    }
    const cleanup = await feature.mountSettings(container);
    if (typeof cleanup === 'function') currentCleanup = cleanup;
    return;
  }

  if (route.name === 'settings') {
    const cleanup = renderSettings(container);
    if (typeof cleanup === 'function') currentCleanup = cleanup;
    return;
  }

  renderHome(container);
}

/** Hash based client side routing, so GitHub Pages needs no server routing. */
export function startRouter(container) {
  window.addEventListener('hashchange', () => render(container));
  // Screens are plain innerHTML with no reactivity, so a language switch
  // re-runs the current route exactly the way a navigation would.
  onLangChange(() => render(container));
  if (!window.location.hash) window.location.hash = '#/';
  render(container);
}
