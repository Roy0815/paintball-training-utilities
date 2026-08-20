# Troubleshooting

## "Camera access failed"

- The page has to be served over HTTPS. Browsers only allow camera access in a
  secure context, and the deployed app is on HTTPS already.
- Check the camera permission in your browser's site settings. Once you decline
  it, the app cannot ask again.
- Close other apps that are using the camera. On some phones only one app may
  hold the camera at a time.
- Try the other camera. Some devices reject a specific facing mode.

## The counter does not move

Work through this in order:

1. **Look at the status line.** If it shows sensible percentages that change
   when you move, the model works and only the threshold is being missed. Move
   further out of cover, or retrain with clearer photos.
2. **Check whether the phone is where it was during training.** This is the most
   common cause by far. A different angle or distance is a different picture to
   the model.
3. **Check the lighting.** Same reason.
4. **Retrain the position.** Faster than diagnosing, and fixes most cases.

## The percentages are stuck at 100 and 0

If one class sits at 100% no matter what the camera sees, the prediction is not
reacting to the image at all. That is a different problem from bad accuracy.

Check for a warning below the counter about the engine (see the next section),
and retrain if it is there. If there is no warning, the **🔬 Diagnose** button
on the live screen produces a technical report, and **📋 Debug-Log kopieren**
copies it to the clipboard so it can be pasted into a bug report. The
[technical documentation](/technical/ml-backend) explains how to read it.

## Warning: trained with one engine, running on another

The app picks the fastest way to run the model that also passes a correctness
check on your device. If that choice changes between training and live use, the
stored model and the running engine no longer speak the same language, and the
predictions become meaningless rather than merely worse.

The fix is always the same: **retrain the snapshot position**. It also appears
if you switched the engine manually with the ⚙️ button, which is a debugging
tool and not meant for normal use.

## No sound on every tenth rep

The spoken number clips are not part of the app yet. Once they are added, the
callouts work without any change to your snapshot positions.

## Reps are being missed

The status line updates once per classified frame. If the phone is slow, there
is a real gap between frames and a very fast snap out can fall between two of
them. Try snapping with a brief hold at the top, or use a ROI so there is less
picture to process.

## Nothing works offline

The image recognition model is downloaded once, on the first training or live
run, and is about 5 MB. Until that has happened at least once with an internet
connection, the app cannot run offline. Everything else is already cached when
you install it.

## My snapshot positions are gone

They live in the browser's storage on that one device. Clearing browsing data
for the site, uninstalling the installed app, or opening the app in a different
browser or on a different phone all mean starting with an empty list. There is
no sync and no backup.
