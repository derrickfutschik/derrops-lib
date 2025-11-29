/**
 * Example integration test demonstrating usage of all SLAOps packages together
 */

import { describe, it, expect } from '@jest/globals';
import axios from 'axios';
import { attachSlaOpsInterceptor } from '@slaops/client-nodejs-axios';

describe('Integration Tests', () => {
  it('should import from all packages without errors', async () => {
    // Import from @slaops/public
    const publicModule = await import('@slaops/public');
    expect(publicModule).toBeDefined();

    // Import from @slaops/client
    const clientModule = await import('@slaops/client');
    expect(clientModule).toBeDefined();

    // Import from @slaops/client-nodejs-axios
    const axiosClientModule = await import('@slaops/client-nodejs-axios');
    expect(axiosClientModule).toBeDefined();
    expect(axiosClientModule.attachSlaOpsInterceptor).toBeDefined();
  });

  it('should be able to create an axios instance with SLAOps interceptor', () => {
    const axiosInstance = axios.create({
      baseURL: 'https://api.example.com',
    });

    // This should not throw
    expect(() => {
      attachSlaOpsInterceptor(axiosInstance, {
        endpoint: 'https://slaops.example.com/events',
        apiKey: 'test-api-key',
        projectId: 'test-project',
      });
    }).not.toThrow();
  });

  it('should verify package version', async () => {
    const { TEST_PACKAGE_VERSION } = await import('../src/index.js');
    expect(TEST_PACKAGE_VERSION).toBe('0.1.0');
  });
});
