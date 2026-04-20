import * as path from 'path'
import { SLAOPS_DIR, DEFAULT_PROFILE, getSection, setSection } from './profile-store'

/**
 * ~/.slaops/credentials — sensitive Cognito tokens, mode 0600.
 *
 * Mirrors the role of ~/.aws/credentials in the AWS CLI: stores only the
 * time-limited, sensitive material for each profile. Strict file permissions
 * (0600) prevent other users on the machine from reading the tokens.
 *
 * Stored fields per profile:
 *   access_token  — Cognito access token (1h)
 *   id_token      — Cognito id_token (1h) — used for Identity Pool credential exchange
 *   refresh_token — Cognito refresh token (30d) — triggers re-auth when expired
 *   expires_at    — ISO 8601 timestamp of access/id token expiry
 *
 * NOT stored: AWS access keys, secret keys, or session tokens.
 * Temporary AWS credentials are obtained at relay start via the Identity Pool
 * and held in the relay process memory only — never written to disk.
 */
export interface RelayCredentials {
  access_token: string
  id_token: string
  refresh_token: string
  expires_at: string
}

export const CREDENTIALS_FILE = path.join(SLAOPS_DIR, 'credentials')

export function getCredentialsProfile(
  profile = DEFAULT_PROFILE,
): Partial<RelayCredentials> | undefined {
  return getSection(CREDENTIALS_FILE, profile) as Partial<RelayCredentials> | undefined
}

export function setCredentialsProfile(
  values: Partial<RelayCredentials>,
  profile = DEFAULT_PROFILE,
): void {
  setSection(CREDENTIALS_FILE, values as Record<string, string>, profile, 0o600)
}
