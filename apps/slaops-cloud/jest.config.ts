import type { Config } from 'jest'

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  preset: 'ts-jest',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          paths: {
            '@slaops/cloud/*': ['./src/*'],
            '@slaops/config/*': ['../../packages/slaops-config/src/*'],
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@slaops/cloud/(.*)$': '<rootDir>/src/$1',
    '^@slaops/config$': '<rootDir>/../../packages/slaops-config/src/index.ts',
    '^@slaops/config/(.*)$': '<rootDir>/../../packages/slaops-config/src/$1',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s', '!src/main.ts', '!src/**/*.module.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  testMatch: [
    '**/src/**/*.e2e-spec.test.ts',
    '**/src/**/*.spec.ts',
    '**/src/**/*.test.ts',
    '**/test/**/*.spec.ts',
    '**/test/**/*.test.ts',
    '**/test/**/*.e2e-spec.ts',
    '**/test/**/*.e2e-spec.test.ts',
    '**/test/*.e2e-spec.test.ts',
  ],
  reporters: [
    'default',
    [
      'jest-md-dashboard',
      {
        title: 'Tests for @slaops/cloud',
        outputPath: '../slaops-docs/devops/tests/slaops-cloud.md', // where to write the markdown
      },
    ],
  ],
}

export default config
