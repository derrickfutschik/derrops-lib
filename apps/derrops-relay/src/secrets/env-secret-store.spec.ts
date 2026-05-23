import { EnvSecretStore } from './env-secret-store'
import { SecretStoreError } from './secret-store'

describe('EnvSecretStore', () => {
  const env: NodeJS.ProcessEnv = {
    MY_SECRET: 'plain-value',
    JSON_SECRET: JSON.stringify({ key: 'the-key', nested: 42 }),
    EMPTY: '',
  }

  const store = new EnvSecretStore(env)

  describe('getSecret', () => {
    it('returns the env var value', async () => {
      const result = await store.getSecret('MY_SECRET')
      expect(result.value).toBe('plain-value')
      expect(result.fromCache).toBe(false)
      expect(result.fetchedAt).toBeTruthy()
    })

    it('throws SecretStoreError with NOT_FOUND when the variable is absent', async () => {
      await expect(store.getSecret('DOES_NOT_EXIST')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        name: 'SecretStoreError',
      })
    })

    it('returns an empty string value when the variable is set but empty', async () => {
      const result = await store.getSecret('EMPTY')
      expect(result.value).toBe('')
    })
  })

  describe('getSecretField', () => {
    it('extracts a string field from a JSON secret', async () => {
      const result = await store.getSecretField('JSON_SECRET', 'key')
      expect(result.value).toBe('the-key')
    })

    it('coerces a numeric field to string', async () => {
      const result = await store.getSecretField('JSON_SECRET', 'nested')
      expect(result.value).toBe('42')
    })

    it('throws SecretStoreError with INVALID_FORMAT when the secret is not JSON', async () => {
      await expect(store.getSecretField('MY_SECRET', 'field')).rejects.toMatchObject({
        code: 'INVALID_FORMAT',
      })
    })

    it('throws SecretStoreError with INVALID_FORMAT when the field is missing', async () => {
      await expect(store.getSecretField('JSON_SECRET', 'missing')).rejects.toMatchObject({
        code: 'INVALID_FORMAT',
      })
    })

    it('throws SecretStoreError with NOT_FOUND when the env var is absent', async () => {
      await expect(store.getSecretField('NO_SUCH_VAR', 'field')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    })
  })

  describe('hasSecret', () => {
    it('returns true when the variable exists', async () => {
      expect(await store.hasSecret('MY_SECRET')).toBe(true)
    })

    it('returns false when the variable is absent', async () => {
      expect(await store.hasSecret('DOES_NOT_EXIST')).toBe(false)
    })

    it('returns true for a variable set to an empty string', async () => {
      expect(await store.hasSecret('EMPTY')).toBe(true)
    })
  })

  describe('listSecrets', () => {
    it('returns all known env var names', async () => {
      const keys = await store.listSecrets()
      expect(keys).toContain('MY_SECRET')
      expect(keys).toContain('JSON_SECRET')
    })
  })
})
