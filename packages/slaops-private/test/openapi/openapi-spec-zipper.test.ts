import { describe, expect, test } from '@jest/globals'
import { TEST_API_SPECS } from '../../../../test-resources/loader'
import { loadSpec } from '../../src/openapi/openapi-parser'
import { zipOperations } from '../../src/openapi/openapi-spec-zipper'
import * as fixture from './openapi-spec-zipper.fixture'

describe('zipOperations', () => {
  test('should return empty array for spec with no paths', () => {
    const spec = fixture.EMPTY_OPERATION_SPEC

    const result = zipOperations(spec)
    expect(result).toEqual([])
  })

  test('should zip a simple operation', () => {
    const spec = fixture.SINGLE_OPERATION_SPEC_GET_USER
    const result = zipOperations(spec)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      o_i: 'getUser',
      seg: 3,
      v_p: '/users/{i}',
      m: 'G',
      m_i: [],
      p: '/users/{userId}',
      p_k: 'G:users/{i}',
    })
  })

  test('should handle multiple HTTP methods on same path', () => {
    const spec = fixture.LIST_USERS_OPERATION_SPEC

    const result = zipOperations(spec)

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.o_i)).toContain('listUsers')
    expect(result.map((r) => r.o_i)).toContain('createUser')
    expect(result.map((r) => r.m)).toContain('G')
    expect(result.map((r) => r.m)).toContain('P')
  })

  test('should skip operations without operationId', () => {
    const spec = fixture.HEALTH_CHECK_OPERATION_SPEC
    const result = zipOperations(spec)
    expect(result).toHaveLength(0)
  })

  test('should extract model indices from direct $ref in request/response', () => {
    const spec = fixture.OPERATION_WITH_DIRECT_REF
    const result = zipOperations(spec)

    expect(result).toHaveLength(1)
    expect(result[0]!.o_i).toBe('createUser')
    // Schema order: User (index 0), CreateUserRequest (index 1)
    // Both should be in m_i
    expect(result[0]!.m_i).toEqual([0, 1])
  })

  test('should extract model indices from nested $ref (allOf)', () => {
    const spec = fixture.OPERATION_WITH_NESTED_REF
    const result = zipOperations(spec)

    expect(result).toHaveLength(1)
    expect(result[0]!.o_i).toBe('getAdminUser')
    // Schema order: BaseEntity (0), User (1), AdminUser (2)
    // AdminUser references User which references BaseEntity
    // All three should be in m_i
    expect(result[0]!.m_i).toEqual([0, 1, 2])
  })

  test('should extract model indices from array items with $ref', () => {
    const spec = fixture.OPERATION_WITH_ARRAY_REF
    const result = zipOperations(spec)

    expect(result).toHaveLength(1)
    expect(result[0]!.o_i).toBe('listUsers')
    // Schema order: User (0), UserList (1)
    // UserList contains array of User
    expect(result[0]!.m_i).toEqual([0, 1])
  })

  test('should extract model indices from properties with $ref', () => {
    const spec = fixture.OPERATION_WITH_PROPERTY_REF
    const result = zipOperations(spec)

    expect(result).toHaveLength(1)
    expect(result[0]!.o_i).toBe('getUser')
    // Schema order: Address (0), User (1)
    // User has address property that references Address
    expect(result[0]!.m_i).toEqual([0, 1])
  })

  test('should handle circular references without infinite recursion', () => {
    const spec = fixture.OPERATION_WITH_CIRCULAR_REF
    const result = zipOperations(spec)

    expect(result).toHaveLength(1)
    expect(result[0]!.o_i).toBe('getTree')
    // Schema order: Node (0)
    // Node references itself in children array
    expect(result[0]!.m_i).toEqual([0])
  })

  test('should extract model indices from parameter schemas with $ref', () => {
    const spec = fixture.OPERATION_WITH_PARAM_REF
    const result = zipOperations(spec)

    expect(result).toHaveLength(1)
    expect(result[0]!.o_i).toBe('getUser')
    // Schema order: UserId (0)
    // Parameter schema references UserId
    expect(result[0]!.m_i).toEqual([0])
  })

  test('zipping a test resource', async () => {
    const specPath = TEST_API_SPECS.ably()
    const spec = await loadSpec(specPath)
    const operationsZipped = zipOperations(spec)
    expect(operationsZipped.length).toBeGreaterThan(0)
  })
})
