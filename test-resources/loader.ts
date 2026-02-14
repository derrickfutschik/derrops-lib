import { expect } from '@jest/globals'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import apis from './apis'

export function resolveTestResource(relativePath: string): string {
  const state = expect.getState()
  if (!state.testPath) {
    throw new Error('resolveTestResource: testPath not available from Jest state')
  }

  const testDir = dirname(state.testPath)
  return resolve(testDir, relativePath)
}

/**
 * Find the monorepo root by navigating up from the test file location
 * until we find the directory containing 'test-resources/'
 */
function findMonorepoRoot(): string {
  const state = expect.getState()
  if (!state.testPath) {
    throw new Error('findMonorepoRoot: testPath not available from Jest state')
  }

  let currentDir = dirname(state.testPath)

  // Navigate up until we find the directory containing 'test-resources'
  // Max depth of 10 to avoid infinite loops
  for (let i = 0; i < 10; i++) {
    const testResourcesPath = resolve(currentDir, 'test-resources')
    if (existsSync(testResourcesPath)) {
      return currentDir
    }

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) {
      // Reached filesystem root
      break
    }
    currentDir = parentDir
  }

  throw new Error('Could not find monorepo root (directory containing test-resources/)')
}

export function resolveOpenApiSpec(host: string, path: string, version: string): string {
  const monorepoRoot = findMonorepoRoot()
  return resolve(
    monorepoRoot,
    'test-resources',
    'openapi-directory',
    'APIs',
    host,
    path,
    version,
    'openapi.yaml',
  )
}

/**
 * Compare two version strings (e.g. "1.1.4", "v1", "2006-03-01").
 * Semver-like versions are compared numerically; others lexicographically.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
function compareVersions(a: string, b: string): number {
  const normalize = (v: string) => v.replace(/^v/i, '').trim()
  const aNorm = normalize(a)
  const bNorm = normalize(b)
  const aParts = aNorm.split(/[.-]/).map((p) => (/^\d+$/.test(p) ? parseInt(p, 10) : p))
  const bParts = bNorm.split(/[.-]/).map((p) => (/^\d+$/.test(p) ? parseInt(p, 10) : p))
  const len = Math.max(aParts.length, bParts.length)
  for (let i = 0; i < len; i++) {
    const x = aParts[i]
    const y = bParts[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x - y
    } else {
      const s = String(x).localeCompare(String(y))
      if (s !== 0) return s
    }
  }
  return 0
}

/**
 * Resolve the path to the OpenAPI spec for the latest version of a given API.
 * Version directories under APIs/{host}/{path}/ are compared; the one considered
 * "latest" (by semver-like then lexicographic order) is returned.
 *
 * @param host - Domain (e.g. 'github.com')
 * @param path - Service path (e.g. 'api.github.com')
 * @returns Absolute path to openapi.yaml for the latest version, or null if none found
 */
export function getLatestOpenApiSpecPath(host: string, path: string): string | null {
  const monorepoRoot = findMonorepoRoot()
  const versionsDir = resolve(
    monorepoRoot,
    'test-resources',
    'openapi-directory',
    'APIs',
    host,
    path,
  )
  if (!existsSync(versionsDir)) {
    return null
  }
  const entries = readdirSync(versionsDir, { withFileTypes: true })
  const versionDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => {
      const specPath = resolve(versionsDir, name, 'openapi.yaml')
      return existsSync(specPath)
    })
  if (versionDirs.length === 0) {
    return null
  }
  versionDirs.sort((a, b) => compareVersions(a, b))
  const latestVersion = versionDirs[versionDirs.length - 1]!
  return resolveOpenApiSpec(host, path, latestVersion)
}

/**
 * Best to use the api object to resolve the spec yaml path as an input
 * For example: resolveSpecYaml(apis['ably.net'].control['v1'])
 * @param path
 * @returns
 */
export function resolveSpecYaml(path: string) {
  const monorepoRoot = findMonorepoRoot()
  return resolve(monorepoRoot, 'test-resources', 'openapi-directory', 'APIs', path)
}

export const TEST_API_SPECS = {
  /**
   * Get the Ably.net control API spec
   */
  // ably: () //=> resolveOpenApiSpec('ably.net', 'control', 'v1'),
  ably: () => resolveSpecYaml(apis['ably.net']['control']['v1']),

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
