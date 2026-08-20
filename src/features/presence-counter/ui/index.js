import * as storage from '../storage.js';
import { renderListScreen } from './screens/profileList.js';
import { renderSetupScreen } from './screens/setup.js';
import { renderCaptureScreen } from './screens/capture.js';
import { renderLabelScreen } from './screens/label.js';
import { t } from '../../../shared/i18n.js';
// train.js and live.js pull in TensorFlow.js transitively, so they are
// imported dynamically. Opening the profile list should not pay that cost.

/**
 * Feature entry point. Owns a tiny in-memory state machine for the
 * create/label/train wizard and the live-counter screen, and hands off
 * rendering to one module per screen. Returns a cleanup fn the router calls
 * when the user navigates away from this feature (e.g. stops the camera).
 *
 * The wizard steps never touch the URL hash. router.js routes only at the
 * "which feature is mounted" level and remounts the whole feature on every
 * hash change, which would wipe an in progress capture or labeling session.
 * That left the entire session as a single history entry, so the system back
 * gesture always exited the feature straight to the home screen, however deep
 * the wizard was. Each forward step therefore pushes a history entry of its
 * own (same URL, just extra stack depth) and a popstate listener replays the
 * same onBack target the screen already wires to its in-app back button, so
 * both ways back always agree.
 */
export async function mount(container) {
  const state = { draft: null };
  let screenCleanup = null;
  let currentBackAction = null;
  // Guards goTrain and goLive. Both import their screen module dynamically
  // before rendering anything, and during that gap the triggering button is
  // still on screen and still clickable. A second impatient tap used to run
  // goTrain twice, and since each run creates and saves its own profile id,
  // one labeling pass ended up as two profiles in the list.
  let transitioning = false;

  async function teardownScreen() {
    if (screenCleanup) {
      await screenCleanup();
      screenCleanup = null;
    }
  }

  // Stashes the function passed as a screen's onBack so a system back press
  // can call the identical target. Kept as a thin wrapper so each screen's
  // back target stays visible at its own call site below.
  function backTo(action) {
    currentBackAction = action;
    return action;
  }

  function pushStep() {
    window.history.pushState({ ptuStep: true }, '', window.location.href);
  }

  // Between the tap and the next render there is nothing new to show, so the
  // previous screen would just sit there and read as an ignored tap. The
  // target screen's own render overwrites this spinner once it is ready.
  function showLoading() {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner" aria-hidden="true"></div>
        <p class="hint">${t('shell.loading')}</p>
      </div>
    `;
  }

  function onPopState() {
    if (currentBackAction) {
      currentBackAction();
    } else {
      // No back action for the current screen, which means training is
      // running and interrupting it is not safe. Re-assert the entry the
      // browser just popped so screen and history position stay in sync.
      pushStep();
    }
  }
  window.addEventListener('popstate', onPopState);

  async function goList() {
    await teardownScreen();
    const profiles = await storage.listProfiles();
    screenCleanup = renderListScreen(container, profiles, {
      onCreate: goSetup,
      onRetrain: goRetrain,
      onLive: goLive,
      onBack: backTo(() => {
        window.location.hash = '#/';
      }),
      refresh: goList,
    });
  }

  async function goSetup() {
    pushStep();
    await teardownScreen();
    state.draft = { profileId: null, name: '', facingMode: 'user', roi: null, items: [] };
    screenCleanup = renderSetupScreen(container, state.draft, { onBack: backTo(goList), onNext: goCapture });
  }

  // Re-renders setup without resetting state.draft. Used as the back target
  // from the capture screen, where goSetup() would silently discard the name,
  // camera and ROI already entered. Backward only, so unlike goSetup() it
  // must not push a history step of its own.
  async function goEditSetup() {
    await teardownScreen();
    screenCleanup = renderSetupScreen(container, state.draft, { onBack: backTo(goList), onNext: goCapture });
  }

  async function goRetrain(profile) {
    pushStep();
    await teardownScreen();
    state.draft = {
      profileId: profile.id,
      name: profile.name,
      facingMode: profile.facingMode,
      roi: profile.roi,
      items: [],
    };
    screenCleanup = renderCaptureScreen(container, state.draft, { onBack: backTo(goList), onNext: goLabel });
  }

  async function goCapture() {
    pushStep();
    await teardownScreen();
    screenCleanup = renderCaptureScreen(container, state.draft, { onBack: backTo(goEditSetup), onNext: goLabel });
  }

  async function goLabel() {
    pushStep();
    await teardownScreen();
    screenCleanup = renderLabelScreen(container, state.draft, { onBack: backTo(goCapture), onNext: goTrain });
  }

  async function goTrain() {
    if (transitioning) return;
    transitioning = true;
    try {
      pushStep();
      showLoading();
      await teardownScreen();
      const { renderTrainScreen } = await import('./screens/train.js');
      screenCleanup = renderTrainScreen(container, state.draft, { onDone: goList });
      backTo(null);
    } finally {
      transitioning = false;
    }
  }

  async function goLive(profile) {
    if (transitioning) return;
    transitioning = true;
    try {
      pushStep();
      showLoading();
      await teardownScreen();
      const { renderLiveScreen } = await import('./screens/live.js');
      screenCleanup = renderLiveScreen(container, profile, { onBack: backTo(goList) });
    } finally {
      transitioning = false;
    }
  }

  await goList();

  return async () => {
    window.removeEventListener('popstate', onPopState);
    await teardownScreen();
  };
}
