import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true, conditions: ['react-server'] },
  ssr: { resolve: { conditions: ['react-server'] } },
  test: { environment: 'node', include: ['scripts/search-perf.test.ts'] },
})
