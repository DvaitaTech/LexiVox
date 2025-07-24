import path from "path";

import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(), 
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'waveform.svg', 'robots.txt'],
      manifest: {
        name: 'LexiVox',  
        short_name: 'LexiVox',
        description: 'Transform EPUB books and PDF documents into natural speech',
        categories: ['productivity', 'education', 'accessibility'],
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'pwa-icon.svg',
            sizes: '512x512', 
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'maskable-icon.svg', 
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'maskable'
          },
          {
            src: 'maskable-icon.svg', 
            sizes: '512x512',
            type: 'image/svg+xml', 
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            // Cache generated audio blobs
            urlPattern: /blob:.*audio.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tts-audio-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
              }
            }
          },
          {
            // Cache EPUB/PDF files (if served from external sources)
            urlPattern: /.*\.(epub|pdf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'document-files',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            // Cache TTS model files from Hugging Face
            urlPattern: /^https:\/\/huggingface\.co\/.*\.(onnx|json|bin)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tts-model-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache model files from CDN
            urlPattern: /^https:\/\/cdn-lfs.*\.huggingface\.co\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tts-model-files',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        maximumFileSizeToCacheInBytes: 1000 * 1024 * 1024, // 1000MB to accommodate TTS model (82MB)
        skipWaiting: true,
        clientsClaim: true
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: { format: "es" },
  build: {
    target: "esnext",
  },
  logLevel: process.env.NODE_ENV === "development" ? "error" : "info",
});
