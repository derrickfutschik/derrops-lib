/**
 * Example integration test demonstrating usage of all Derrops packages together
 */

import { describe, expect, it } from '@jest/globals'
import { attachDerropsInterceptor } from '@derrops/client-nodejs-axios'
import axios from 'axios'

describe('Integration Tests', () => {
  it('should import from all packages without errors', async () => {
    // Import from @derrops/public
    const publicModule = await import('@derrops/public')
    expect(publicModule).toBeDefined()

    // Import from @derrops/client
    const clientModule = await import('@derrops/client')
    expect(clientModule).toBeDefined()

    // Import from @derrops/client-nodejs-axios
    const axiosClientModule = await import('@derrops/client-nodejs-axios')
    expect(axiosClientModule).toBeDefined()
    expect(axiosClientModule.attachDerropsInterceptor).toBeDefined()
  })

  it('should be able to create an axios instance with Derrops interceptor', () => {
    const axiosInstance = axios.create({
      baseURL: 'https://api.example.com',
    })

    // This should not throw
    expect(() => {
      attachDerropsInterceptor(axiosInstance, {
        endpoint: 'https://derrops.example.com/events',
        apiKey: 'test-api-key',
        projectId: 'test-project',
      })
    }).not.toThrow()
  })

  it('should verify package version', async () => {
    const { TEST_PACKAGE_VERSION } = await import('../src/index.js')
    expect(TEST_PACKAGE_VERSION).toBe('0.1.0')
  })
})
