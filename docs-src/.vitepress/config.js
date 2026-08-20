import { defineConfig } from 'vitepress';

// The app itself is deployed to /paintball-training-utilities/ and these docs
// to /paintball-training-utilities/docs/. Both live in the same GitHub Pages
// artifact, so the docs build writes into the app's dist/ tree rather than
// deploying separately. Vite empties dist/ first, then this build appends,
// which is why the order in the root build script matters.
export default defineConfig({
  title: 'Paintball Training Utilities',
  description: 'How to use and how to develop the Paintball Training Utilities PWA.',
  base: '/paintball-training-utilities/docs/',
  outDir: '../dist/docs',
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'User guide', link: '/guide/', activeMatch: '^/guide/' },
      { text: 'Technical', link: '/technical/', activeMatch: '^/technical/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'User guide',
          items: [
            { text: 'Overview', link: '/guide/' },
            { text: 'Snaptraining Dryrun', link: '/guide/snaptraining-dryrun' },
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          ],
        },
      ],
      '/technical/': [
        {
          text: 'Technical documentation',
          items: [
            { text: 'Architecture', link: '/technical/' },
            { text: 'Project structure', link: '/technical/project-structure' },
            { text: 'App shell', link: '/technical/app-shell' },
            { text: 'Snaptraining Dryrun internals', link: '/technical/snaptraining-dryrun' },
            { text: 'ML backend and verification', link: '/technical/ml-backend' },
            { text: 'Development workflow', link: '/technical/development' },
          ],
        },
      ],
    },
    outline: { label: 'On this page' },
    search: { provider: 'local' },
  },
});
