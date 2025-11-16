/**
 * Test Resources Loader
 *
 * Utilities for loading test resources from the test-resources directory.
 * This file should be imported by test files across the monorepo.
 */

import { join, resolve, dirname } from 'node:path';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Get the directory name, compatible with both CommonJS and ESM
 */
function getDirname(): string {
  // Try ESM-style import.meta.url via eval so that TypeScript
  // doesn't enforce the --module restriction on import.meta.
  try {
    // Use indirect eval to avoid bundler rewrites
    const meta = (0, eval)('import.meta') as { url?: string } | undefined;
    if (meta?.url) {
      return dirname(fileURLToPath(meta.url));
    }
  } catch {
    // Ignore – we'll fall back to CommonJS / cwd below
  }

  // In CommonJS/transpiled context
  // @ts-ignore - __dirname is available in CommonJS context
  if (typeof __dirname !== 'undefined') {
    // @ts-ignore
    return __dirname;
  }

  // Fallback: compute from process.cwd()
  // Assuming this file is always at test-resources/loader.ts
  return resolve(process.cwd(), 'test-resources');
}

/**
 * The root directory of test-resources
 * This is calculated relative to the monorepo root
 */
export const TEST_RESOURCES_ROOT = getDirname();

/**
 * The openapi-directory root
 */
export const OPENAPI_DIRECTORY_ROOT = join(
  TEST_RESOURCES_ROOT,
  'openapi-directory',
  'APIs'
);

/**
 * Resolve a path relative to the test-resources directory
 *
 * @param relativePath - Path relative to test-resources/
 * @returns Absolute path to the resource
 *
 * @example
 * ```ts
 * const path = resolveTestResource(
 *   'openapi-directory/APIs/github.com/api.github.com/1.1.4/openapi.yaml'
 * );
 * ```
 */
export function resolveTestResource(...relativePath: string[]): string {
  return resolve(TEST_RESOURCES_ROOT, ...relativePath);
}

/**
 * Resolve a path to an OpenAPI spec in the openapi-directory
 *
 * @param domain - The domain (e.g., 'github.com')
 * @param subdomain - The subdomain or service name (e.g., 'api.github.com')
 * @param version - The version (e.g., '1.1.4')
 * @param filename - The filename (default: 'openapi.yaml')
 * @returns Absolute path to the OpenAPI spec
 */
export function resolveOpenApiSpec(
  domain: string,
  subdomain: string,
  version: string,
  filename: string = 'openapi.yaml'
): string {
  return join(OPENAPI_DIRECTORY_ROOT, domain, subdomain, version, filename);
}

/**
 * Find all OpenAPI specs matching a pattern
 *
 * @param pattern - A string to match against domain names (case-insensitive)
 * @returns Array of spec metadata
 */
export async function findOpenApiSpecs(
  pattern?: string
): Promise<
  Array<{
    domain: string;
    subdomain: string;
    version: string;
    path: string;
  }>
> {
  const results: Array<{
    domain: string;
    subdomain: string;
    version: string;
    path: string;
  }> = [];

  try {
    const domains = await readdir(OPENAPI_DIRECTORY_ROOT, { withFileTypes: true });

    for (const domainEntry of domains) {
      if (!domainEntry.isDirectory()) continue;

      const domain = domainEntry.name;

      // Filter by pattern if provided
      if (pattern && !domain.toLowerCase().includes(pattern.toLowerCase())) {
        continue;
      }

      const domainPath = join(OPENAPI_DIRECTORY_ROOT, domain);
      const subdomains = await readdir(domainPath, { withFileTypes: true });

      for (const subdomainEntry of subdomains) {
        if (!subdomainEntry.isDirectory()) continue;

        const subdomain = subdomainEntry.name;
        const subdomainPath = join(domainPath, subdomain);
        const versions = await readdir(subdomainPath, { withFileTypes: true });

        for (const versionEntry of versions) {
          if (!versionEntry.isDirectory()) continue;

          const version = versionEntry.name;
          const versionPath = join(subdomainPath, version);
          const files = await readdir(versionPath);

          // Look for openapi.yaml, swagger.yaml, or openapi.json
          const specFile = files.find(
            f =>
              f === 'openapi.yaml' ||
              f === 'swagger.yaml' ||
              f === 'openapi.json' ||
              f === 'swagger.json'
          );

          if (specFile) {
            results.push({
              domain,
              subdomain,
              version,
              path: join(versionPath, specFile),
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error scanning openapi-directory:', error);
  }

  return results;
}

/**
 * List all available domains in the openapi-directory
 *
 * @returns Array of domain names
 */
export async function listOpenApiDomains(): Promise<string[]> {
  try {
    const entries = await readdir(OPENAPI_DIRECTORY_ROOT, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();
  } catch (error) {
    console.error('Error listing domains:', error);
    return [];
  }
}

/**
 * Get a random OpenAPI spec for testing
 *
 * @returns Random spec metadata or null if none found
 */
export async function getRandomOpenApiSpec(): Promise<{
  domain: string;
  subdomain: string;
  version: string;
  path: string;
} | null> {
  const specs = await findOpenApiSpecs();
  if (specs.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * specs.length);
  return specs[randomIndex] ?? null;
}

/**
 * Common well-known specs for testing
 */
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
