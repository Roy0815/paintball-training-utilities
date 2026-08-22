import { LABELS, validateLabels } from '../../labeling.js';
import { setHeader } from '../../../../app/shell.js';
import { t } from '../../../../shared/i18n.js';

const SWIPE_THRESHOLD_PX = 80;
const FLY_OUT_PX = 600;

export function renderLabelScreen(container, draft, { onBack, onNext }) {
  setHeader({ title: t('snap-dryrun.label.title'), onBack });

  let index = 0;

  function labelCurrent(label) {
    draft.items[index].label = label;
    draft.items[index].ignored = false;
    index += 1;
    render();
  }

  function ignoreCurrent() {
    draft.items[index].label = null;
    draft.items[index].ignored = true;
    index += 1;
    render();
  }

  function goBackOne() {
    index = Math.max(index - 1, 0);
    render();
  }

  function render() {
    if (index >= draft.items.length) renderSummary();
    else renderCard();
  }

  function renderSummary() {
    const { valid, missing, counts } = validateLabels(draft.items);
    container.innerHTML = `
      <section class="screen">
        <h2>${t('snap-dryrun.label.summaryTitle')}</h2>
        <p class="hint">${t('snap-dryrun.label.summaryCounts', {
          snap: counts[LABELS.PERSON],
          cover: counts[LABELS.EMPTY],
          ignored: counts.ignored,
        })}</p>
        ${!valid ? `<p class="error">${t('snap-dryrun.label.summaryMissing', { list: missing.join(', ') })}</p>` : ''}
        <button type="button" class="btn" id="prev-photo-btn">${t('snap-dryrun.label.prev')}</button>
        <button type="button" class="btn btn-primary" id="next-btn" ${valid ? '' : 'disabled'}>${t(
          'snap-dryrun.label.nextTrain',
        )}</button>
      </section>
    `;
    container
      .querySelector('#prev-photo-btn')
      .addEventListener('click', goBackOne);
    container.querySelector('#next-btn').addEventListener('click', onNext);
  }

  /** The label this photo already carries, for photos revisited via "previous". */
  function describeCurrentLabel(item) {
    if (item.ignored) return t('label.ignored');
    if (!item.label) return null;
    return item.label === LABELS.PERSON ? t('label.snap') : t('label.cover');
  }

  function renderCard() {
    const item = draft.items[index];
    const total = draft.items.length;
    const currentState = describeCurrentLabel(item);
    const currentLabelText = currentState
      ? ` · ${t('snap-dryrun.label.currentPrefix')}: ${currentState}`
      : '';

    container.innerHTML = `
      <section class="screen">
        <p class="hint">${t('snap-dryrun.label.hint')}</p>

        <div class="swipe-stage">
          <div class="swipe-card" id="swipe-card">
            <span class="swipe-tag swipe-tag-empty" id="tag-empty">${t('label.cover')}</span>
            <span class="swipe-tag swipe-tag-person" id="tag-person">${t('label.snap')}</span>
            <img src="${item.dataUrl}" draggable="false" />
          </div>
        </div>

        <div class="progress-row">
          <p class="hint">${t('snap-dryrun.label.photoCounter', { index: index + 1, total })}${currentLabelText}</p>
          <progress max="${total}" value="${index}"></progress>
        </div>

        <div class="swipe-buttons">
          <button type="button" class="btn btn-swipe" id="empty-btn">${t('snap-dryrun.label.btnCover')}</button>
          <button type="button" class="btn btn-swipe btn-primary" id="person-btn">${t('snap-dryrun.label.btnSnap')}</button>
        </div>
        <button type="button" class="btn btn-ignore" id="ignore-btn">${t('snap-dryrun.label.btnIgnore')}</button>
        <button type="button" class="btn" id="prev-photo-btn" ${index === 0 ? 'disabled' : ''}>${t(
          'snap-dryrun.label.prev',
        )}</button>
      </section>
    `;

    if (index > 0) {
      container
        .querySelector('#prev-photo-btn')
        .addEventListener('click', goBackOne);
    }
    container
      .querySelector('#empty-btn')
      .addEventListener('click', () => labelCurrent(LABELS.EMPTY));
    container
      .querySelector('#person-btn')
      .addEventListener('click', () => labelCurrent(LABELS.PERSON));
    container
      .querySelector('#ignore-btn')
      .addEventListener('click', ignoreCurrent);

    attachSwipeHandlers(container.querySelector('#swipe-card'), {
      tagPerson: container.querySelector('#tag-person'),
      tagEmpty: container.querySelector('#tag-empty'),
      onCommit: (direction) =>
        labelCurrent(direction === 'right' ? LABELS.PERSON : LABELS.EMPTY),
    });
  }

  render();
  return null;
}

function attachSwipeHandlers(cardEl, { tagPerson, tagEmpty, onCommit }) {
  let startX = 0;
  let dragging = false;

  function setDrag(deltaX) {
    cardEl.style.transform = `translateX(${deltaX}px) rotate(${deltaX / 20}deg)`;
    const progress = Math.min(Math.abs(deltaX) / SWIPE_THRESHOLD_PX, 1);
    tagPerson.style.opacity = deltaX > 0 ? progress : 0;
    tagEmpty.style.opacity = deltaX < 0 ? progress : 0;
  }

  function onPointerDown(event) {
    dragging = true;
    startX = event.clientX;
    cardEl.setPointerCapture(event.pointerId);
    cardEl.style.transition = 'none';
  }

  function onPointerMove(event) {
    if (!dragging) return;
    setDrag(event.clientX - startX);
  }

  function onPointerUp(event) {
    if (!dragging) return;
    dragging = false;
    const deltaX = event.clientX - startX;
    cardEl.style.transition = 'transform 0.2s ease';
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX) {
      const direction = deltaX > 0 ? 'right' : 'left';
      const flyTo = direction === 'right' ? FLY_OUT_PX : -FLY_OUT_PX;
      cardEl.style.transform = `translateX(${flyTo}px) rotate(${flyTo / 20}deg)`;
      setTimeout(() => onCommit(direction), 150);
    } else {
      setDrag(0);
    }
  }

  cardEl.addEventListener('pointerdown', onPointerDown);
  cardEl.addEventListener('pointermove', onPointerMove);
  cardEl.addEventListener('pointerup', onPointerUp);
  cardEl.addEventListener('pointercancel', onPointerUp);
}
