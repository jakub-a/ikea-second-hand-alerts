import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.js'],
      exclude: ['test/**', 'scripts/**', 'vitest.config.js', 'eslint.config.js'],
      thresholds: {
        lines: 45,
        functions: 40,
        branches: 55,
        statements: 45
      }
    }
  }
});
