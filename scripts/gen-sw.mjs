/**
 * 构建后重新生成 Service Worker。
 * 背景：本项目的构建环境中，vite-plugin-pwa 在 closeBundle 阶段扫描 dist 生成
 * 预缓存清单时，偶发与产物写入竞争（公共目录拷贝尚未落盘），导致 sw.js 的
 * precache manifest 漏掉 JS/图片。此脚本在构建完全结束后、文件系统稳定时
 * 再跑一次 workbox generateSW，覆盖出一份确定性的 sw.js。
 */
import { generateSW } from 'workbox-build'

const { count, size, warnings } = await generateSW({
  swDest: 'dist/sw.js',
  globDirectory: 'dist',
  globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
  // 排除 SW 自身与注册脚本，避免互相嵌套缓存
  globIgnores: ['sw.js', 'workbox-*.js', 'registerSW.js'],
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
  navigateFallback: 'index.html',
  navigateFallbackDenylist: [/^\/api\//],
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: { cacheName: 'html-cache' },
    },
  ],
})

for (const w of warnings) console.warn(w)
console.log(`sw.js regenerated: ${count} entries, ${(size / 1024).toFixed(1)} KiB precached`)
