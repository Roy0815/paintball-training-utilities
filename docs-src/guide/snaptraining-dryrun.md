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
was, for example "hallway mirror" or "garage left".

Choose the front or rear camera and press **Start camera**. Place the phone
exactly where it will stand later. Everything the model learns depends on this
viewpoint.

Optionally drag a rectangle over the preview to define a **ROI**, a region of
interest. Only that part of the picture is then analysed. This is worth doing
when something moves in the background that has nothing to do with your reps,
for example a street, a TV or other players. Press **Clear ROI** to remove it
again.

Without a ROI, the app uses a square cut from the middle of the frame rather
than the whole picture, because the recognition model expects roughly square
images.

## 2. Capture training photos

The preview now shows exactly the cut that will be saved, so what you see is
what the model will get.

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

At the end you get a summary with the counts. You need at least **5 photos per
class** before training can start.

## 4. Train

Press **Continue to training**. A progress bar shows the photos being processed.
This runs on the device, needs no internet after the first model download, and
usually takes a few seconds.

The training photos are deleted afterwards. One of them is kept as the thumbnail
in the list.

## 5. Count live

Tap a trained snapshot position in the list to start live counting.

- The **big number** is the current count.
- The **status line** below it shows how confident the model currently is for
  each class and whether it considers you snapped out or in cover.
- **Reset counter** sets the count back to zero.

A rep is counted on the transition from cover to snap, not every frame. Staying
snapped out counts once. The next rep only counts after the app has seen you
back in cover, so a single rep can never be double counted.

The app is deliberately slightly conservative: a state only changes after it has
been seen twice in a row, which prevents a single misread frame from producing a
phantom rep.

Every tenth rep up to 100 is announced out loud, so you do not have to look at
the screen. The spoken clips are not included yet, so this is silent until they
are added.

## Getting good results

- **Place the phone the same way as during training.** The model learns one
  viewpoint. A different angle or distance is a different picture.
- **Keep the lighting comparable.** Training in daylight and running at night
  under a lamp is a different picture too.
- **Really drill during the capture series.** Photos posed to look right teach
  poses, not reps.
- **Balance the two classes.** Roughly equal numbers of cover and snap photos.
- **Use a ROI when the background moves.** Everything moving inside the analysed
  area is something the model has to learn to ignore.
- **Retrain after moving the phone.** It takes a minute and is the fix for
  almost every accuracy problem.

## Retraining and deleting

**Retrain** on a card keeps the name, camera and ROI, and takes you straight
into a new capture series. Use it when the position has changed or the counting
became unreliable.

**Delete** removes the snapshot position including its counter and history.
There is a confirmation prompt, and no undo.
