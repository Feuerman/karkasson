import { defineConfig } from 'vitest/config'

export default defineConfig({
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
  },
})
