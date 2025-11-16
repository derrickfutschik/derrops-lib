import { dirname, resolve } from 'node:path';
import { expect } from '@jest/globals';


export function resolveTestResource(relativePath: string): string {
  const state = expect.getState();
  if (!state.testPath) {
    throw new Error('resolveTestResource: testPath not available from Jest state');
  }

  const testDir = dirname(state.testPath);
  return resolve(testDir, relativePath);
}

export function resolveOpenApiSpec(host: string, path: string, version: string): string {
  return `/Users/dfutschik/slaops/slaops-platform/test-resources/openapi-directory/APIs/${host}/${path}/${version}/openapi.yaml`
}

export const WELL_KNOWN_SPECS = {
  /**
   * Get the Ably.net control API spec
   */
  ably: () => resolveOpenApiSpec('ably.net', 'control', 'v1'),

  /**
   * Get a GitHub API spec (if available)
   */
  github: () => resolveOpenApiSpec('github.com', 'api.github.com', '1.1.4'),
} as const;
