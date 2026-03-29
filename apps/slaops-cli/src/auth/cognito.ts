import * as crypto from 'crypto'
import * as http from 'http'
import { execSync } from 'child_process'

/**
 * Cognito configuration.
 * Override via environment variables for non-production environments.
 *
 * SLAOPS_COGNITO_DOMAIN       — Cognito hosted UI base URL (no trailing slash)
 * SLAOPS_COGNITO_CLIENT_ID    — OAuth 2.0 public client ID (PKCE — no client secret)
 * SLAOPS_COGNITO_REGION       — AWS region for the User Pool (default: ap-southeast-2)
 * SLAOPS_COGNITO_USER_POOL_ID — Cognito User Pool ID (used as Identity Pool provider key)
 * SLAOPS_IDENTITY_POOL_ID     — Cognito Identity Pool ID (for AWS credential exchange)
 */
export const COGNITO_DOMAIN =
  process.env.SLAOPS_COGNITO_DOMAIN ?? 'https://auth.slaops.com'
export const CLIENT_ID =
  process.env.SLAOPS_COGNITO_CLIENT_ID ?? ''
export const COGNITO_REGION =
  process.env.SLAOPS_COGNITO_REGION ?? 'ap-southeast-2'
export const USER_POOL_ID =
  process.env.SLAOPS_COGNITO_USER_POOL_ID ?? ''
export const IDENTITY_POOL_ID =
  process.env.SLAOPS_IDENTITY_POOL_ID ?? ''

const REDIRECT_PORT = 9876
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`
const SCOPES = ['openid', 'email', 'profile'].join(' ')

export interface CognitoTokens {
  access_token: string
  refresh_token: string
  id_token: string
  /** Absolute ISO timestamp at which the access token expires. */
  expires_at: string
}

function generateCodeVerifier(): string {
  // RFC 7636 — 43–128 unreserved characters
  return crypto.randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

function openBrowser(url: string): void {
  try {
    if (process.platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' })
    } else if (process.platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore' })
    } else {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' })
    }
  } catch {
    // Silently ignore — the user will be shown the URL to open manually below
  }
}

async function exchangeCode(code: string, verifier: string): Promise<CognitoTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  })

  const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.status.toString())
    throw new Error(`Cognito token exchange failed: ${text}`)
  }

  const json = await res.json() as {
    access_token: string
    refresh_token: string
    id_token: string
    expires_in: number
  }

  const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString()
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    id_token: json.id_token,
    expires_at: expiresAt,
  }
}

/**
 * Refresh an expired access token using a stored refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<CognitoTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  })

  const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.status.toString())
    throw new Error(`Cognito token refresh failed: ${text}`)
  }

  const json = await res.json() as {
    access_token: string
    id_token: string
    expires_in: number
  }

  const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString()
  return {
    access_token: json.access_token,
    refresh_token: refreshToken, // Cognito does not rotate refresh tokens on every refresh
    id_token: json.id_token,
    expires_at: expiresAt,
  }
}

export interface AwsTemporaryCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  /** Absolute Date at which these credentials expire (~1 hour from issuance). */
  expiration: Date
}

/**
 * Exchange a Cognito id_token for short-lived AWS credentials via the Identity Pool.
 * Calls GetId then GetCredentialsForIdentity on the Cognito Identity service.
 * No AWS SDK required — uses raw JSON API with fetch.
 *
 * The returned credentials are valid for ~1 hour. The relay process calls this
 * automatically before they expire, using the in-memory id_token (refreshing
 * it first via the refresh_token if needed).
 */
export async function getAwsCredentialsFromIdentityPool(
  idToken: string,
  opts?: { identityPoolId?: string; region?: string; userPoolId?: string },
): Promise<AwsTemporaryCredentials> {
  const poolId = opts?.identityPoolId ?? IDENTITY_POOL_ID
  const region = opts?.region ?? COGNITO_REGION
  const userPoolId = opts?.userPoolId ?? USER_POOL_ID

  if (!poolId) throw new Error('SLAOPS_IDENTITY_POOL_ID is not configured.')
  if (!userPoolId) throw new Error('SLAOPS_COGNITO_USER_POOL_ID is not configured.')

  const endpoint = `https://cognito-identity.${region}.amazonaws.com/`
  const providerKey = `cognito-idp.${region}.amazonaws.com/${userPoolId}`
  const logins = { [providerKey]: idToken }

  // Step 1: resolve the stable identity ID for this user
  const idRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityService.GetId',
    },
    body: JSON.stringify({ IdentityPoolId: poolId, Logins: logins }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!idRes.ok) {
    const text = await idRes.text().catch(() => idRes.status.toString())
    throw new Error(`Identity Pool GetId failed: ${text}`)
  }
  const { IdentityId } = await idRes.json() as { IdentityId: string }

  // Step 2: exchange identity ID + id_token for temporary AWS credentials
  const credsRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityService.GetCredentialsForIdentity',
    },
    body: JSON.stringify({ IdentityId, Logins: logins }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!credsRes.ok) {
    const text = await credsRes.text().catch(() => credsRes.status.toString())
    throw new Error(`Identity Pool GetCredentialsForIdentity failed: ${text}`)
  }
  const { Credentials } = await credsRes.json() as {
    Credentials: {
      AccessKeyId: string
      SecretKey: string
      SessionToken: string
      Expiration: number // epoch seconds
    }
  }

  return {
    accessKeyId: Credentials.AccessKeyId,
    secretAccessKey: Credentials.SecretKey,
    sessionToken: Credentials.SessionToken,
    expiration: new Date(Credentials.Expiration * 1000),
  }
}

