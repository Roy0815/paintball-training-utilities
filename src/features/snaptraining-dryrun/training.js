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

/**
 * Computes a MobileNet embedding per labeled photo and feeds a KNN classifier.
 *
 * Every labeled photo is used, class counts are deliberately not equalized.
 * Capping both classes to the smaller one did remove a density bias in the KNN
 * vote, since it picks its k nearest neighbours from all examples pooled
 * together, but it also threw away labeled photos. The capture guidance now
 * asks for a minimum per class rather than an even split, which makes an
 * imbalance intentional: one set of cover photos can stand against several
 * different snap positions.
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
  const labeled = items.filter((item) => item.label);

  console.log(
    '[snaptraining] training on',
    labeled.length,
    'examples:',
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

  console.log('[snaptraining] classifier example counts:', classifier.getClassExampleCount());

  const dataset = await serializeDataset(classifier);
  console.log(
    '[snaptraining] serialized dataset shapes:',
    Object.fromEntries(Object.entries(dataset).map(([label, { shape }]) => [label, shape]))
  );
  console.log('[snaptraining] training diagnostics:', diagnostics);
  classifier.dispose();

  const previewItem = labeled.find((item) => item.label === LABELS.PERSON) ?? labeled[0];

  return { dataset, diagnostics, engine: getEngineSignature(), previewImage: previewItem?.dataUrl ?? null };
}
