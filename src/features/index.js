/**
 * Central feature registry. Every tool on the home screen is one entry here.
 * Adding a tool means creating src/features/<name>/ with a mount(container)
 * entry point and registering it below. Nothing in the app shell changes.
 *
 * mount() is a dynamic import so a feature's dependencies (presence-counter
 * pulls in all of TensorFlow.js) only load once the user opens it, instead of
 * on every app boot.
 *
 * Names and descriptions are i18n keys, not display strings: this module is
 * static and loaded before a language is picked, so the lookup has to happen
 * in whichever screen renders them.
 */
export const features = [
  {
    id: 'presence-counter',
    nameKey: 'feature.presenceCounter.name',
    icon: '📷',
    descriptionKey: 'feature.presenceCounter.description',
    async mount(container) {
      const { mount } = await import('./presence-counter/ui/index.js');
      return mount(container);
    },
  },
];

export function getFeature(id) {
  return features.find((feature) => feature.id === id);
}
