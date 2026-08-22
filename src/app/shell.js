import { t, getLang, setLang, LANGUAGES, onLangChange } from '../shared/i18n.js';

let headerEl = null;
let titleEl = null;
let backBtn = null;
let langSwitchEl = null;
let scrollHintEl = null;
let currentOnBack = null;
let currentForceLeftAlign = false;

// Breathing room between the centered title and the chrome on either side.
const TITLE_GAP_PX = 12;
// Roughly the bottom padding of a screen, so the hint gives up once the last
// real element is clear of it rather than clinging on through empty padding.
const SCROLL_END_MARGIN_PX = 40;

function renderLangSwitch() {
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

/**
 * Screens are long enough to scroll on a phone, and a primary button sitting
 * just below the fold looks like a missing button rather than a hidden one.
 * This fades in at the bottom edge whenever there is more content below.
 *
 * The question it answers is literally "is the end of the page on screen", so
 * it watches a sentinel sitting after the last content rather than comparing
 * scroll offsets. Offset arithmetic has to guess a tolerance for fractional
 * device pixels and reads a layout viewport that a mobile browser resizes under
 * you as its toolbars collapse, which is exactly when the answer matters. The
 * observer also needs no scroll, resize or content-height plumbing of its own:
 * anything that moves the end of the page re-fires it.
 */
function setupScrollHint(sentinelEl) {
  new IntersectionObserver(
    ([entry]) => {
      // A short screen still fills #app's min-height via main's flex: 1, so
      // the sentinel lands right on the viewport's own edge, where sub-pixel
      // rounding can decide intersection either way. Whether the page can
      // scroll at all sidesteps that: scrollHeight and clientHeight come from
      // the same element at the same instant, so there is no tolerance to
      // guess.
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight > doc.clientHeight + 1;
      scrollHintEl.hidden = !scrollable || entry.isIntersecting;
    },
    { rootMargin: `0px 0px ${SCROLL_END_MARGIN_PX}px 0px` }
  ).observe(sentinelEl);
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
    <div class="scroll-end" id="scroll-end" aria-hidden="true"></div>
    <div class="scroll-hint" id="scroll-hint" aria-hidden="true" hidden>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </div>
  `;

  headerEl = root.querySelector('.app-header');
  titleEl = root.querySelector('#app-title');
  backBtn = root.querySelector('#back-btn');
  langSwitchEl = root.querySelector('#lang-switch');
  scrollHintEl = root.querySelector('#scroll-hint');

  backBtn.addEventListener('click', () => currentOnBack?.());
  // The button is icon only, so aria-label carries its accessible name.
  backBtn.setAttribute('aria-label', t('shell.back'));
  renderLangSwitch();

  // The router re-renders #view on a language switch, but this header lives
  // outside #view and is built exactly once. Without its own listener the
  // back button's accessible name and the active language pill would keep
  // showing the previous language.
  onLangChange(() => {
    backBtn.setAttribute('aria-label', t('shell.back'));
    renderLangSwitch();
    updateTitleAlignment(currentForceLeftAlign);
  });

  window.addEventListener('resize', () => updateTitleAlignment(currentForceLeftAlign));

  setupScrollHint(root.querySelector('#scroll-end'));
  return root.querySelector('#view');
}

/**
 * Width of the centered slot, measured from the chrome actually on screen
 * rather than reserved as a fixed amount. A fixed reserve was wrong in both
 * directions: it left the title touching the language pill on a long German
 * title, while wasting space on the back button's side, which is narrower and
 * sometimes not there at all.
 */
function fitCenteredTitle() {
  const header = headerEl.getBoundingClientRect();
  const center = header.left + header.width / 2;
  const leftEdge = backBtn.hidden ? header.left : backBtn.getBoundingClientRect().right;
  const rightEdge = langSwitchEl.getBoundingClientRect().left;
  const halfWidth = Math.min(center - leftEdge, rightEdge - center) - TITLE_GAP_PX;
  titleEl.style.maxWidth = `${Math.max(halfWidth * 2, 0)}px`;
}

/**
 * A centered title only looks intentional while it actually fits its slot. A
 * title too long for it would sit centered but clipped by an ellipsis, which
 * reads as broken. Titles vary by language and on the live screen are user
 * entered profile names, so the fit is measured at render time and falls back
 * to the plain left aligned flex layout.
 */
function updateTitleAlignment(forceLeftAlign) {
  currentForceLeftAlign = forceLeftAlign;
  titleEl.classList.remove('app-title--left');
  titleEl.style.maxWidth = '';
  if (forceLeftAlign) {
    titleEl.classList.add('app-title--left');
    return;
  }
  fitCenteredTitle();
  // Reading scrollWidth flushes layout, which is what makes this comparison
  // meaningful: scrollWidth is the unclipped text width, clientWidth the
  // constrained box. Bigger means the centered slot is clipping the title.
  if (titleEl.scrollWidth > titleEl.clientWidth + 1) {
    // The inline max-width would otherwise beat the class rule that clears it.
    titleEl.style.maxWidth = '';
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
  // Every screen calls this exactly once on mount, which makes it the one
  // place that catches both router navigation and a feature's own wizard
  // steps. Without it a new screen inherits the previous screen's scroll
  // position and can open somewhere in its middle.
  window.scrollTo({ top: 0 });
}
