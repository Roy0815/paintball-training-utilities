export async function startCamera(videoEl, facingMode = 'environment') {
  const stream = await navigator.mediaDevices.getUserMedia({
    // Pinning a target resolution keeps repeated getUserMedia() calls (capture
    // and live are separate sessions) on the same negotiated resolution. Phone
    // cameras pick a different one per session far more readily than desktop
    // webcams do, and since frames are center cropped to a square, a different
    // source aspect ratio means the square covers a different field of view.
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

export function stopCamera(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * The largest square from the middle of the frame. MobileNet stretches whatever
 * it gets to 224x224 without cropping of its own and was trained on roughly
 * square images, so a 9:16 portrait frame would distort far enough to shift
 * embeddings. A 4:3 webcam frame is a mild stretch, a portrait phone frame is
 * twice as extreme in the other direction.
 */
function getCropRect(videoEl) {
  const frameWidth = videoEl.videoWidth;
  const frameHeight = videoEl.videoHeight;
  const side = Math.min(frameWidth, frameHeight);
  return {
    sourceX: Math.round((frameWidth - side) / 2),
    sourceY: Math.round((frameHeight - side) / 2),
    side,
  };
}

export function captureFrameCanvas(videoEl) {
  const { sourceX, sourceY, side } = getCropRect(videoEl);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(side, 1);
  canvas.height = Math.max(side, 1);
  canvas
    .getContext('2d')
    .drawImage(
      videoEl,
      sourceX,
      sourceY,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  return canvas;
}

export function captureFrameDataUrl(videoEl) {
  return captureFrameCanvas(videoEl).toDataURL('image/jpeg', 0.85);
}

/**
 * Draws the same crop into a canvas the caller owns. captureFrameCanvas()
 * allocates and discards one per call, which is fine for a single capture but
 * wasteful for a continuously updating live preview.
 */
export function drawCroppedFrame(videoEl, targetCanvas) {
  const { sourceX, sourceY, side } = getCropRect(videoEl);
  const size = Math.max(side, 1);
  if (targetCanvas.width !== size || targetCanvas.height !== size) {
    targetCanvas.width = size;
    targetCanvas.height = size;
  }
  targetCanvas
    .getContext('2d')
    .drawImage(videoEl, sourceX, sourceY, side, side, 0, 0, size, size);
}

/**
 * Captures `count` frames at `intervalMs` and resolves with their data URLs.
 * Cancellable mid series, including during the optional `startDelayMs` lead
 * in. That lead in exists because the person being photographed is usually the
 * one holding the phone, and without it the first few captures are spent
 * watching them walk into position.
 */
export function captureSeries(
  videoEl,
  { count, intervalMs, startDelayMs = 0, onCapture, onCountdown, isCancelled },
) {
  return new Promise((resolve) => {
    const frames = [];

    function captureLoop() {
      const timer = setInterval(() => {
        if (isCancelled?.()) {
          clearInterval(timer);
          resolve(frames);
          return;
        }
        const dataUrl = captureFrameDataUrl(videoEl);
        frames.push(dataUrl);
        onCapture?.(dataUrl, frames.length, count);
        if (frames.length >= count) {
          clearInterval(timer);
          resolve(frames);
        }
      }, intervalMs);
    }

    if (startDelayMs <= 0) {
      captureLoop();
      return;
    }

    const tickMs = 100;
    let remaining = startDelayMs;
    onCountdown?.(remaining);
    const countdownTimer = setInterval(() => {
      if (isCancelled?.()) {
        clearInterval(countdownTimer);
        resolve(frames);
        return;
      }
      remaining -= tickMs;
      onCountdown?.(Math.max(remaining, 0));
      if (remaining <= 0) {
        clearInterval(countdownTimer);
        captureLoop();
      }
    }, tickMs);
  });
}
