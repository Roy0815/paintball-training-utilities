/**
 * Central feature registry. Every tool on the home screen is one entry here.
 * Adding a tool means creating src/features/<name>/ with a mount(container)
 * entry point and registering it below. Nothing in the app shell changes.
 * mountSettings(container) is optional; a feature without one just does not
 * show up in the settings screen's list.
 *
 * mount() is a dynamic import so a feature's dependencies (snaptraining-dryrun
 * pulls in all of TensorFlow.js) only load once the user opens it, instead of
 * on every app boot.
 *
 * Names and descriptions are i18n keys, not display strings: this module is
 * static and loaded before a language is picked, so the lookup has to happen
 * in whichever screen renders them.
 *
 * A tile shows `iconUrl` when the feature ships an image in public/icons/, and
 * falls back to the `icon` emoji otherwise. The URL is built from BASE_URL
 * because GitHub Pages serves the app from a subpath.
 */
export const features = [
  {
    id: 'snaptraining-dryrun',
    nameKey: 'feature.snaptrainingDryrun.name',
    iconUrl: `${import.meta.env.BASE_URL}icons/temple.png`,
    descriptionKey: 'feature.snaptrainingDryrun.description',
    async mount(container) {
      const { mount } = await import('./snaptraining-dryrun/ui/index.js');
      return mount(container);
    },
    async mountSettings(container) {
      const { renderSettingsScreen } = await import('./snaptraining-dryrun/ui/screens/settings.js');
      renderSettingsScreen(container, {
        onBack: () => {
          window.location.hash = '#/settings';
        },
      });
    },
  },
];

export function getFeature(id) {
  return features.find((feature) => feature.id === id);
}
