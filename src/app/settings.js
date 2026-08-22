import { setHeader } from './shell.js';
import { t } from '../shared/i18n.js';
import { isDebugMode, setDebugMode } from '../shared/debug.js';
import { features } from '../features/index.js';

function renderFeatureLink(feature) {
  return `
    <a class="settings-link" href="#/settings/${feature.id}">
      <span>${t(feature.nameKey)}</span>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="9 6 15 12 9 18"></polyline>
      </svg>
    </a>
  `;
}

export function renderSettings(container) {
  setHeader({
    title: t('settings.title'),
    onBack: () => {
      window.location.hash = '#/';
    },
  });

  const featureLinks = features
    .filter((feature) => feature.mountSettings)
    .map(renderFeatureLink)
    .join('');

  container.innerHTML = `
    <section class="screen">
      <div class="settings-link-list">
        ${featureLinks}
        <div class="settings-toggle-row" id="debug-row" tabindex="0" role="button" aria-expanded="false">
          <span>${t('settings.debugToggle')}</span>
          <button type="button" class="switch" id="debug-toggle" role="switch" aria-checked="${isDebugMode()}">
            <span class="switch-thumb"></span>
          </button>
          <div class="settings-tooltip" id="debug-tooltip" role="tooltip" hidden>${t('settings.debugHint')}</div>
        </div>
      </div>
    </section>
  `;

  const debugRow = container.querySelector('#debug-row');
  const debugTooltip = container.querySelector('#debug-tooltip');

  function closeTooltip() {
    debugRow.classList.remove('is-active');
    debugRow.setAttribute('aria-expanded', 'false');
    debugTooltip.hidden = true;
  }

  function toggleTooltip() {
    const isOpen = debugRow.classList.toggle('is-active');
    debugRow.setAttribute('aria-expanded', String(isOpen));
    debugTooltip.hidden = !isOpen;
  }

  // The switch is its own control, so a tap on it must not also open the
  // row's tooltip. Same closest('button') guard profileList.js uses to keep
  // a card's own click handler from firing for its nested action buttons.
  debugRow.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    toggleTooltip();
  });
  debugRow.addEventListener('keydown', (event) => {
    if (event.target.closest('button')) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleTooltip();
    }
  });

  function handleOutsideClick(event) {
    if (!debugRow.contains(event.target)) closeTooltip();
  }
  document.addEventListener('click', handleOutsideClick);

  container
    .querySelector('#debug-toggle')
    .addEventListener('click', (event) => {
      const next = !isDebugMode();
      setDebugMode(next);
      event.currentTarget.setAttribute('aria-checked', String(next));
    });

  return () => {
    document.removeEventListener('click', handleOutsideClick);
  };
}
