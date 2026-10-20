import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.png'],
      manifest: {
        name: 'Recipe Box',
        short_name: 'レシピ',
        description: '自分だけのレシピ帳',
        lang: 'ja',
        start_url: '/',
        display: 'standalone',
        background_color: '#f7f2ea',
        theme_color: '#f7f2ea',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // レシピ写真はオフラインでも見られるようにキャッシュ
            urlPattern: ({ url }) => url.hostname === 'firebasestorage.googleapis.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'recipe-photos',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
});
