import { defineConfig } from 'vitepress';

// The app itself is deployed to /paintball-training-utilities/ and these docs
// to /paintball-training-utilities/docs/. Both live in the same GitHub Pages
// artifact, so the docs build writes into the app's dist/ tree rather than
// deploying separately. Vite empties dist/ first, then this build appends,
// which is why the order in the root build script matters.
const BASE = '/paintball-training-utilities/docs/';

function guideSidebar(prefix, texts) {
  return [
    {
      text: texts.guide,
      items: [
        { text: texts.guideOverview, link: `${prefix}/guide/` },
        { text: texts.guideSnaptraining, link: `${prefix}/guide/snaptraining-dryrun` },
        { text: texts.guideTroubleshooting, link: `${prefix}/guide/troubleshooting` },
      ],
    },
  ];
}

function technicalSidebar(prefix, texts) {
  return [
    {
      text: texts.technical,
      items: [
        { text: texts.techOverview, link: `${prefix}/technical/` },
        { text: texts.techStructure, link: `${prefix}/technical/project-structure` },
        { text: texts.techShell, link: `${prefix}/technical/app-shell` },
        { text: texts.techFeature, link: `${prefix}/technical/snaptraining-dryrun` },
        { text: texts.techBackend, link: `${prefix}/technical/ml-backend` },
        { text: texts.techDevelopment, link: `${prefix}/technical/development` },
      ],
    },
  ];
}

const EN = {
  guide: 'User guide',
  guideOverview: 'Overview',
  guideSnaptraining: 'Snaptraining Dryrun',
  guideTroubleshooting: 'Troubleshooting',
  technical: 'Technical documentation',
  techOverview: 'Architecture',
  techStructure: 'Project structure',
  techShell: 'App shell',
  techFeature: 'Snaptraining Dryrun internals',
  techBackend: 'ML backend and verification',
  techDevelopment: 'Development workflow',
};

const DE = {
  guide: 'Anwenderdoku',
  guideOverview: 'Überblick',
  guideSnaptraining: 'Snaptraining Dryrun',
  guideTroubleshooting: 'Fehlerbehebung',
  technical: 'Technische Doku',
  techOverview: 'Architektur',
  techStructure: 'Projektstruktur',
  techShell: 'App-Shell',
  techFeature: 'Snaptraining Dryrun im Detail',
  techBackend: 'ML-Backend und Verifikation',
  techDevelopment: 'Entwicklungs-Workflow',
};

export default defineConfig({
  title: 'Paintball Training Utilities',
  base: BASE,
  outDir: '../dist/docs',
  lastUpdated: true,
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      description: 'How to use and how to develop the Paintball Training Utilities PWA.',
      themeConfig: {
        nav: [
          { text: 'User guide', link: '/guide/', activeMatch: '^/guide/' },
          { text: 'Technical', link: '/technical/', activeMatch: '^/technical/' },
        ],
        sidebar: {
          '/guide/': guideSidebar('', EN),
          '/technical/': technicalSidebar('', EN),
        },
        outline: { label: 'On this page' },
        docFooter: { prev: 'Previous', next: 'Next' },
        darkModeSwitchLabel: 'Appearance',
        returnToTopLabel: 'Back to top',
        langMenuLabel: 'Change language',
      },
    },
    de: {
      label: 'Deutsch',
      lang: 'de-DE',
      link: '/de/',
      description: 'Bedienung und Entwicklung der Paintball Training Utilities PWA.',
      themeConfig: {
        nav: [
          { text: 'Anwenderdoku', link: '/de/guide/', activeMatch: '^/de/guide/' },
          { text: 'Technisch', link: '/de/technical/', activeMatch: '^/de/technical/' },
        ],
        sidebar: {
          '/de/guide/': guideSidebar('/de', DE),
          '/de/technical/': technicalSidebar('/de', DE),
        },
        outline: { label: 'Auf dieser Seite' },
        docFooter: { prev: 'Zurück', next: 'Weiter' },
        darkModeSwitchLabel: 'Erscheinungsbild',
        returnToTopLabel: 'Nach oben',
        langMenuLabel: 'Sprache wechseln',
        lastUpdatedText: 'Zuletzt aktualisiert',
      },
    },
  },
  themeConfig: {
    search: {
      provider: 'local',
      options: {
        // The search box chrome is English by default, so the German locale
        // needs its own strings even though the index itself is per locale.
        locales: {
          de: {
            translations: {
              button: { buttonText: 'Suchen', buttonAriaLabel: 'Suchen' },
              modal: {
                displayDetails: 'Details anzeigen',
                resetButtonTitle: 'Suche zurücksetzen',
                backButtonTitle: 'Suche schließen',
                noResultsText: 'Keine Ergebnisse für',
                footer: { selectText: 'auswählen', navigateText: 'wechseln', closeText: 'schließen' },
              },
            },
          },
        },
      },
    },
  },
});
