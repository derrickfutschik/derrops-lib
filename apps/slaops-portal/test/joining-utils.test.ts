import { describe, expect, it } from 'vitest'
import {
  detectJoinColumnCandidates,
  detectJoiningContext,
} from '../src/components/api-tester/joining-utils'

// ---------------------------------------------------------------------------
// Minimal test data modelled after the real jmespath-example.json structure.
// hits[*].document.contact → array of contact objects, one per hit.
// hits[*].document.sampleOperations → array of arrays (one array per hit).
// ---------------------------------------------------------------------------

const contact0 = {
  'x-twitter': 'Adyen',
  name: 'Adyen Developer Experience team',
  url: 'https://github.com/Adyen/adyen-openapi',
}
const contact1 = { 'x-twitter': 'Adyen' }
const contact2 = { email: 'contact@airbyte.io' }
const contact3 = {
  'x-twitter': 'PermittedSoc',
  name: 'Mike Ralphson',
  email: 'mike.ralphson@gmail.com',
  url: 'https://github.com/mermade/aws2openapi',
}

const sampleOps0 = [
  { summary: 'List companies', path: '/companies', method: 'GET', operationId: 'get-companies' },
  { summary: 'Get company', path: '/companies/{id}', method: 'GET', operationId: 'get-company' },
]
const sampleOps1 = [
  { summary: 'List users', path: '/users', method: 'GET', operationId: 'get-users' },
]
const sampleOps2 = [
  { summary: 'Create order', path: '/orders', method: 'POST', operationId: 'post-orders' },
  { summary: 'Delete order', path: '/orders/{id}', method: 'DELETE', operationId: 'delete-order' },
  { summary: 'Update order', path: '/orders/{id}', method: 'PUT', operationId: 'put-order' },
]

const testData = {
  total: 4,
  hits: [
    {
      id: 'hit-0',
      score: 0.9,
      document: { id: 'doc-0', title: 'API A', contact: contact0, sampleOperations: sampleOps0 },
    },
    {
      id: 'hit-1',
      score: 0.8,
      document: { id: 'doc-1', title: 'API B', contact: contact1, sampleOperations: sampleOps1 },
    },
    {
      id: 'hit-2',
      score: 0.7,
      document: { id: 'doc-2', title: 'API C', contact: contact2, sampleOperations: sampleOps2 },
    },
    {
      id: 'hit-3',
      score: 0.6,
      document: { id: 'doc-3', title: 'API D', contact: contact3, sampleOperations: [] },
    },
  ],
}

// Simulate what jmespath.search returns for a given query against testData.
// We do it manually so the test has no jmespath dependency.
const contactResult = testData.hits.map((h) => h.document.contact) // 4 objects
const sampleOpsResult = testData.hits.flatMap((h) => h.document.sampleOperations) // 5 objects

// ---------------------------------------------------------------------------
// hits[*].document.contact — the bug scenario
// ---------------------------------------------------------------------------

describe('detectJoiningContext — hits[*].document.contact', () => {
  it('produces a "hits" joining column', () => {
    const ctx = detectJoiningContext(testData, 'hits[*].document.contact', contactResult.length)
    expect(ctx).not.toBeNull()
    expect(ctx!.joiningColumns).toEqual(['hits'])
  })

  it('produces one rowIndex per contact result, mapping back to hit index', () => {
    const ctx = detectJoiningContext(testData, 'hits[*].document.contact', contactResult.length)!
    expect(ctx.rowIndices).toHaveLength(4)
    // Each row maps to its hit index
    expect(ctx.rowIndices[0]).toEqual(['0'])
    expect(ctx.rowIndices[1]).toEqual(['1'])
    expect(ctx.rowIndices[2]).toEqual(['2'])
    expect(ctx.rowIndices[3]).toEqual(['3'])
  })
})

// ---------------------------------------------------------------------------
// hits[*].document.id — scalar trailing property
// ---------------------------------------------------------------------------

describe('detectJoiningContext — hits[*].document.id', () => {
  const idResult = testData.hits.map((h) => h.document.id) // ['doc-0', ..., 'doc-3']

  it('produces a "hits" joining column for a scalar trailing property', () => {
    const ctx = detectJoiningContext(testData, 'hits[*].document.id', idResult.length)
    expect(ctx).not.toBeNull()
    expect(ctx!.joiningColumns).toEqual(['hits'])
  })

  it('maps each scalar result row to its hit index', () => {
    const ctx = detectJoiningContext(testData, 'hits[*].document.id', idResult.length)!
    expect(ctx.rowIndices).toEqual([['0'], ['1'], ['2'], ['3']])
  })
})

