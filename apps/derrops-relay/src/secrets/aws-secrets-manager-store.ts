import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { SecretStore, SecretStoreError, SecretValue } from './secret-store'

/**
 * AWS Secrets Manager secret store.
 *
 * URI format: aws-secretsmanager://arn-or-name
 *
 * The store receives the path portion (everything after aws-secretsmanager://)
 * and passes it directly to the AWS SDK as the SecretId. Both ARNs and friendly
 * names are supported:
 *
 *   aws-secretsmanager://arn:aws:secretsmanager:us-east-1:123:secret:name-XyZ
 *   aws-secretsmanager://prod/api-key
 *
 * ARNs are recommended in production to avoid region/account ambiguity.
 *
 * Authentication: IAM role attached to the Lambda execution role or EC2 instance
 * profile. No credentials are stored in the Relay environment.
 *
 * Requires @aws-sdk/client-secrets-manager (included in package.json).
 */
export class AwsSecretsManagerStore implements SecretStore {
  private readonly client: SecretsManagerClient

  constructor(environment: NodeJS.ProcessEnv = process.env) {
    this.client = new SecretsManagerClient({
      ...(environment.AWS_REGION ? { region: environment.AWS_REGION } : {}),
    })
  }

  async getSecret(secretId: string): Promise<SecretValue> {
    try {
      const response = await this.client.send(new GetSecretValueCommand({ SecretId: secretId }))

      const value: string =
        response.SecretString !== undefined
          ? response.SecretString
          : Buffer.from(response.SecretBinary as Uint8Array).toString('utf8')

      return { value, fetchedAt: new Date().toISOString(), fromCache: false }
    } catch (err: unknown) {
      if (err instanceof Error) {
        const name = err.name
        if (name === 'ResourceNotFoundException') {
          throw new SecretStoreError(`AWS secret not found: '${secretId}'`, 'NOT_FOUND', secretId)
        }
        if (name === 'AccessDeniedException' || name === 'InvalidRequestException') {
          throw new SecretStoreError(
            `AWS access denied for secret '${secretId}'`,
            'ACCESS_DENIED',
            secretId,
          )
        }
      }
      if (err instanceof SecretStoreError) throw err
      throw new SecretStoreError(
        `AWS Secrets Manager error for '${secretId}': ${err instanceof Error ? err.message : String(err)}`,
        'STORE_UNAVAILABLE',
        secretId,
      )
    }
  }

  async getSecretField(secretId: string, field: string): Promise<SecretValue> {
    const { value, fetchedAt } = await this.getSecret(secretId)
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new SecretStoreError(
        `AWS secret '${secretId}' is not valid JSON`,
        'INVALID_FORMAT',
        secretId,
      )
    }
    if (typeof parsed !== 'object' || parsed === null || !(field in (parsed as object))) {
      throw new SecretStoreError(
        `Field '${field}' not found in AWS secret '${secretId}'`,
        'INVALID_FORMAT',
        secretId,
      )
    }
    const fieldValue = (parsed as Record<string, unknown>)[field]
    return { value: String(fieldValue), fetchedAt, fromCache: false }
  }

  async hasSecret(secretId: string): Promise<boolean> {
    try {
      await this.getSecret(secretId)
      return true
    } catch (err) {
      if (err instanceof SecretStoreError && err.code === 'NOT_FOUND') return false
      throw err
    }
  }
}
