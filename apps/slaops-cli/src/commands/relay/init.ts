import { Command, Flags } from '@oclif/core'
import * as readline from 'readline'
import { authenticateWithBrowser } from '../../auth/cognito'
import { CONFIG_FILE, getConfigProfile, setConfigProfile } from '../../config-file'
import { CREDENTIALS_FILE, setCredentialsProfile } from '../../credentials-file'

const DEFAULT_PLATFORM_URL = 'https://api.slaops.com'

interface RelayRegistrationResponse {
  relay_id: string
  sqs_queue_url: string
  sqs_region: string
  identity_pool_id: string
  cognito_region: string
  user_pool_id: string
}

async function registerRelay(
  platformUrl: string,
  accessToken: string,
): Promise<RelayRegistrationResponse> {
  const res = await fetch(`${platformUrl}/relay-connections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ type: 'local-dev', delivery_mode: 'sqs' }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.status.toString())
    throw new Error(`Relay registration failed (HTTP ${res.status}): ${text}`)
  }

  return res.json() as Promise<RelayRegistrationResponse>
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export default class RelayInit extends Command {
  static description =
    'Authenticate with SLAOps via browser and register a local-dev relay. Re-run every 30 days when the refresh token expires.'

  static examples = [
    '<%= config.bin %> relay init',
    '<%= config.bin %> relay init --profile staging --platform-url https://api.staging.slaops.com',
    '<%= config.bin %> relay init --profile staging --force',
  ]

  static flags = {
    'platform-url': Flags.string({
      description: 'SLAOps platform base URL (prompted if omitted)',
    }),
    profile: Flags.string({
      char: 'p',
      description: 'Profile name in ~/.slaops/config and ~/.slaops/credentials (default: "default")',
      default: 'default',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Re-authenticate and overwrite existing credentials for this profile',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(RelayInit)
    const profile = flags.profile
    const existing = getConfigProfile(profile)

    if (existing?.relay_id && !flags.force) {
      this.log(`Profile [${profile}] is already initialised (relay_id: ${existing.relay_id}, platform: ${existing.platform_url}).`)
      this.log(`  Use --force to re-authenticate, or run:`)
      this.log(`  slaops relay start${profile !== 'default' ? ` --profile ${profile}` : ''}`)
      return
    }

    // Resolve platform URL: flag > existing profile value > interactive prompt > hardcoded default.
    // This means re-running with --force for an existing profile pre-fills the saved URL.
    let platformUrl = flags['platform-url']
    if (!platformUrl) {
      const savedUrl = existing?.platform_url ?? DEFAULT_PLATFORM_URL
      const answer = await prompt(`  Platform URL [${savedUrl}]: `)
      platformUrl = answer || savedUrl
    }
    platformUrl = platformUrl.replace(/\/$/, '')

    // Authenticate via Cognito browser OAuth (PKCE)
    this.log(`\n  Waiting for browser authentication...`)
    const tokens = await authenticateWithBrowser()
    this.log(`  ✓ Authenticated`)

    // Register relay — platform creates the SQS queue and returns config
    this.log(`  Registering local relay with ${platformUrl}...`)
    const registration = await registerRelay(platformUrl, tokens.access_token)
    this.log(`  ✓ Registered (relay_id: ${registration.relay_id})`)

    // Write non-sensitive relay configuration to ~/.slaops/config (0644)
    setConfigProfile(
      {
        platform_url: platformUrl,
        relay_id: registration.relay_id,
        relay_sqs_queue_url: registration.sqs_queue_url,
        relay_sqs_region: registration.sqs_region,
        identity_pool_id: registration.identity_pool_id,
        cognito_region: registration.cognito_region,
        user_pool_id: registration.user_pool_id,
      },
      profile,
    )

    // Write sensitive Cognito tokens to ~/.slaops/credentials (0600)
    // No AWS credentials are stored — obtained at runtime via the Identity Pool.
    setCredentialsProfile(
      {
        access_token: tokens.access_token,
        id_token: tokens.id_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_at,
      },
      profile,
    )

    this.log(`  ✓ Config saved to ${CONFIG_FILE}`)
    this.log(`  ✓ Credentials saved to ${CREDENTIALS_FILE}`)
    this.log(`\n  Run 'slaops relay start${profile !== 'default' ? ` --profile ${profile}` : ''}' to connect.`)
    this.log(`  Your session is valid for 30 days. Re-run this command when it expires.\n`)
  }
}
