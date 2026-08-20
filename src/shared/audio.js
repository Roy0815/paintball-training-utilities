const AUDIO_BASE = `${import.meta.env.BASE_URL}audio/numbers/`;

// One Audio object per number instead of a new one per call, so repeat
// announcements (the same milestone, or a future module counting 1 to 5 over
// and over) do not refetch and redecode every time.
const audioCache = new Map();

/**
 * Plays the spoken number clip for `number`, from public/audio/numbers/. Any
 * feature can call this for any number. Which numbers get announced and when
 * is the calling feature's decision.
 *
 * Fails with a console warning instead of throwing, because this is wired up
 * before the recordings exist and a missing or blocked clip must not break the
 * feature using it.
 */
export function playNumber(number) {
  const src = `${AUDIO_BASE}${number}.mp3`;
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
