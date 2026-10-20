import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  envDir: false,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/tests/sync.emulator.test.ts'],
    setupFiles: ['fake-indexeddb/auto'],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
})