import { Command, Flags } from '@oclif/core'
import { CONFIG_FILE, getConfigProfile } from '../../config-file'
import {
  CREDENTIALS_FILE,
  getCredentialsProfile,
  setCredentialsProfile,
} from '../../credentials-file'
import { refreshAccessToken, getAwsCredentialsFromIdentityPool } from '../../auth/cognito'

export default class RelayStart extends Command {
  static description =
    'Start the local relay. Exchanges Cognito tokens for temporary AWS credentials and connects via SQS.'

  static examples = [
    '<%= config.bin %> relay start',
    '<%= config.bin %> relay start --profile staging',
  ]

  static flags = {
    profile: Flags.string({
      description: 'Profile name — matches a profile in ~/.slaops/config and ~/.slaops/credentials',
      default: 'default',
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(RelayStart)
    const profileName = flags.profile

    const config = getConfigProfile(profileName)
    let creds = getCredentialsProfile(profileName)

    if (!config?.relay_id) {
      this.error(
        `No relay config found for profile [${profileName}] in ${CONFIG_FILE}.\n` +
          `Run 'slaops relay init${profileName !== 'default' ? ` --profile ${profileName}` : ''}' first.`,
      )
    }

    if (!creds?.refresh_token) {
      this.error(
        `No credentials found for profile [${profileName}] in ${CREDENTIALS_FILE}.\n` +
          `Run 'slaops relay init${profileName !== 'default' ? ` --profile ${profileName}` : ''}' first.`,
      )
    }

    for (const key of [
      'relay_sqs_queue_url',
      'relay_sqs_region',
      'identity_pool_id',
      'cognito_region',
      'user_pool_id',
    ] as const) {
      if (!config[key]) {
        this.error(
          `Missing '${key}' in config profile [${profileName}].\nRun 'slaops relay init --force' to re-register.`,
        )
      }
    }

    // Refresh Cognito tokens if the access/id token has expired (60s buffer)
    let idToken = creds.id_token!
    if (creds.expires_at && Date.now() > new Date(creds.expires_at).getTime() - 60_000) {
      this.log('  Cognito tokens expired — refreshing...')
      try {
        const refreshed = await refreshAccessToken(creds.refresh_token!)
        idToken = refreshed.id_token
        // Write refreshed tokens back to credentials file only
        setCredentialsProfile(
          {
            access_token: refreshed.access_token,
            id_token: refreshed.id_token,
            expires_at: refreshed.expires_at,
          },
          profileName,
        )
        creds = getCredentialsProfile(profileName)!
        this.log('  ✓ Cognito tokens refreshed')
      } catch (err) {
        this.error(
          `Token refresh failed: ${(err as Error).message}\n` +
            `Your 30-day session has likely expired. Run 'slaops relay init --force' to re-authenticate.`,
        )
      }
    }

    // Exchange Cognito id_token for temporary AWS credentials via the Identity Pool.
    // These are held in-memory only — never written to disk.
    this.log(`  Obtaining AWS credentials from Identity Pool...`)
    let awsCreds
    try {
      awsCreds = await getAwsCredentialsFromIdentityPool(idToken, {
        identityPoolId: config.identity_pool_id!,
        region: config.cognito_region!,
        userPoolId: config.user_pool_id!,
      })
    } catch (err) {
      this.error(`Failed to obtain AWS credentials: ${(err as Error).message}`)
    }
    this.log(`  ✓ AWS credentials obtained (valid until ${awsCreds.expiration.toISOString()})`)

    // Inject relay configuration + in-memory AWS credentials into process.env.
    // Config values come from ~/.slaops/config; tokens from ~/.slaops/credentials.
    // AWS credentials are never written to either file.
    process.env.RELAY_ID = config.relay_id
    process.env.RELAY_PLATFORM_URL = config.platform_url
    process.env.RELAY_PLATFORM_TOKEN = creds.access_token
    process.env.RELAY_PLATFORM_SQS_QUEUE_URL = config.relay_sqs_queue_url
    process.env.RELAY_PLATFORM_SQS_REGION = config.relay_sqs_region
    // AWS temp credentials — in-memory only, passed to relay's SQS client
    process.env.RELAY_PLATFORM_SQS_ACCESS_KEY_ID = awsCreds.accessKeyId
    process.env.RELAY_PLATFORM_SQS_SECRET_ACCESS_KEY = awsCreds.secretAccessKey
    process.env.RELAY_PLATFORM_SQS_SESSION_TOKEN = awsCreds.sessionToken
    process.env.RELAY_PLATFORM_SQS_CREDS_EXPIRY = awsCreds.expiration.toISOString()
    // Cognito config needed by relay for autonomous credential refresh
    process.env.RELAY_COGNITO_IDENTITY_POOL_ID = config.identity_pool_id
    process.env.RELAY_COGNITO_REGION = config.cognito_region
    process.env.RELAY_COGNITO_USER_POOL_ID = config.user_pool_id
    process.env.RELAY_COGNITO_ID_TOKEN = idToken
    process.env.RELAY_COGNITO_REFRESH_TOKEN = creds.refresh_token
    process.env.RELAY_COGNITO_CLIENT_ID = process.env.SLAOPS_COGNITO_CLIENT_ID ?? ''
    process.env.RELAY_COGNITO_DOMAIN =
      process.env.SLAOPS_COGNITO_DOMAIN ?? 'https://auth.slaops.com'
    process.env.RELAY_SSRF_POLICY = 'dev-local'
    process.env.AEGIS_REQUIRED = 'false'

    this.log(`\n  ✓ Local relay starting (relay_id: ${config.relay_id}) [profile: ${profileName}]`)
    this.log(`  ✓ Connecting via SQS → ${config.relay_sqs_queue_url}`)
    this.log(`\n  Target localhost services are now reachable from the SLAOps API Tester.`)
    this.log(`  Press Ctrl+C to stop.\n`)

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { bootstrapRelay } = require('slaops-relay') as { bootstrapRelay: () => Promise<void> }
    await bootstrapRelay()
  }
}
