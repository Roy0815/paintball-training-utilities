import { t, getLang, setLang, LANGUAGES, onLangChange } from '../shared/i18n.js';

let titleEl = null;
let backBtn = null;
let currentOnBack = null;

function renderLangSwitch(root) {
  const langSwitchEl = root.querySelector('#lang-switch');
  langSwitchEl.innerHTML = LANGUAGES.map(
    (lang) =>
      `<button type="button" class="lang-btn" data-lang="${lang}" aria-pressed="${lang === getLang()}">${t(
        `shell.langName.${lang}`
      )}</button>`
  ).join('');
  langSwitchEl.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
}

/** Renders the persistent header plus the view outlet and returns the outlet element. */
export function renderShell(root) {
  root.innerHTML = `
    <header class="app-header">
      <button type="button" class="back-link" id="back-btn" hidden>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="15 6 9 12 15 18"></polyline>
        </svg>
      </button>
      <span class="app-title" id="app-title"></span>
      <div class="lang-switch" id="lang-switch"></div>
    </header>
    <main id="view"></main>
  `;

  titleEl = root.querySelector('#app-title');
  backBtn = root.querySelector('#back-btn');
  backBtn.addEventListener('click', () => currentOnBack?.());
  // The button is icon only, so aria-label carries its accessible name.
  backBtn.setAttribute('aria-label', t('shell.back'));
  renderLangSwitch(root);

  // The router re-renders #view on a language switch, but this header lives
  // outside #view and is built exactly once. Without its own listener the
  // back button's accessible name and the active language pill would keep
  // showing the previous language.
  onLangChange(() => {
    backBtn.setAttribute('aria-label', t('shell.back'));
    renderLangSwitch(root);
  });

  return root.querySelector('#view');
}

/**
 * A centered title only looks intentional while it actually fits its slot. A
 * title long enough to reach the language pill would sit centered but clipped
 * by an ellipsis, which reads as broken. Titles vary by language and on the
 * live screen are user entered profile names, so the fit has to be measured
 * at render time and falls back to the plain left aligned flex layout.
 */
function updateTitleAlignment(forceLeftAlign) {
  titleEl.classList.remove('app-title--left');
  if (forceLeftAlign) {
    titleEl.classList.add('app-title--left');
    return;
  }
  // Reading scrollWidth flushes layout, which is what makes this comparison
  // meaningful: scrollWidth is the unclipped text width, clientWidth the
  // constrained box. Bigger means the centered slot is clipping the title.
  if (titleEl.scrollWidth > titleEl.clientWidth + 1) {
    titleEl.classList.add('app-title--left');
  }
}

/**
 * The single source of truth for the top bar. Whichever screen is mounted
 * calls this once to set the visible title, the browser tab title and what
 * "one step back" means from here. There is exactly one back button in the
 * app, so screens never render their own.
 *
 * forceLeftAlign is for the home screen, which wants left alignment as a flat
 * rule rather than as a result of the measurement above.
 */
export function setHeader({ title, onBack = null, forceLeftAlign = false }) {
  titleEl.textContent = title;
  document.title = title;
  currentOnBack = onBack;
  backBtn.hidden = !onBack;
  updateTitleAlignment(forceLeftAlign);
}
