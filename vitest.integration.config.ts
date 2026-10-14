import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@server': fileURLToPath(new URL('./server/src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: {
      // В тестах ходы компьютера срабатывают быстро
      COMPUTER_MOVE_DELAY_MS: '100',
    },
    coverage: {
      provider: 'v8',
      include: [
        'server/src/modules/**/*.ts',
        'server/src/services/**/*.ts',
        'server/src/socket/**/*.ts',
        'src/modules/**/*.ts',
        'src/composables/**/*.ts',
        'src/utils/**/*.ts',
        'src/rules/**/*.ts',
        'src/components/GameActionsHistory/internal/**/*.ts',
      ],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        'server/src/modules/**': {
          lines: 85,
          statements: 85,
          functions: 85,
          branches: 75,
        },
        'server/src/services/**': {
          lines: 80,
          statements: 80,
          functions: 85,
          branches: 70,
        },
        'server/src/socket/**': {
          lines: 70,
          statements: 70,
          functions: 80,
          branches: 65,
        },
        'src/**/*.ts': {
          lines: 70,
          statements: 70,
          functions: 60,
          branches: 50,
        },
      },
    },
  },
})
