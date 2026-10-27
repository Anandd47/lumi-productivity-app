import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Lumi — Make room for progress',
        short_name: 'Lumi',
        description: 'A little progress, every day.',
        theme_color: '#0d1014',
        background_color: '#0d1014',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/lumi-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/lumi-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/lumi-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
