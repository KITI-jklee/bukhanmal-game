import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/game/**/*.ts', 'src/lib/**/*.ts', 'src/components/**/*.tsx'],
      exclude: ['src/components/Icons.tsx'],
      thresholds: {
        lines: 40,
        functions: 40,
        statements: 40,
        branches: 35,
      },
    },
  },
})
