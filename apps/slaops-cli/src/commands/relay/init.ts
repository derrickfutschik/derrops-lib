import { Command, Flags } from '@oclif/core'
import * as readline from 'readline'
import {
  authenticateWithBrowser,
  COGNITO_REGION,
  IDENTITY_POOL_ID,
  USER_POOL_ID,
} from '../../auth/cognito'
import { CONFIG_FILE, getConfigProfile, setConfigProfile } from '../../config-file'
import { CREDENTIALS_FILE, setCredentialsProfile } from '../../credentials-file'

const DEFAULT_PLATFORM_URL = 'https://api.slaops.com'

interface RelayRegistrationResponse {
  id: string // relay UUID (connection.id)
  sqs_queue_url: string // FIFO queue URL (platform-provisioned or customer-provided)
  sqs_region: string // AWS region of the queue
  sqs_queue_mode: 'platform' | 'relay'
}

async function registerRelay(
  platformUrl: string,
  accessToken: string,
  opts: { sqsQueueMode: 'platform' | 'relay'; relayQueueUrl?: string },
): Promise<RelayRegistrationResponse> {
  // Send the access_token as Bearer. slaops-cloud verifies it against Cognito
  // JWKS and reads tenantId + sub from the verified access token claims.
  // No client-supplied headers are trusted for identity.
  const body: Record<string, string> = { type: 'local-dev', sqs_queue_mode: opts.sqsQueueMode }
  if (opts.sqsQueueMode === 'relay' && opts.relayQueueUrl) {
    body.relay_sqs_queue_url = opts.relayQueueUrl
  }

  const res = await fetch(`${platformUrl}/cloud-relay/connection`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
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
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
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
    '<%= config.bin %> relay init --queue-mode relay --relay-queue-url https://sqs.ap-southeast-2.amazonaws.com/999/my-queue.fifo',
  ]

  static flags = {
    'platform-url': Flags.string({
      description: 'SLAOps platform base URL (prompted if omitted)',
    }),
    profile: Flags.string({
      char: 'p',
      description:
        'Profile name in ~/.slaops/config and ~/.slaops/credentials (default: "default")',
      default: 'default',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Re-authenticate and overwrite existing credentials for this profile',
      default: false,
    }),
    'queue-mode': Flags.string({
      options: ['platform', 'relay'],
      default: 'platform',
      description:
        'platform (default) — SLAOps provisions and owns the SQS FIFO queue.\n' +
        'relay              — You provision the queue in your own AWS account and grant the SlaOpsSqsPublishRole sqs:SendMessage permission.',
    }),
    'relay-queue-url': Flags.string({
      description: 'Your SQS FIFO queue URL. Required when --queue-mode=relay.',
      dependsOn: [],
    }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(RelayInit)
    const profile = flags.profile
    const sqsQueueMode = (flags['queue-mode'] ?? 'platform') as 'platform' | 'relay'
    const existing = getConfigProfile(profile)

    if (existing?.relay_id && !flags.force) {
      this.log(
        `Profile [${profile}] is already initialised (relay_id: ${existing.relay_id}, platform: ${existing.platform_url}).`,
      )
      this.log(`  Use --force to re-authenticate, or run:`)
      this.log(`  slaops relay start${profile !== 'default' ? ` --profile ${profile}` : ''}`)
      return
    }

    // Validate relay-owned queue URL
    let relayQueueUrl = flags['relay-queue-url']
    if (sqsQueueMode === 'relay') {
      if (!relayQueueUrl) {
        relayQueueUrl = await prompt('  Your SQS FIFO queue URL: ')
      }
      if (!relayQueueUrl || !relayQueueUrl.endsWith('.fifo')) {
        this.error('--relay-queue-url must be an SQS FIFO queue URL ending in .fifo')
      }
    }

    // Resolve platform URL: flag > existing profile value > interactive prompt > hardcoded default
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

    // Register relay — slaops-cloud verifies the access_token, reads tenantId
    // and sub from its claims, then provisions (or validates) the SQS FIFO queue.
    this.log(`  Registering local relay with ${platformUrl} (queue-mode: ${sqsQueueMode})...`)
    const registration = await registerRelay(platformUrl, tokens.access_token, {
      sqsQueueMode,
      relayQueueUrl,
    })
    this.log(`  ✓ Registered (relay_id: ${registration.id})`)

    if (sqsQueueMode === 'relay') {
      this.log(`\n  Queue mode: relay-owned`)
      this.log(`  Ensure the SlaOpsSqsPublishRole has sqs:SendMessage on:`)
      this.log(`    ${registration.sqs_queue_url}`)
    }

    // Write non-sensitive relay configuration to ~/.slaops/config (0644).
    // Identity Pool / Cognito config is static per deployment — read from env.
    setConfigProfile(
      {
        platform_url: platformUrl,
        relay_id: registration.id,
        relay_sqs_queue_url: registration.sqs_queue_url,
        relay_sqs_region: registration.sqs_region,
        relay_sqs_queue_mode: registration.sqs_queue_mode,
        identity_pool_id: process.env.SLAOPS_IDENTITY_POOL_ID ?? IDENTITY_POOL_ID,
        cognito_region: process.env.SLAOPS_COGNITO_REGION ?? COGNITO_REGION,
        user_pool_id: process.env.SLAOPS_COGNITO_USER_POOL_ID ?? USER_POOL_ID,
      },
      profile,
    )

    // Write sensitive Cognito tokens to ~/.slaops/credentials (0600).
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
    this.log(
      `\n  Run 'slaops relay start${profile !== 'default' ? ` --profile ${profile}` : ''}' to connect.`,
    )
    this.log(`  Your session is valid for 30 days. Re-run this command when it expires.\n`)
  }
}
