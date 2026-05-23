import { maskSecrets } from './secret-masker'
import type { InjectedSecret } from '../template/template-resolver'

const LONG_SECRET = 'super-secret-value-1234'
const SHORT_SECRET = 'short'

describe('maskSecrets', () => {
  describe('body masking', () => {
    it('replaces a secret value in the body', () => {
      const { body, masking } = maskSecrets(`token is ${LONG_SECRET} here`, {}, [
        { uri: 'env://MY_SECRET', value: LONG_SECRET },
      ])
      expect(body).not.toContain(LONG_SECRET)
      expect(body).toMatch(/\[REDACTED:env:[0-9a-f]{8}\]/)
      expect(masking.bodyMasked).toBe(true)
    })

    it('replaces multiple occurrences in the body', () => {
      const { body } = maskSecrets(`a=${LONG_SECRET}&b=${LONG_SECRET}`, {}, [
        { uri: 'env://MY_SECRET', value: LONG_SECRET },
      ])
      expect(body).not.toContain(LONG_SECRET)
      expect(body.match(/\[REDACTED:/g)?.length).toBe(2)
    })

    it('does not modify the body when the secret is absent', () => {
      const original = 'no secret here'
      const { body, masking } = maskSecrets(original, {}, [
        { uri: 'env://MY_SECRET', value: LONG_SECRET },
      ])
      expect(body).toBe(original)
      expect(masking.bodyMasked).toBe(false)
    })
  })

  describe('header masking', () => {
    it('replaces a secret value in a response header', () => {
      const { headers, masking } = maskSecrets('', { Authorization: `Bearer ${LONG_SECRET}` }, [
        { uri: 'env://MY_SECRET', value: LONG_SECRET },
      ])
      expect(headers['Authorization']).not.toContain(LONG_SECRET)
      expect(headers['Authorization']).toMatch(/\[REDACTED:/)
      expect(masking.headersMasked).toBe(true)
    })

    it('does not modify headers that do not contain the secret', () => {
      const { headers } = maskSecrets(
        '',
        { 'Content-Type': 'application/json', 'X-Secret': LONG_SECRET },
        [{ uri: 'env://MY_SECRET', value: LONG_SECRET }],
      )
      expect(headers['Content-Type']).toBe('application/json')
      expect(headers['X-Secret']).not.toContain(LONG_SECRET)
    })
  })

  describe('short secrets (below minSecretMaskLength)', () => {
    it('skips masking for secrets shorter than the minimum length', () => {
      const body = `secret is ${SHORT_SECRET}`
      const { body: masked, masking } = maskSecrets(body, {}, [
        { uri: 'env://SHORT', value: SHORT_SECRET },
      ])
      expect(masked).toBe(body)
      expect(masking.bodyMasked).toBe(false)
    })
  })

  describe('maskedSecretUris tracking', () => {
    it('records the URI when a secret is masked', () => {
      const { masking } = maskSecrets(LONG_SECRET, {}, [
        { uri: 'env://MY_SECRET', value: LONG_SECRET },
      ])
      expect(masking.maskedSecretUris).toContain('env://MY_SECRET')
    })

    it('deduplicates the same URI masked in both body and header', () => {
      const { masking } = maskSecrets(LONG_SECRET, { 'X-Token': LONG_SECRET }, [
        { uri: 'env://MY_SECRET', value: LONG_SECRET },
      ])
      expect(masking.maskedSecretUris.filter((u) => u === 'env://MY_SECRET').length).toBe(1)
    })

    it('tracks multiple distinct secret URIs', () => {
      const secret2 = 'another-secret-value'
      const { masking } = maskSecrets(`${LONG_SECRET} ${secret2}`, {}, [
        { uri: 'env://SECRET_A', value: LONG_SECRET },
        { uri: 'env://SECRET_B', value: secret2 },
      ])
      expect(masking.maskedSecretUris).toContain('env://SECRET_A')
      expect(masking.maskedSecretUris).toContain('env://SECRET_B')
    })

    it('does not record a URI for a secret that does not appear', () => {
      const { masking } = maskSecrets('no match', {}, [{ uri: 'env://ABSENT', value: LONG_SECRET }])
      expect(masking.maskedSecretUris).toHaveLength(0)
    })
  })

  describe('redaction label format', () => {
    it('includes the URI scheme in the label', () => {
      const { body } = maskSecrets(LONG_SECRET, {}, [
        { uri: 'aws-secretsmanager://arn:aws:secret:1', value: LONG_SECRET },
      ])
      expect(body).toMatch(/\[REDACTED:aws-secretsmanager:[0-9a-f]{8}\]/)
    })

    it('uses "secret" as scheme when :// is absent', () => {
      const secret: InjectedSecret = { uri: 'no-scheme-here', value: LONG_SECRET }
      const { body } = maskSecrets(LONG_SECRET, {}, [secret])
      expect(body).toMatch(/\[REDACTED:secret:[0-9a-f]{8}\]/)
    })

    it('produces a stable, deterministic label for the same URI', () => {
      const apply = () =>
        maskSecrets(LONG_SECRET, {}, [{ uri: 'vault://host/path', value: LONG_SECRET }])
      expect(apply().body).toBe(apply().body)
    })
  })

  describe('empty inputs', () => {
    it('handles an empty body with no secrets', () => {
      const { body, masking } = maskSecrets('', {}, [])
      expect(body).toBe('')
      expect(masking.bodyMasked).toBe(false)
      expect(masking.headersMasked).toBe(false)
    })
  })
})
