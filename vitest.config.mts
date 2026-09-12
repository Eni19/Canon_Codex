import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // Resolves the `server-only` marker package to its no-op build (same condition Next.js's
    // server compiler uses), so unit tests can import server-only modules directly.
    conditions: ['react-server'],
  },
  ssr: {
    resolve: {
      conditions: ['react-server'],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
