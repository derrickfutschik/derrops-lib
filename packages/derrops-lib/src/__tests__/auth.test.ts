import { createPipeline } from '../index'

type UserAuthContext = {
  domain: string
  ipAddress: string
  headers: {
    Authorization: string
  }
  path: string
  method: string
}

describe('user authentication and access pipeline', () => {
  function buildAuthFlow(authContext: UserAuthContext) {
    return createPipeline<{ authContext: UserAuthContext }>({
      name: 'User Authentication and Access Pipeline',
    })
      .step({
        name: 'Malicious IP Check',
        execute: async (input) => ({
          ipCheck: checkIpAddress(input.authContext.ipAddress),
        }),
        policy: { failure: 'CONTINUE' },
      })
      .check('IP not malicious', (ctx) => ({
        success: ctx.ipCheck.isMalicious === false,
        message: `IP Address ${ctx.authContext.ipAddress} malicious==${ctx.ipCheck.isMalicious}`,
      }))

      .step({
        name: 'Lookup Tenant',
        execute: async (input) => ({
          accessedTenant: lookupTenant(input.authContext.domain),
        }),
        policy: { failure: 'CONTINUE' },
      })
      .check('Tenant exists', (ctx) => ({
        success: ctx.accessedTenant !== undefined,
        message: `Tenant ${ctx.accessedTenant?.tenantName ?? 'NOT FOUND'} found`,
      }))

      .step({
        name: 'Check Tenant IP Whitelist',
        shouldRun: (ctx) => ctx.data.accessedTenant !== undefined,
        execute: async (input) => ({
          tenantIPWhitelistCheck: checkTenantIpWhitelist(
            input.authContext.domain,
            input.authContext.ipAddress,
          ),
        }),
        policy: { failure: 'CONTINUE' },
      })
      .check('IP whitelisted for tenant', (ctx) => ({
        success: ctx.tenantIPWhitelistCheck.isWhitelisted,
        message: `Tenant ${ctx.accessedTenant?.tenantName ?? 'NOT FOUND'} IP is whitelisted`,
      }))

      .execute({ authContext })
  }

  it('collects FAIL status on the IP check and PASS on the rest', async () => {
    const result = await buildAuthFlow({
      domain: 'example.com',
      ipAddress: '127.0.0.1',
      headers: { Authorization: 'Bearer 1234567890' },
      path: '/api/v1/auth',
      method: 'POST',
    })

    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(3)

    expect(result.steps[0].name).toBe('Malicious IP Check')
    expect(result.steps[0].checks[0].name).toBe('IP not malicious')
    expect(result.steps[0].checks[0].result.status).toBe('FAIL')

    expect(result.steps[1].name).toBe('Lookup Tenant')
    expect(result.steps[1].checks[0].result.status).toBe('PASS')

    expect(result.steps[2].name).toBe('Check Tenant IP Whitelist')
    expect(result.steps[2].checks[0].result.status).toBe('PASS')

    expect(result.data.authContext.ipAddress).toBe('127.0.0.1')
    expect(result.data.ipCheck.isMalicious).toBe(true)
    expect(result.data.accessedTenant?.tenantName).toBe('Example Tenant')
  })

  it('gives NONE status to checks on a skipped step', async () => {
    const result = await buildAuthFlow({
      domain: 'unknown.com',
      ipAddress: '127.0.0.1',
      headers: { Authorization: 'Bearer abc' },
      path: '/api/v1/auth',
      method: 'GET',
    })

    expect(result.steps[2].skipped).toBe(true)
    expect(result.steps[2].checks[0].result.status).toBe('NONE')
  })
})

describe('multiple checks per step — all run even when policy stops the pipeline', () => {
  it('runs all checks on the step before stopping the pipeline', async () => {
    const checkOrder: string[] = []

    const result = await createPipeline<{ value: number }>({ name: 'Multi-Check Stop Test' })
      .step({
        name: 'Compute',
        execute: async (input) => ({ doubled: input.value * 2 }),
        // default policy: failure: 'STOP'
      })
      .check('Always passes', (_ctx) => {
        checkOrder.push('always-passes')
        return { success: true }
      })
      .check('Fails — stop pipeline', (_ctx) => {
        checkOrder.push('fails-stop')
        return { success: false, message: 'Value too large' }
      })
      .check('Also fails', (_ctx) => {
        checkOrder.push('also-fails')
        return { success: false, message: 'Another issue' }
      })
      .step({
        name: 'Should not run',
        execute: async (_input) => ({ neverReached: true }),
      })
      .execute({ value: 100 })

    expect(checkOrder).toEqual(['always-passes', 'fails-stop', 'also-fails'])

    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].checks).toHaveLength(3)

    expect(result.steps[0].checks[0]).toMatchObject({
      name: 'Always passes',
      result: { status: 'PASS' },
    })
    expect(result.steps[0].checks[1]).toMatchObject({
      name: 'Fails — stop pipeline',
      result: { status: 'FAIL' },
    })
    expect(result.steps[0].checks[2]).toMatchObject({
      name: 'Also fails',
      result: { status: 'FAIL' },
    })

    if (!result.success) {
      expect(result.error.message).toBe('Value too large')
    }
  })
})

describe('check ERROR status', () => {
  it('records ERROR when a check fn throws and stops the pipeline', async () => {
    const result = await createPipeline<{ x: number }>({ name: 'Error Check Test' })
      .step({
        name: 'Step A',
        execute: async (input) => ({ y: input.x + 1 }),
      })
      .check('Throws unexpectedly', (_ctx) => {
        throw new Error('check exploded')
      })
      .check('Would pass', (_ctx) => ({ success: true }))
      .step({
        name: 'Step B',
        execute: async (_input) => ({ z: 99 }),
      })
      .execute({ x: 1 })

    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(1)

    const errorCheck = result.steps[0].checks[0]
    expect(errorCheck.result.status).toBe('ERROR')
    expect(errorCheck.result.message).toBe('check exploded')
    expect(errorCheck.result.error).toBeInstanceOf(Error)

    expect(result.steps[0].checks[1].result.status).toBe('PASS')
  })
})

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

function checkIpAddress(_ipAddress: string): any {
  return {
    isMalicious: true,
    country: 'US',
    city: 'New York',
    region: 'NY',
    postalCode: '10001',
    latitude: 40.7128,
    longitude: -74.006,
    timezone: 'America/New_York',
    isp: 'Verizon Media',
    organization: 'Verizon Media',
  }
}

function lookupTenant(domain: string) {
  if (domain === 'example.com') {
    return {
      tenantId: 't-1234567890',
      tenantName: 'Example Tenant',
      tenantDomain: 'example.com',
      tenantRegion: 'US',
      tenantCity: 'New York',
      tenantPostalCode: '10001',
    }
  } else {
    return undefined
  }
}

function checkTenantIpWhitelist(domain: string, ipAddress: string) {
  if (domain === 'example.com' && ipAddress === '127.0.0.1') {
    return { isWhitelisted: true }
  } else {
    return { isWhitelisted: false }
  }
}
