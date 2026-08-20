export async function startCamera(videoEl, facingMode = 'environment') {
  const stream = await navigator.mediaDevices.getUserMedia({
    // Pinning a target resolution keeps repeated getUserMedia() calls (setup,
    // capture and live are separate sessions) on the same negotiated
    // resolution. Phone cameras pick a different one per call far more readily
    // than desktop webcams do, which would silently shift what a stored
    // fractional ROI actually crops.
    video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
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
 * Crops to the ROI (fractions of the source frame) when one is set. Without a
 * ROI it center crops to a square rather than using the raw frame, because
 * MobileNet stretches whatever it gets to a square 224x224 without cropping
 * and was itself trained on roughly square, center cropped images. A landscape
 * webcam frame (4:3) is a mild stretch, but a portrait phone frame (9:16) is
 * twice as extreme in the other direction and distorts far enough to shift
 * embeddings.
 */
function getCropRect(videoEl, roi) {
  const frameWidth = videoEl.videoWidth;
  const frameHeight = videoEl.videoHeight;
  if (roi) {
    return {
      sourceX: Math.round(roi.x * frameWidth),
      sourceY: Math.round(roi.y * frameHeight),
      sourceWidth: Math.round(roi.w * frameWidth),
      sourceHeight: Math.round(roi.h * frameHeight),
    };
  }
  const side = Math.min(frameWidth, frameHeight);
  return {
    sourceX: Math.round((frameWidth - side) / 2),
    sourceY: Math.round((frameHeight - side) / 2),
    sourceWidth: side,
    sourceHeight: side,
  };
}

export function captureFrameCanvas(videoEl, roi = null) {
  const { sourceX, sourceY, sourceWidth, sourceHeight } = getCropRect(videoEl, roi);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(sourceWidth, 1);
  canvas.height = Math.max(sourceHeight, 1);
  canvas
    .getContext('2d')
    .drawImage(videoEl, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function captureFrameDataUrl(videoEl, roi = null) {
  return captureFrameCanvas(videoEl, roi).toDataURL('image/jpeg', 0.85);
}

/**
 * Draws the same crop into a canvas the caller owns. captureFrameCanvas()
 * allocates and discards one per call, which is fine for a single capture but
 * wasteful for a continuously updating live preview.
 */
export function drawCroppedFrame(videoEl, roi, targetCanvas) {
  const { sourceX, sourceY, sourceWidth, sourceHeight } = getCropRect(videoEl, roi);
  const width = Math.max(sourceWidth, 1);
  const height = Math.max(sourceHeight, 1);
  if (targetCanvas.width !== width || targetCanvas.height !== height) {
    targetCanvas.width = width;
    targetCanvas.height = height;
  }
  targetCanvas.getContext('2d').drawImage(videoEl, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
}

/**
 * The video element's displayed box differs from its native resolution because
 * the preview uses object-fit: contain, so it is letterboxed rather than
 * cropped. ROI selection happens in displayed pixels, so this rect is what
 * maps a pointer position back to fractions of the captured frame.
 */
export function getVideoDisplayRect(videoEl) {
  const boxWidth = videoEl.clientWidth;
  const boxHeight = videoEl.clientHeight;
  const frameWidth = videoEl.videoWidth;
  const frameHeight = videoEl.videoHeight;
  if (!frameWidth || !frameHeight) return { x: 0, y: 0, width: boxWidth, height: boxHeight };

  const boxRatio = boxWidth / boxHeight;
  const frameRatio = frameWidth / frameHeight;
  let width, height, x, y;
  if (frameRatio > boxRatio) {
    width = boxWidth;
    height = boxWidth / frameRatio;
    x = 0;
    y = (boxHeight - height) / 2;
  } else {
    height = boxHeight;
    width = boxHeight * frameRatio;
    y = 0;
    x = (boxWidth - width) / 2;
  }
  return { x, y, width, height };
}

/** Lets the user drag a rectangle over the video preview to define a ROI. */
export function attachRoiSelector(overlayEl, videoEl, initialRoi = null) {
  let roi = initialRoi;
  let dragStart = null;

  function render() {
    overlayEl.innerHTML = '';
    if (!roi) return;
    const rect = getVideoDisplayRect(videoEl);
    const box = document.createElement('div');
    box.className = 'roi-box';
    box.style.left = `${rect.x + roi.x * rect.width}px`;
    box.style.top = `${rect.y + roi.y * rect.height}px`;
    box.style.width = `${roi.w * rect.width}px`;
    box.style.height = `${roi.h * rect.height}px`;
    overlayEl.appendChild(box);
  }

  function pointToFraction(clientX, clientY) {
    const bounds = overlayEl.getBoundingClientRect();
    const rect = getVideoDisplayRect(videoEl);
    const fractionX = (clientX - bounds.left - rect.x) / rect.width;
    const fractionY = (clientY - bounds.top - rect.y) / rect.height;
    return { x: Math.min(Math.max(fractionX, 0), 1), y: Math.min(Math.max(fractionY, 0), 1) };
  }

  function onPointerDown(event) {
    overlayEl.setPointerCapture(event.pointerId);
    dragStart = pointToFraction(event.clientX, event.clientY);
  }

  function onPointerMove(event) {
    if (!dragStart) return;
    const current = pointToFraction(event.clientX, event.clientY);
    roi = {
      x: Math.min(dragStart.x, current.x),
      y: Math.min(dragStart.y, current.y),
      w: Math.abs(current.x - dragStart.x),
      h: Math.abs(current.y - dragStart.y),
    };
    render();
  }

  function onPointerUp() {
    // A stray tap produces a near zero rectangle, which would crop the frame
    // down to nothing. Treat anything that small as "no ROI".
    if (roi && (roi.w < 0.02 || roi.h < 0.02)) roi = null;
    dragStart = null;
    render();
  }

  overlayEl.addEventListener('pointerdown', onPointerDown);
  overlayEl.addEventListener('pointermove', onPointerMove);
  overlayEl.addEventListener('pointerup', onPointerUp);
  render();

  return {
    getRoi: () => roi,
    clear() {
      roi = null;
      render();
    },
    refresh: render,
    destroy() {
      overlayEl.removeEventListener('pointerdown', onPointerDown);
      overlayEl.removeEventListener('pointermove', onPointerMove);
      overlayEl.removeEventListener('pointerup', onPointerUp);
    },
  };
}

/**
 * Captures `count` frames at `intervalMs` and resolves with their data URLs.
 * Cancellable mid series, including during the optional `startDelayMs` lead
 * in. That lead in exists because the person being photographed is usually the
 * one holding the phone, and without it the first few captures are spent
 * watching them walk into position.
 */
export function captureSeries(videoEl, { count, intervalMs, roi, startDelayMs = 0, onCapture, onCountdown, isCancelled }) {
  return new Promise((resolve) => {
    const frames = [];

    function captureLoop() {
      const timer = setInterval(() => {
        if (isCancelled?.()) {
          clearInterval(timer);
          resolve(frames);
          return;
        }
        const dataUrl = captureFrameDataUrl(videoEl, roi);
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
