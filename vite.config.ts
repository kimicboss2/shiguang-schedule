import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    inspectAttr(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '拾光日程',
        short_name: '拾光日程',
        description: '轻量的个人日程管理：月视图、周视图、待办清单与到点提醒。',
        lang: 'zh-CN',
        start_url: './',
        display: 'standalone',
        background_color: '#FBFBF9',
        theme_color: '#5541EA',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        // HTML 与导航请求走网络优先，避免发版后看到旧页面
        navigateFallbackDenylist: [/^\/api\//],
        // 显式声明预缓存范围：JS/CSS/HTML + 图标与插画 SVG，保证离线可用
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'html-cache' },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
