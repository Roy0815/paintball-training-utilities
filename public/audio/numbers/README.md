# Number audio files

Drop spoken number recordings here as `<number>.mp3` (e.g. `10.mp3`, `55.mp3`).
Nothing else needs to change, since `playNumber()` in `shared/audio.js` builds
the path from the number alone. Until the files exist the app just stays silent.

Needed so far:

- **Snaptraining Dryrun** (live screen): every 10th snap, up to 100, so
  `10.mp3`, `20.mp3`, `30.mp3`, `40.mp3`, `50.mp3`, `60.mp3`, `70.mp3`,
  `80.mp3`, `90.mp3`, `100.mp3`.
- **A later module**: `1.mp3` through `5.mp3`.

Format: MP3, mono is fine. Keep the clips short, just the spoken number with no
lead-in silence, so playback feels immediate. Any other extension needs a
matching change in `shared/audio.js`.
