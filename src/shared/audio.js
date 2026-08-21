import { getLang } from './i18n.js';

const AUDIO_BASE = `${import.meta.env.BASE_URL}audio/numbers/`;

// One Audio object per clip instead of a new one per call, so repeat
// announcements do not refetch and redecode every time. Keyed by the full
// source URL, so the two languages hold their own entries and switching
// language mid session picks up the right voice on the next call.
const audioCache = new Map();

/**
 * Plays the spoken number clip for `number` in the active language, from
 * public/audio/numbers/<number>_<lang>.mp3. Any feature can call this for any
 * number. Which numbers get announced and when is the calling feature's
 * decision.
 *
 * Fails with a console warning instead of throwing. A missing clip, or a
 * browser that refuses to play without its own gesture, must not break the
 * feature using it.
 */
export function playNumber(number) {
  const src = `${AUDIO_BASE}${number}_${getLang()}.mp3`;
  let audio = audioCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audioCache.set(src, audio);
  } else {
    audio.currentTime = 0;
  }
  audio.play().catch((err) => {
    console.warn(`[audio] could not play "${src}":`, err.message);
  });
}
