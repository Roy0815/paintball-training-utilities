import { t } from '../../shared/i18n.js';

// Matched to the k of the live vote, so a class can always supply every one of
// the k nearest neighbours. More than this is better, there is no upper bound.
export const MIN_EXAMPLES_PER_CLASS = 6;
export const LABELS = { PERSON: 'person', EMPTY: 'empty' };

/**
 * Wraps captured photos as labelable items. Ignored items keep `label: null`,
 * so training's own `item.label` filter already excludes them.
 */
export function toLabelItems(dataUrls) {
  return dataUrls.map((dataUrl, index) => ({
    id: `f${index}`,
    dataUrl,
    label: null,
    ignored: false,
  }));
}

export function countByLabel(items) {
  return items.reduce(
    (counts, item) => {
      if (item.label) counts[item.label] = (counts[item.label] ?? 0) + 1;
      if (item.ignored) counts.ignored += 1;
      return counts;
    },
    { [LABELS.PERSON]: 0, [LABELS.EMPTY]: 0, ignored: 0 },
  );
}

/** Both classes need a minimum of examples before the KNN is worth training. */
export function validateLabels(items) {
  const counts = countByLabel(items);
  const missing = [];
  if (counts[LABELS.PERSON] < MIN_EXAMPLES_PER_CLASS) {
    missing.push(
      `${t('label.snap')}: ${counts[LABELS.PERSON]}/${MIN_EXAMPLES_PER_CLASS}`,
    );
  }
  if (counts[LABELS.EMPTY] < MIN_EXAMPLES_PER_CLASS) {
    missing.push(
      `${t('label.cover')}: ${counts[LABELS.EMPTY]}/${MIN_EXAMPLES_PER_CLASS}`,
    );
  }
  return { valid: missing.length === 0, missing, counts };
}
