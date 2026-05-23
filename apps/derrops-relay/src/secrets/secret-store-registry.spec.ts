import { parseSecretUri } from './secret-store-registry'

describe('parseSecretUri', () => {
  it('parses a scheme and path without a field fragment', () => {
    const { scheme, path, field } = parseSecretUri('vault://host/secret/data/key')
    expect(scheme).toBe('vault')
    expect(path).toBe('host/secret/data/key')
    expect(field).toBeUndefined()
  })

  it('parses a field fragment after #', () => {
    const { scheme, path, field } = parseSecretUri('vault://host/secret/data/key#password')
    expect(scheme).toBe('vault')
    expect(path).toBe('host/secret/data/key')
    expect(field).toBe('password')
  })

  it('handles ARN-style paths (colons in path)', () => {
    const uri = 'aws-secretsmanager://arn:aws:secretsmanager:us-east-1:123456789:secret:my-secret'
    const { scheme, path, field } = parseSecretUri(uri)
    expect(scheme).toBe('aws-secretsmanager')
    expect(path).toBe('arn:aws:secretsmanager:us-east-1:123456789:secret:my-secret')
    expect(field).toBeUndefined()
  })

  it('handles ARN-style paths with a field fragment', () => {
    const uri = 'aws-secretsmanager://arn:aws:secretsmanager:us-east-1:123:secret:name#apiKey'
    const { scheme, path, field } = parseSecretUri(uri)
    expect(scheme).toBe('aws-secretsmanager')
    expect(path).toBe('arn:aws:secretsmanager:us-east-1:123:secret:name')
    expect(field).toBe('apiKey')
  })

  it('treats an empty fragment (#) as no field', () => {
    const { field } = parseSecretUri('vault://host/path#')
    expect(field).toBeUndefined()
  })

  it('throws when :// is missing', () => {
    expect(() => parseSecretUri('vaulthost/path')).toThrow(/missing/)
  })

  it('throws when the scheme is empty', () => {
    expect(() => parseSecretUri('://host/path')).toThrow(/empty scheme/)
  })

  it('throws when the path is empty', () => {
    expect(() => parseSecretUri('vault://')).toThrow(/empty path/)
  })
})
