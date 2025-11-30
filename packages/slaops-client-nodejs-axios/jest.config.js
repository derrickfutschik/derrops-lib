export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: ['/node_modules/', '\\.e2e\\.test\\.ts$'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts', '!src/**/*.spec.ts'],
  passWithNoTests: true,
  maxWorkers: 1, // Run tests serially to avoid circular reference serialization issues
  reporters: [
    'default',
    [
      'jest-md-dashboard',
      {
        title: 'Tests for @slaops/client-nodejs-axios',
        outputPath: '../../apps/slaops-docs/docs/test/slaops-client-nodejs-axios.md', // where to write the markdown
      },
    ],
  ],
};
