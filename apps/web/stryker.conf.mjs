/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: ['src/**/*.{js,jsx}', '!src/**/*.test.{js,jsx}', '!src/test/**'],
  testRunner: 'vitest',
  reporters: ['progress', 'clear-text', 'html'],
  coverageAnalysis: 'perTest',
  htmlReporter: {
    baseDir: 'reports/mutation'
  },
  thresholds: {
    high: 80,
    low: 65,
    break: 60
  }
};
