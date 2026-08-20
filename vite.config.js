import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Must match the GitHub Pages base path. If it drifts, assets, the manifest
// and the service worker scope all break on the deployed site.
const REPO_NAME = 'paintball-training-utilities';

export default defineConfig(({ command }) => ({
  base: `/${REPO_NAME}/`,
  server: {
    // Listen on all interfaces so other devices (a phone on the same network)
    // can reach the dev server, not just localhost.
    host: true,
  },
  plugins: [
    // getUserMedia() needs a secure context. Localhost counts as one, a LAN IP
    // does not, so a phone hitting the dev server needs real HTTPS. This plugin
    // serves a self signed cert (one time browser warning). Builds are unaffected.
    command === 'serve' && basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Paintball Training Utilities',
        short_name: 'PB Utilities',
        description: 'Camera based training tools for paintball. Runs entirely on the device.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Workbox's defaults cover js/css/html/images only. wasm is added
        // because the WASM backend binaries are the inference engine on every
        // device whose GPU fails verification, so without them those devices
        // have no offline inference at all. mp3 covers the spoken number clips
        // in public/audio/numbers/, since training rarely happens on good signal.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,mp3}'],
        // The docs site is built into dist/docs and shares this origin, but it
        // is not part of the app. Precaching it would put unrelated pages into
        // the offline install and add the docs to every service worker update.
        globIgnores: ['docs/**'],
        // MobileNet weights (~5 MB) come from the TFHub CDN, so they are not
        // part of the build output and need their own runtime caching rule.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(storage\.googleapis\.com|tfhub\.dev)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mobilenet-model-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
}));
