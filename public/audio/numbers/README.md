# Number audio files

Spoken number recordings, one per number and language, named
`<number>_<lang>.mp3` (e.g. `10_de.mp3`, `55_en.mp3`). `playNumber()` in
`shared/audio.js` builds the path from the number and the active language, so
adding a number means dropping in both files and nothing else.

`<lang>` is one of the codes in `LANGUAGES` in `shared/i18n.js`, currently `de`
and `en`. A number missing in one language is silent only in that language, the
app keeps working.

Present so far: 1 to 5, then every fifth number from 10 through 100.

The live screen of Snaptraining Dryrun announces every tenth rep up to 100, so
it uses `10`, `20` … `100`. The clips in between are already recorded for a
finer step or another module.

Format: MP3, mono is fine. Keep the clips short, just the spoken number with no
lead-in silence, so playback feels immediate. Any other extension needs a
matching change in `shared/audio.js`.