// ---------------------------------------------------------------------------
// hits[*].document.sampleOperations[*] — existing two-segment behaviour
// unchanged
// ---------------------------------------------------------------------------

describe('detectJoiningContext — hits[*].document.sampleOperations[*]', () => {
  it('produces a "hits" joining column', () => {
    const ctx = detectJoiningContext(
      testData,
      'hits[*].document.sampleOperations[*]',
      sampleOpsResult.length,
    )
    expect(ctx).not.toBeNull()
    expect(ctx!.joiningColumns).toEqual(['hits'])
  })

  it('maps each operation to its hit index (skips hit-3 with empty ops)', () => {
    const ctx = detectJoiningContext(
      testData,
      'hits[*].document.sampleOperations[*]',
      sampleOpsResult.length,
    )!
    // hit-0 → 2 ops, hit-1 → 1 op, hit-2 → 3 ops, hit-3 → 0 ops
    expect(ctx.rowIndices).toEqual([
      ['0'],
      ['0'], // hit-0 ops 0,1
      ['1'], // hit-1 op 0
      ['2'],
      ['2'],
      ['2'], // hit-2 ops 0,1,2
    ])
  })
})

// ---------------------------------------------------------------------------
// hits[*].document.sampleOperations[*].path — trailing on second segment
// ---------------------------------------------------------------------------

describe('detectJoiningContext — hits[*].document.sampleOperations[*].path', () => {
  const pathResult = testData.hits.flatMap((h) => h.document.sampleOperations.map((op) => op.path))

  it('produces ["hits", "sampleOperations"] joining columns', () => {
    const ctx = detectJoiningContext(
      testData,
      'hits[*].document.sampleOperations[*].path',
      pathResult.length,
    )
    expect(ctx).not.toBeNull()
    expect(ctx!.joiningColumns).toEqual(['hits', 'sampleOperations'])
  })

  it('maps each path result to [hitIdx, opIdx]', () => {
    const ctx = detectJoiningContext(
      testData,
      'hits[*].document.sampleOperations[*].path',
      pathResult.length,
    )!
    expect(ctx.rowIndices).toEqual([
      ['0', '0'],
      ['0', '1'],
      ['1', '0'],
      ['2', '0'],
      ['2', '1'],
      ['2', '2'],
    ])
  })
})

// ---------------------------------------------------------------------------
// queries that should NOT produce a joining context
// ---------------------------------------------------------------------------

describe('detectJoiningContext — no joining context cases', () => {
  it('returns null for a plain property path (no array traversal)', () => {
    const ctx = detectJoiningContext(testData, 'total', 1)
    expect(ctx).toBeNull()
  })

  it('returns null when count does not match', () => {
    const ctx = detectJoiningContext(testData, 'hits[*].document.contact', 999)
    expect(ctx).toBeNull()
  })

  it('returns null for a single [*] traversal with no trailing props', () => {
    // hits[*] alone — result IS the traversed array; no useful joining column
    const ctx = detectJoiningContext(testData, 'hits[*]', testData.hits.length)
    expect(ctx).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// detectJoinColumnCandidates — hits[*].document.contact
// ---------------------------------------------------------------------------

describe('detectJoinColumnCandidates — hits[*].document.contact', () => {
  it('returns one candidate array for the single "hits" joining level', () => {
    const ctx = detectJoiningContext(testData, 'hits[*].document.contact', contactResult.length)!
    const candidates = detectJoinColumnCandidates(testData, 'hits[*].document.contact', ctx)
    expect(candidates).toHaveLength(1) // one joining level
  })

  it('default index candidate is always present', () => {
    const ctx = detectJoiningContext(testData, 'hits[*].document.contact', contactResult.length)!
    const candidates = detectJoinColumnCandidates(testData, 'hits[*].document.contact', ctx)
    const defaults = candidates[0].filter((c) => c.isDefault)
    expect(defaults).toHaveLength(1)
    expect(defaults[0].values).toEqual(['0', '1', '2', '3'])
  })
})
