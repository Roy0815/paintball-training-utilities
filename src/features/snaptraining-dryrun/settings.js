const CAMERA_SOUND_KEY = 'ptu:snaptraining-dryrun:camera-sound';
const NUMBER_SOUND_KEY = 'ptu:snaptraining-dryrun:number-sound';

function isEnabled(key) {
  try {
    return localStorage.getItem(key) !== '0';
  } catch {
    return true;
  }
}

function setEnabled(key, enabled) {
  try {
    if (enabled) localStorage.removeItem(key);
    else localStorage.setItem(key, '0');
  } catch {
    /* storage unavailable, the choice just won't survive a reload */
  }
}

export function isCameraSoundEnabled() {
  return isEnabled(CAMERA_SOUND_KEY);
}

export function setCameraSoundEnabled(enabled) {
  setEnabled(CAMERA_SOUND_KEY, enabled);
}

export function isNumberSoundEnabled() {
  return isEnabled(NUMBER_SOUND_KEY);
}

export function setNumberSoundEnabled(enabled) {
  setEnabled(NUMBER_SOUND_KEY, enabled);
}
