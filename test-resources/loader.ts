import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { expect } from '@jest/globals';


export function resolveTestResource(relativePath: string): string {
  const state = expect.getState();
  if (!state.testPath) {
    throw new Error('resolveTestResource: testPath not available from Jest state');
  }

  const testDir = dirname(state.testPath);
  return resolve(testDir, relativePath);
}

/**
 * Find the monorepo root by navigating up from the test file location
 * until we find the directory containing 'test-resources/'
 */
function findMonorepoRoot(): string {
  const state = expect.getState();
  if (!state.testPath) {
    throw new Error('findMonorepoRoot: testPath not available from Jest state');
  }

  let currentDir = dirname(state.testPath);

  // Navigate up until we find the directory containing 'test-resources'
  // Max depth of 10 to avoid infinite loops
  for (let i = 0; i < 10; i++) {
    const testResourcesPath = resolve(currentDir, 'test-resources');
    if (existsSync(testResourcesPath)) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
  }

  throw new Error('Could not find monorepo root (directory containing test-resources/)');
}

export function resolveOpenApiSpec(host: string, path: string, version: string): string {
  const monorepoRoot = findMonorepoRoot();
  return resolve(monorepoRoot, 'test-resources', 'openapi-directory', 'APIs', host, path, version, 'openapi.yaml');
}

export const TEST_API_SPECS = {
  /**
   * Get the Ably.net control API spec
   */
  ably: () => resolveOpenApiSpec('ably.net', 'control', 'v1'),

  /**
   * Get a GitHub API spec (if available)
   */
  github: () => resolveOpenApiSpec('github.com', 'api.github.com', '1.1.4'),

  /**
   * Get an AWS S3 API spec
   */
  awsS3: () => resolveOpenApiSpec('amazonaws.com', 's3', '2006-03-01'),

  /**
   * Get an AWS DynamoDB API spec
   */
  awsDynamoDB: () => resolveOpenApiSpec('amazonaws.com', 'dynamodb', '2012-08-10'),

  /**
   * Get an AWS CloudTrail API spec
   */
  awsCloudTrail: () => resolveOpenApiSpec('amazonaws.com', 'cloudtrail', '2013-11-01'),


}