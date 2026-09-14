import { fileURLToPath, URL } from 'node:url'

import { defineConfig, configDefaults } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // e2e/ はPlaywright(playwright.config.ts)専用のディレクトリ。除外しないと
    // Vitestのデフォルトincludeがe2e/*.spec.tsも拾ってしまい、jsdom環境では
    // 動かないPlaywrightのAPIを呼んでnpm testが壊れる。
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