/**
 * Open a browser for Cognito Authorization Code + PKCE authentication.
 * Starts a local HTTP server on port 9876 to catch the redirect callback.
 * Returns tokens once the user completes login.
 */
export async function authenticateWithBrowser(): Promise<CognitoTokens> {
  if (!CLIENT_ID) {
    throw new Error(
      'SLAOPS_COGNITO_CLIENT_ID is not configured. ' +
      'Set the environment variable or use a release build of slaops-cli.',
    )
  }

  const verifier = generateCodeVerifier()
  const challenge = generateCodeChallenge(verifier)
  const state = crypto.randomBytes(16).toString('hex')

  const authUrl = new URL(`${COGNITO_DOMAIN}/oauth2/authorize`)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url ?? '/', `http://localhost:${REDIRECT_PORT}`)

      if (reqUrl.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }

      const error = reqUrl.searchParams.get('error')
      if (error) {
        const description = reqUrl.searchParams.get('error_description') ?? error
        res.writeHead(400).end(`<h1>Authentication failed</h1><p>${description}</p>`)
        server.close()
        reject(new Error(`Cognito auth error: ${description}`))
        return
      }

      const returnedState = reqUrl.searchParams.get('state')
      if (returnedState !== state) {
        res.writeHead(400).end('<h1>State mismatch — please try again.</h1>')
        server.close()
        reject(new Error('OAuth state mismatch'))
        return
      }

      const code = reqUrl.searchParams.get('code')
      if (!code) {
        res.writeHead(400).end('<h1>No authorization code received.</h1>')
        server.close()
        reject(new Error('No authorization code in callback'))
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' }).end(
        '<h1>Authentication successful</h1><p>You can close this tab and return to the terminal.</p>',
      )
      server.close()

      try {
        resolve(await exchangeCode(code, verifier))
      } catch (err) {
        reject(err)
      }
    })

    server.listen(REDIRECT_PORT, () => {
      process.stdout.write(`\n  Opening browser for authentication...\n`)
      process.stdout.write(`  If the browser does not open, visit:\n  ${authUrl}\n\n`)
      openBrowser(authUrl.toString())
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${REDIRECT_PORT} is already in use. Close the other process and retry.`))
      } else {
        reject(err)
      }
    })
  })
}
