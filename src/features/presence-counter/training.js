import {
  loadMobileNet,
  createClassifier,
  embedImage,
  serializeDataset,
  getEngineSignature,
} from '../../shared/ml-utils.js';
import { describeImagePixels, describeTensor } from '../../shared/ml-diagnostics.js';
import { LABELS } from './labeling.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * The KNN picks its k nearest neighbors from all examples pooled together and
 * then votes by raw count per class. If one class has far more examples than
 * the other, its neighbors dominate that pool by sheer density even when they
 * are not visually similar to the query, so an unbalanced training set biases
 * every prediction toward the larger class. Capping both classes to the same
 * shuffled count removes that bias.
 */
function balanceClasses(items) {
  const byLabel = {};
  for (const item of items) {
    (byLabel[item.label] ??= []).push(item);
  }
  const minCount = Math.min(...Object.values(byLabel).map((group) => group.length));
  return Object.values(byLabel).flatMap((group) => shuffle(group).slice(0, minCount));
}

/**
 * Computes a MobileNet embedding per labeled photo and feeds a KNN classifier.
 *
 * The labeled photos are discarded once training ends, so a per example record
 * of what each one looked like (pixel stats) and embedded to (vector stats) is
 * stored alongside the dataset. Without it, a classifier trained from blank or
 * undecoded images is indistinguishable at live time from a correct one.
 *
 * previewImage keeps exactly one photo, preferring a snap example, as the
 * profile list thumbnail. It is the only trace of the training set the user
 * ever sees again.
 */
export async function trainFromLabeledItems(items, { onProgress } = {}) {
  const model = await loadMobileNet();
  const classifier = createClassifier();
  const labeled = balanceClasses(items.filter((item) => item.label));

  console.log(
    '[presence-counter] training on',
    labeled.length,
    'balanced examples:',
    labeled.reduce((acc, item) => ({ ...acc, [item.label]: (acc[item.label] ?? 0) + 1 }), {})
  );

  const diagnostics = [];
  for (let i = 0; i < labeled.length; i += 1) {
    const item = labeled[i];
    const image = await loadImage(item.dataUrl);
    const embedding = embedImage(model, image);
    const pixelStats = describeImagePixels(image);
    const embeddingStats = await describeTensor(embedding, { head: 0 });
    diagnostics.push({
      label: item.label,
      naturalWidth: pixelStats.naturalWidth,
      naturalHeight: pixelStats.naturalHeight,
      pixelMean: pixelStats.meanRgb.reduce((sum, value) => sum + value, 0) / 3,
      pixelMax: pixelStats.max,
      l2: embeddingStats.l2,
      mean: embeddingStats.mean,
      nan: embeddingStats.nan,
    });
    classifier.addExample(embedding, item.label);
    embedding.dispose();
    onProgress?.(i + 1, labeled.length);
  }

  console.log('[presence-counter] classifier example counts:', classifier.getClassExampleCount());

  const dataset = await serializeDataset(classifier);
  console.log(
    '[presence-counter] serialized dataset shapes:',
    Object.fromEntries(Object.entries(dataset).map(([label, { shape }]) => [label, shape]))
  );
  console.log('[presence-counter] training diagnostics:', diagnostics);
  classifier.dispose();

  const previewItem = labeled.find((item) => item.label === LABELS.PERSON) ?? labeled[0];

  return { dataset, diagnostics, engine: getEngineSignature(), previewImage: previewItem?.dataUrl ?? null };
}
