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
  setupFiles: ['./test/jest-setup.ts'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: ['/node_modules/', '\\.e2e\\.test\\.ts$', 'aws-smoke\\.test\\.ts$'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts', '!src/**/*.spec.ts'],
  passWithNoTests: true,
  maxWorkers: 1, // Run tests serially to avoid circular reference serialization issues
  reporters: [
    'default',
    [
      'jest-md-dashboard',
      {
        title: 'Tests for @derrops/client-nodejs-axios',
        outputPath: '../../apps/derrops-docs/devops/tests/derrops-client-nodejs-axios.md', // where to write the markdown
      },
    ],
  ],
}
