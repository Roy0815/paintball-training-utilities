# Snaptraining Dryrun

Snaptraining Dryrun counts snap out repetitions. You prop the phone up so it
sees your position, and it counts every time you come out of cover and go back
in, so you can drill without keeping count yourself.

It does this with a model you train yourself for one specific position. The
model does not recognise "a person", it recognises the difference between two
pictures of your position: you in cover, and you snapped out. That is why it
works with any wall, bunker or door frame, and why it has to be retrained when
you move the phone.

A trained position is called a **snapshot position**. You can keep as many as
you like, one per spot you regularly train at.

## The flow at a glance

1. Create a snapshot position and aim the camera.
2. Capture a series of photos while you drill.
3. Label each photo as snap or cover.
4. Train, which takes seconds.
5. Run the live counter.

## 1. Create a snapshot position

Press **+ New snapshot position** and give it a name that tells you where it
was, for example "Maya temple" or "dorito 1".

Choose the front or rear camera. The screen also shows the one thing that
decides whether the training set is usable: at least six photos of the empty
cover, and at least six of every snap position you want counted. More is
better.

That is the whole form. The camera opens on the next screen, so that is where
you aim the phone.

Note that the app analyses a square cut from the middle of the frame rather than
the whole picture, because the recognition model expects roughly square images.
Whatever matters should be near the middle.

## 2. Capture training photos

The camera opens by itself when this screen appears. If your browser refuses to
open it unasked, a **Start camera** button shows up at the top; press it once
and it disappears.

Place the phone exactly where it will stand later. Everything the model learns
depends on this viewpoint. The preview shows exactly the cut that will be saved,
so what you see is what the model gets.

Three settings:

| Setting | What it does |
| --- | --- |
| Number of photos | How many photos the series takes. 30 is a good starting point. |
| Interval (ms) | Time between two photos. 1000 means one photo per second. |
| Start delay (s) | Countdown before the first photo, so you can get into position. |

Press **Capture series** and drill normally for the length of the series: go
into cover, snap out, go back into cover. Aim for **roughly the same number of
photos in cover as snapped out**. Photos appear as thumbnails while the series
runs. **Stop capture** ends it early, **Retake series** starts over.

If you set a start delay, it counts down out loud, every five seconds and then
every second from five down to one, and a shutter sound plays for every photo
taken. Both can be turned off, see [sound settings](#sound-settings) below.

Then press **Continue to labeling**.

## 3. Label the photos

Each photo is shown as a card:

- **Swipe right** or press **✓ Snap** if you are snapped out in the photo.
- **Swipe left** or press **✕ Cover** if you are fully in cover.
- Press **Ignore** for photos that show neither clearly, for example a shot
  taken mid movement. Ignored photos are not used for training.
- **‹ Previous photo** goes back if you mislabeled one.

Be strict here. A blurred half way photo labeled as snap teaches the model that
half way counts as a rep, and it will count that way later.

At the end you get a summary with the counts. You need at least **6 photos per
class** before training can start, because that is how many photos the live
counter compares each frame against. See
[how the matching works](#how-the-matching-works).

## 4. Train

Press **Continue to training**. A progress bar shows the photos being processed.
This runs on the device, needs no internet after the first model download, and
usually takes a few seconds.

The training photos are deleted afterwards. One of them is kept as the thumbnail
in the list.

## 5. Count live

Tap a trained snapshot position in the list to start live counting.

The camera opens right away, so you can check the phone is still positioned
correctly, but nothing is counted yet.

- The **big number** is the current count.
- Below it, the **peek stats** show the average, minimum and maximum duration
  of a snap-out in milliseconds, i.e. how long you were visible between
  clearing cover and being back in it. They read as dashes until the first
  one completes.
- The **status line** shows how confident the model currently is for each
  class and whether it considers you snapped out or in cover, once counting
  is running.

Set the **start timer**, in seconds, and press **Start training**. That is how
long you get to walk into position after pressing it, counted down out loud
the same way the capture screen's own start delay is (see
[training sounds](#training-sounds)). Counting only begins once it reaches
zero. **Stop training** is available immediately, including during the
countdown itself, and returns to the same start screen without losing the
count or the peek stats, so you can start another set right away.

A rep is counted, and its peek duration recorded, on the transition **back**
into cover, not on the transition out of it, since the app only knows how long
a snap-out took once it is over. A snap-out still in progress when you press
**Stop training** is therefore not counted at all: that keeps the walk back to
the phone at the end of a set from being recorded as an abnormally slow peek.
**Remove last value** drops the most recently counted peek from the average,
minimum and maximum by hand, for the case where even a completed one was not
representative. **Reset counter** sets the count and the peek stats back to
zero together.

The app is deliberately slightly conservative: a state only changes after it has
been seen twice in a row, which prevents a single misread frame from producing a
phantom rep.

Every tenth rep up to 100 is announced out loud, so you do not have to look at
the screen. The callout follows the app's language, so switching to English
switches the voice. Turn it off the same way as the capture screen's sounds,
see the next section.

## Sound settings

The camera shutter sound and the spoken countdown while capturing, and the
every tenth rep callout during live counting, can each be turned off from the
gear icon on the home screen: **Settings**, then **Snaptraining Dryrun**. Both
switches default to on.

## How the matching works

Nothing in the app recognises "a person". It compares pictures with pictures.

During training, every labeled photo is turned into a list of 1280 numbers, a
kind of fingerprint of what that picture looks like. Those fingerprints are all
that gets stored, the photos themselves are deleted afterwards.

While counting, every camera frame gets the same fingerprint, which is then
compared against every stored one. The app keeps the **six most similar training
photos**, and the percentages on screen are nothing more than how those six
voted:

| The six closest training photos | Snap | Cover | Counts? |
| --- | --- | --- | --- |
| 6 snap | 100% | 0% | yes |
| 5 snap, 1 cover | 83% | 17% | yes |
| 4 snap, 2 cover | 67% | 33% | yes |
| 3 snap, 3 cover | 50% | 50% | no |
| 2 snap, 4 cover | 33% | 67% | no |

A rep needs more than 60%, and there is no step at exactly 60%, so in practice
**four of the six closest photos have to be snap photos**.

Three things follow from that:

- **Your own photos are the only yardstick.** A frame is never judged against
  some general idea of what a person looks like, only against the photos you
  labeled. That is why the phone has to stand where it stood during training,
  and why the light should be comparable.
- **Six per class is a floor, not a target.** With exactly six cover photos,
  every single one of them has to land in the top six for a unanimous cover
  vote. More photos mean more chances that something close to the current frame
  is in there.
- **A snap position you never photographed cannot win a vote.** If you drill two
  different snap-outs at one spot, photograph both, at least six each.

## Getting good results

- **Place the phone the same way as during training.** The model learns one
  viewpoint. A different angle or distance is a different picture.
- **Keep the lighting comparable.** Training in daylight and running at night
  under a lamp is a different picture too.
- **Really drill during the capture series.** Photos posed to look right teach
  poses, not reps.
- **Give every class enough photos.** Six is the minimum, more is better, and
  every distinct snap position needs its own six.
- **Keep moving background out of the frame.** Anything that moves in the
  picture is something the model has to learn to ignore.
- **Retrain after moving the phone.** It takes a minute and is the fix for
  almost every accuracy problem.

## Retraining and deleting

**Retrain** on a card keeps the name and camera, and takes you straight into a
new capture series. Use it when the position has changed or the counting
became unreliable.

**Delete** removes the snapshot position including its counter and history.
There is a confirmation prompt, and no undo.
