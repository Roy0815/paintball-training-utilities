import { getLang } from './i18n.js';

const AUDIO_BASE = `${import.meta.env.BASE_URL}audio/numbers/`;

/**
 * iOS refuses to play audio that no user gesture started, and it grants that
 * permission per element rather than per page. So every clip goes through one
 * shared element whose `src` is swapped, instead of one element per number:
 * unlocking forty-eight elements is not possible from a single tap, unlocking
 * one is.
 */
let player = null;
let currentSrc = '';
let unlocked = false;

function getPlayer() {
  if (!player) {
    player = new Audio();
    player.preload = 'auto';
  }
  return player;
}

// 50ms of PCM silence. The unlock has to be silent through its content: iOS
// ignores `muted` on an audio element, the same way it makes `volume` read
// only, so muting a real clip just plays it at full volume.
const SILENCE = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

/**
 * Marks the shared player as user started. Has to run synchronously inside a
 * real tap handler, which is why the profile list calls it on the tap that
 * opens the live screen: by the time that screen has loaded its module and
 * started the camera, the gesture is long over.
 *
 * Android does not need this and is unaffected by it.
 */
export function unlockAudio() {
  if (unlocked) return;
  const audio = getPlayer();
  currentSrc = SILENCE;
  audio.src = SILENCE;
  audio.play().then(
    () => {
      unlocked = true;
    },
    () => {
      // Nothing to recover from: playNumber() still tries on its own, and on
      // Android it works without ever being unlocked.
    }
  );
}

/**
 * Plays the spoken number clip for `number` in the active language, from
 * public/audio/numbers/<number>_<lang>.mp3. Any feature can call this for any
 * number. Which numbers get announced and when is the calling feature's
 * decision.
 *
 * Fails with a console warning instead of throwing. A missing clip, or a
 * browser refusing to play, must not break the feature using it.
 */
export function playNumber(number) {
  const src = `${AUDIO_BASE}${number}_${getLang()}.mp3`;
  const audio = getPlayer();
  if (currentSrc !== src) {
    currentSrc = src;
    audio.src = src;
  } else {
    audio.currentTime = 0;
  }
  audio.play().catch((err) => {
    console.warn(`[audio] could not play "${src}":`, err.message);
  });
}
