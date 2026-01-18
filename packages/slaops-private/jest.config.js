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
        tsconfig: {
          module: 'esnext',
          moduleResolution: 'bundler',
        },
      },
    ],
  },
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: ['/node_modules/', '\\.e2e\\.test\\.ts$'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts', '!src/**/*.spec.ts'],
  passWithNoTests: true,
  // Ensure NODE_OPTIONS is set for ESM support
  setupFiles: ['<rootDir>/jest.setup.js'],
  reporters: [
    'default',
    [
      'jest-md-dashboard',
      {
        title: 'Tests for @slaops/private',
        outputPath: '../../apps/slaops-docs/devops/tests/slaops-private.md', // where to write the markdown
      },
    ],
  ],
}
