/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: ['src/**/*.js', '!test/**/*.js', '!scripts/**/*.mjs'],
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
